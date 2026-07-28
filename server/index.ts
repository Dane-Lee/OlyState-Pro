/**
 * OlyState Pro local API (milestones osp-exportable-persistence +
 * osp-observation-envelopes + osp-sentios-signals).
 *
 * Endpoints:
 *   GET  /health   → { status, datasetSaved }
 *   GET  /dataset  → latest persisted dataset (404 before first save)
 *   PUT  /dataset  → persist dataset; enqueue new observations as
 *                    ObservationUpsert envelopes (idempotent per observation id)
 *
 * Hub publishing runs server-side (service key never in the browser):
 *   ATHLETEOS_HUB_URL / ATHLETEOS_SERVICE_KEY  — hub push (no-op unless set)
 *   SENTIOS_URL / SENTIOS_API_KEY              — SentiOS signals (no-op unless set)
 */
import { createServer } from "node:http";
import { OlyStateDatabase } from "./db";
import {
  connectionSettingsPath,
  loadConnectionSettings,
  outboundState,
  reportToHub,
  shouldEnqueue,
  shouldTransmit,
} from "./connectionSettings";
import {
  collectPublishableObservations,
} from "../src/domain/ecosystemEnvelope";
import type { OlyStateDataSet } from "../src/domain/types";
import { SourceApp, SyncPayloadType } from "../src/ecosystem-contracts/enums";
import { SYNC_SCHEMA_VERSION } from "../src/ecosystem-contracts/envelope";

const port = Number(process.env.OLYSTATE_API_PORT ?? 8788);
const dbPath = process.env.OLYSTATE_DB_PATH ?? "./data/olystate.sqlite";
const db = new OlyStateDatabase(dbPath);
const settingsPath = connectionSettingsPath(dbPath);

const PAYLOAD_SCHEMA_VERSION = "1.0.0";
const MAX_ATTEMPTS = 10;
const DRAIN_BATCH = 100;

const hubUrl = () => process.env.ATHLETEOS_HUB_URL?.replace(/\/$/, "");
const serviceKey = () => process.env.ATHLETEOS_SERVICE_KEY;
const isHubConfigured = () => Boolean(hubUrl() && serviceKey());
const sentiUrl = () => (process.env.SENTIOS_URL ?? "http://127.0.0.1:4777").replace(/\/$/, "");
const sentiKey = () => process.env.SENTIOS_API_KEY;

function emitSenti(event: string, category: "operational" | "sync" | "heartbeat", overrides: Record<string, unknown> = {}) {
  if (!sentiKey()) return;
  void fetch(`${sentiUrl()}/senti/signal`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-sentios-api-key": sentiKey() as string },
    body: JSON.stringify({
      module: "OlyState",
      event,
      category,
      inbound: true,
      outbound: true,
      routing: "complete",
      latency: 0,
      integrity: { ok: true },
      ts: new Date().toISOString(),
      optionalMetadata: { version: "olystate-pro" },
      ...overrides,
    }),
  }).catch(() => undefined);
}

async function resolveSharedAthleteId(athleteId: string): Promise<string | undefined> {
  const existing = db.linkFor(athleteId);
  if (existing) return existing;
  if (!isHubConfigured()) return undefined;
  try {
    const response = await fetch(`${hubUrl()}/api/registry/athletes`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-service-key": serviceKey() as string },
      body: JSON.stringify({ sourceAthleteId: athleteId, matchMethod: "auto-resolve" }),
    });
    if (!response.ok) return undefined;
    const body = (await response.json()) as { sharedAthleteId?: string };
    if (!body.sharedAthleteId) return undefined;
    db.storeLink(athleteId, body.sharedAthleteId);
    return body.sharedAthleteId;
  } catch {
    return undefined;
  }
}

