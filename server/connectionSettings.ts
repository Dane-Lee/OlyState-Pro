/**
 * Server-side connection settings for OlyState Pro (milestone
 * eco-connection-settings; Control Center ratification 2026-07-11).
 *
 * The operator's per-flow switchboard: each outbound/inbound payload type
 * can be 'on' (default), 'pause' (keep queuing locally, stop transmitting),
 * or 'off' (stop queuing too). Hub publishing here runs entirely
 * SERVER-SIDE (server/index.ts) — the service key never reaches the
 * browser — so settings storage matches that shape: a JSON file next to
 * the SQLite DB, not localStorage. Mirrored to the hub
 * (PUT /api/ecosystem/connections) so the Control Center can render every
 * app's switchboard from one place. Everything degrades silently to
 * default-open: a missing file, malformed JSON, or an unreachable hub all
 * preserve the standalone guarantee (ecosystem rule 1) — settings only
 * ever REDUCE traffic, never invent it.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import {
  DEFAULT_CONNECTION_SETTINGS,
  parseConnectionSettings,
} from "../src/ecosystem-contracts/connections";
import type { ConnectionSettings, ConnectionState } from "../src/ecosystem-contracts/connections";
import type { SyncPayloadType } from "../src/ecosystem-contracts/enums";

export type { ConnectionSettings, ConnectionState };
export {
  inboundState,
  outboundState,
  shouldEnqueue,
  shouldTransmit,
} from "../src/ecosystem-contracts/connections";

const SETTINGS_FILE_NAME = "connection-settings.json";

/** Settings file lives next to the SQLite DB (see OLYSTATE_DB_PATH), not in browser storage. */
export function connectionSettingsPath(dbPath: string): string {
  return join(dirname(resolve(dbPath)), SETTINGS_FILE_NAME);
}

/** Reads current settings; a missing file or malformed JSON reads as default-open. */
export function loadConnectionSettings(settingsPath: string): ConnectionSettings {
  try {
    if (!existsSync(settingsPath)) return DEFAULT_CONNECTION_SETTINGS;
    return parseConnectionSettings(readFileSync(settingsPath, "utf8"));
  } catch {
    return DEFAULT_CONNECTION_SETTINGS;
  }
}

/** Persists settings to disk, stamping updatedAt. Never throws. */
export function saveConnectionSettings(
  settingsPath: string,
  settings: ConnectionSettings
): ConnectionSettings {
  const stamped: ConnectionSettings = { ...settings, updatedAt: new Date().toISOString() };
  try {
    mkdirSync(dirname(settingsPath), { recursive: true });
    writeFileSync(settingsPath, JSON.stringify(stamped, null, 2), "utf8");
  } catch {
    // Disk unavailable: the caller still gets the stamped settings back for
    // this call, only durable persistence failed. Errs toward the same
    // default-open behavior as a missing file, never toward blocking sync.
  }
  return stamped;
}

/** Mutator: flip one flow (outbound or inbound, by payload type) and persist. */
export function setConnectionState(
  settingsPath: string,
  direction: "outbound" | "inbound",
  payloadType: SyncPayloadType,
  state: ConnectionState
): ConnectionSettings {
  const current = loadConnectionSettings(settingsPath);
  return saveConnectionSettings(settingsPath, {
    ...current,
    [direction]: { ...current[direction], [payloadType]: state },
  });
}

/**
 * Mirrors settings to the hub so the Control Center can render this app's
 * switchboard. Fire-and-forget: never throws, no-ops when the hub isn't
 * configured. Uses the same x-service-key auth as /api/sync/push and
 * /api/registry/athletes; the hub's PUT /connections route reads app
 * identity from the service key (not the body), so the body is the
 * settings object itself, unwrapped.
 */
export async function reportToHub(
  settings: ConnectionSettings,
  options: { hubUrl?: string; serviceKey?: string; fetchImpl?: typeof fetch } = {}
): Promise<void> {
  const hubUrl = (options.hubUrl ?? process.env.ATHLETEOS_HUB_URL)?.replace(/\/$/, "");
  const serviceKey = options.serviceKey ?? process.env.ATHLETEOS_SERVICE_KEY;
  if (!hubUrl || !serviceKey) return;
  const fetchImpl = options.fetchImpl ?? fetch;
  try {
    await fetchImpl(`${hubUrl}/api/ecosystem/connections`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-service-key": serviceKey },
      body: JSON.stringify(settings),
    });
  } catch {
    // Report is cosmetic (Control Center panel freshness); enforcement of
    // pause/off stays fully local regardless of whether the mirror lands.
  }
}
