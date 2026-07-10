/**
 * OlyState Pro local persistence (milestone osp-exportable-persistence,
 * following Triathlete Pro's proven local-API + SQLite pattern per
 * APPROACH_SUGGESTIONS S3).
 *
 * Durable beyond localStorage: the dataset survives browser storage clears
 * and is file-backed (SQLite via node:sqlite). Also hosts the ecosystem
 * outbox + canonical athlete links so hub publishing runs SERVER-SIDE and
 * the service key never reaches the browser.
 */
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const nowIso = () => new Date().toISOString();
const asString = (value: unknown) => String(value ?? "");

export interface OutboxRow {
  id: string;
  idempotencyKey: string;
  payloadType: string;
  athleteId: string;
  payloadJson: string;
  attempts: number;
}

export class OlyStateDatabase {
  private db: DatabaseSync;

  constructor(path: string) {
    const resolved = resolve(path);
    mkdirSync(dirname(resolved), { recursive: true });
    this.db = new DatabaseSync(resolved);
    this.migrate();
  }

  close() {
    this.db.close();
  }

  private migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS dataset_snapshots (
        id TEXT PRIMARY KEY,
        payload_json TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ecosystem_athlete_links (
        athlete_id TEXT PRIMARY KEY,
        shared_athlete_id TEXT NOT NULL,
        match_method TEXT NOT NULL DEFAULT 'auto-resolve',
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS ecosystem_outbox (
        id TEXT PRIMARY KEY,
        idempotency_key TEXT NOT NULL UNIQUE,
        payload_type TEXT NOT NULL,
        athlete_id TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        created_at TEXT NOT NULL,
        sent_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_olystate_outbox_pending
        ON ecosystem_outbox (status, created_at);
    `);
  }

  /** Latest saved dataset, or undefined before first save. */
  loadDataset(): string | undefined {
    const row = this.db
      .prepare("SELECT payload_json FROM dataset_snapshots ORDER BY created_at DESC, id DESC LIMIT 1")
      .get();
    return row ? asString(row.payload_json) : undefined;
  }

  /** Persists a dataset snapshot (latest-wins reads; history retained). */
  saveDataset(payloadJson: string): void {
    this.db
      .prepare("INSERT INTO dataset_snapshots (id, payload_json, created_at) VALUES (?, ?, ?)")
      .run(randomUUID(), payloadJson, nowIso());
    // Retain a bounded history: keep the newest 20 snapshots.
    this.db.exec(`
      DELETE FROM dataset_snapshots WHERE id NOT IN (
        SELECT id FROM dataset_snapshots ORDER BY created_at DESC, id DESC LIMIT 20
      );
    `);
  }

  linkFor(athleteId: string): string | undefined {
    const row = this.db
      .prepare("SELECT shared_athlete_id FROM ecosystem_athlete_links WHERE athlete_id = ?")
      .get(athleteId);
    return row ? asString(row.shared_athlete_id) : undefined;
  }

  storeLink(athleteId: string, sharedAthleteId: string): void {
    this.db
      .prepare(`
        INSERT INTO ecosystem_athlete_links (athlete_id, shared_athlete_id, created_at)
        VALUES (?, ?, ?)
        ON CONFLICT(athlete_id) DO UPDATE SET shared_athlete_id = excluded.shared_athlete_id
      `)
      .run(athleteId, sharedAthleteId, nowIso());
  }

  enqueue(idempotencyKey: string, payloadType: string, athleteId: string, payloadJson: string): boolean {
    try {
      this.db
        .prepare(`
          INSERT INTO ecosystem_outbox (id, idempotency_key, payload_type, athlete_id, payload_json, created_at)
          VALUES (?, ?, ?, ?, ?, ?)
        `)
        .run(randomUUID(), idempotencyKey, payloadType, athleteId, payloadJson, nowIso());
      return true;
    } catch {
      return false; // duplicate idempotency key — already queued/sent
    }
  }

  pending(limit: number, maxAttempts: number): OutboxRow[] {
    return this.db
      .prepare(
        "SELECT id, idempotency_key, payload_type, athlete_id, payload_json, attempts FROM ecosystem_outbox WHERE status = ? AND attempts < ? ORDER BY created_at ASC LIMIT ?"
      )
      .all("pending", maxAttempts, limit)
      .map((row) => ({
        id: asString(row.id),
        idempotencyKey: asString(row.idempotency_key),
        payloadType: asString(row.payload_type),
        athleteId: asString(row.athlete_id),
        payloadJson: asString(row.payload_json),
        attempts: Number(row.attempts),
      }));
  }

  mark(id: string, status: "pending" | "sent" | "failed", attempts: number, lastError?: string): void {
    this.db
      .prepare("UPDATE ecosystem_outbox SET status = ?, attempts = ?, last_error = ?, sent_at = ? WHERE id = ?")
      .run(status, attempts, lastError ?? null, status === "sent" ? nowIso() : null, id);
  }
}
