// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * The sync envelope — the single wire format for all cross-app exchange.
 * Generalized from the Olbrecht Energy Tracker design (ratified decision 3).
 *
 * Transport (ratified decision 1): hub-and-spoke. Producers POST envelopes to
 * the AthleteOS hub (`/api/sync/push`); consumers GET them from
 * (`/api/sync/pull`). Producers keep a local outbox and retry with the same
 * idempotencyKey, which the hub deduplicates.
 */
import type { Rfc3339Timestamp, UUID } from './common';
import { SourceApp, SyncPayloadType } from './enums';
import type {
  AthleteUpsertPayload,
  RaceEventUpsertPayload,
  SessionPlanUpsertPayload,
  SessionResponseUpsertPayload,
} from './payloads/session';
import type { DerivedMetricsUpsertPayload } from './payloads/derived';
import type { ReadinessSnapshotUpsertPayload } from './payloads/readiness';
import type {
  BiomechReportUpsertPayload,
  MovementRedFlagUpsertPayload,
} from './payloads/biomech';
import type { ObservationUpsertPayload } from './payloads/observation';
import type {
  RecoveryActionUpsertPayload,
  RecoveryPlanUpsertPayload,
} from './payloads/recovery';

/** Version of the envelope format itself (not of payload schemas). */
export const SYNC_SCHEMA_VERSION = '1.0.0';

export interface SyncPayloadMap {
  [SyncPayloadType.AthleteUpsert]: AthleteUpsertPayload;
  [SyncPayloadType.SessionPlanUpsert]: SessionPlanUpsertPayload;
  [SyncPayloadType.SessionResponseUpsert]: SessionResponseUpsertPayload;
  [SyncPayloadType.DerivedMetricsUpsert]: DerivedMetricsUpsertPayload;
  [SyncPayloadType.ReadinessSnapshotUpsert]: ReadinessSnapshotUpsertPayload;
  [SyncPayloadType.RaceEventUpsert]: RaceEventUpsertPayload;
  [SyncPayloadType.BiomechReportUpsert]: BiomechReportUpsertPayload;
  [SyncPayloadType.MovementRedFlagUpsert]: MovementRedFlagUpsertPayload;
  [SyncPayloadType.ObservationUpsert]: ObservationUpsertPayload;
  [SyncPayloadType.RecoveryPlanUpsert]: RecoveryPlanUpsertPayload;
  [SyncPayloadType.RecoveryActionUpsert]: RecoveryActionUpsertPayload;
}

export type SyncPayload = SyncPayloadMap[SyncPayloadType];

export interface SyncEnvelope<TType extends SyncPayloadType = SyncPayloadType> {
  syncSchemaVersion: string;
  sourceApp: SourceApp;
  exportedAt: Rfc3339Timestamp;
  idempotencyKey: UUID;
  payloadType: TType;
  payload: SyncPayloadMap[TType];
  payloadSchemaVersion: string;
  externalTraceId?: string;
}

export type AnySyncEnvelope = {
  [TType in SyncPayloadType]: SyncEnvelope<TType>;
}[SyncPayloadType];

/** Hub response for a single pushed envelope (Olbrecht SyncPushResult shape). */
export interface SyncPushResult {
  idempotencyKey: UUID;
  accepted: boolean;
  /** True when the same idempotencyKey arrived before with different content. */
  conflictDetected: boolean;
  remoteTraceId?: string;
}

export interface SyncPushRequest {
  envelopes: readonly AnySyncEnvelope[];
}

export interface SyncPushResponse {
  results: readonly SyncPushResult[];
}

export interface SyncPullRequest {
  /** The consuming app (its own envelopes are excluded by the hub). */
  consumer: SourceApp;
  /** Opaque cursor from the previous pull; omit for from-the-beginning. */
  since?: string;
  /** Restrict to specific payload types; empty = all. */
  payloadTypes?: readonly SyncPayloadType[];
  limit?: number;
}

export interface SyncPullResponse {
  envelopes: readonly AnySyncEnvelope[];
  /** Pass back as `since` on the next pull. */
  nextCursor: string;
  hasMore: boolean;
}