async function drainOutbox(): Promise<void> {
  if (!isHubConfigured()) return;
  const rows = db.pending(DRAIN_BATCH, MAX_ATTEMPTS);
  if (rows.length === 0) return;

  const settings = loadConnectionSettings(settingsPath);
  const envelopes: Record<string, unknown>[] = [];
  const envelopeRows: typeof rows = [];
  for (const row of rows) {
    // Connection switchboard: 'off'/'pause' keep this row queued untouched —
    // not marked sent/failed, just skipped for this drain pass.
    if (!shouldTransmit(outboundState(settings, row.payloadType as SyncPayloadType))) continue;

    const sharedAthleteId = await resolveSharedAthleteId(row.athleteId);
    if (!sharedAthleteId) continue;
    envelopes.push({
      syncSchemaVersion: SYNC_SCHEMA_VERSION,
      sourceApp: SourceApp.OlyStatePro,
      exportedAt: new Date().toISOString(),
      idempotencyKey: row.idempotencyKey,
      payloadType: row.payloadType,
      payload: { ...JSON.parse(row.payloadJson), sharedAthleteId },
      payloadSchemaVersion: PAYLOAD_SCHEMA_VERSION,
    });
    envelopeRows.push(row);
  }
  if (envelopes.length === 0) return;

  try {
    const response = await fetch(`${hubUrl()}/api/sync/push`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-service-key": serviceKey() as string },
      body: JSON.stringify({ envelopes }),
    });
    if (!response.ok) throw new Error(`hub push failed (${response.status})`);
    const results =
      ((await response.json()) as { results?: { accepted?: boolean; conflictDetected?: boolean; remoteTraceId?: string }[] })
        .results ?? [];

    let accepted = 0;
    envelopeRows.forEach((row, index) => {
      const result = results[index];
      const attempts = row.attempts + 1;
      if (result?.accepted || result?.conflictDetected) {
        db.mark(row.id, "sent", attempts, result.conflictDetected ? `conflict: ${result.remoteTraceId ?? ""}` : undefined);
        if (result.accepted) accepted += 1;
      } else {
        db.mark(row.id, attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, result?.remoteTraceId ?? "rejected by hub");
      }
    });
    emitSenti("athlete_os_push_success", "sync", { optionalMetadata: { version: "olystate-pro", opTime: accepted } });
  } catch (error) {
    for (const row of envelopeRows) {
      const attempts = row.attempts + 1;
      db.mark(row.id, attempts >= MAX_ATTEMPTS ? "failed" : "pending", attempts, String(error));
    }
    emitSenti("athlete_os_push_fail", "sync", {
      routing: "incomplete",
      integrity: { ok: false, details: String(error).slice(0, 200) },
    });
  }
}

function enqueueObservations(dataSet: OlyStateDataSet): number {
  // Connection switchboard: 'off' stops queuing too; 'pause' still queues
  // (only transmission is gated later, in drainOutbox).
  const state = outboundState(loadConnectionSettings(settingsPath), SyncPayloadType.ObservationUpsert);
  if (!shouldEnqueue(state)) return 0;

  let queued = 0;
  for (const { athleteId, draft } of collectPublishableObservations(dataSet)) {
    // The observation's own id is the idempotency key: re-saving the dataset
    // can never duplicate an already-queued/sent observation.
    if (db.enqueue(draft.observationId, SyncPayloadType.ObservationUpsert, athleteId, JSON.stringify(draft))) {
      queued += 1;
    }
  }
  return queued;
}

const readBody = async (req: import("node:http").IncomingMessage): Promise<string> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf8");
};

const server = createServer(async (req, res) => {
  const send = (status: number, payload: unknown) => {
    res.writeHead(status, {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
    });
    res.end(JSON.stringify(payload));
  };

  try {
    if (req.method === "OPTIONS") return send(204, {});
    if (req.method === "GET" && req.url === "/health") {
      return send(200, { status: "ok", service: "OlyStatePro", datasetSaved: Boolean(db.loadDataset()) });
    }
    if (req.method === "GET" && req.url === "/dataset") {
      const payload = db.loadDataset();
      if (!payload) return send(404, { error: "No dataset saved yet." });
      res.writeHead(200, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      return res.end(payload);
    }
    if (req.method === "PUT" && req.url === "/dataset") {
      const raw = await readBody(req);
      const dataSet = JSON.parse(raw) as OlyStateDataSet;
      if (!Array.isArray(dataSet.athletes) || !Array.isArray(dataSet.sessions)) {
        return send(400, { error: "Body must be an OlyStateDataSet." });
      }
      db.saveDataset(raw);
      const queued = enqueueObservations(dataSet);
      if (queued > 0) void drainOutbox();
      emitSenti("session_imported", "operational");
      return send(200, { saved: true, observationsQueued: queued });
    }
    return send(404, { error: `No route for ${req.method} ${req.url}` });
  } catch (error) {
    return send(500, { error: error instanceof Error ? error.message : "Unknown server error." });
  }
});

server.listen(port, () => {
  console.log(`OlyState Pro API listening on http://localhost:${port}`);
  if (sentiKey()) {
    emitSenti("olystate_heartbeat", "heartbeat");
    setInterval(() => emitSenti("olystate_heartbeat", "heartbeat"), 45_000);
  }
  if (isHubConfigured()) {
    setInterval(() => void drainOutbox(), 5 * 60 * 1000);
  }
  // Mirror current connection settings to the hub once at startup so the
  // Control Center reflects this app's switchboard; fire-and-forget.
  void reportToHub(loadConnectionSettings(settingsPath));
});

process.on("SIGINT", () => {
  db.close();
  server.close(() => process.exit(0));
});
