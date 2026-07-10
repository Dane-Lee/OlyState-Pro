// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * FormLab output payloads — NEW in the shared contracts (no prior design
 * existed in any codebase). Two payload types:
 *
 * - BiomechReportUpsert: a full analysis result summary for the hub and
 *   sport apps (joint angles, efficiency, legality notes live in `metrics`).
 * - MovementRedFlagUpsert: the docs' FormLab→Swim State flow — a movement
 *   dysfunction with an estimated recovery cost, consumed by readiness
 *   engines as additional fatigue/recovery input.
 */
import type {
  JsonObject,
  Rfc3339Timestamp,
  UUID,
} from '../common';
import {
  InternalSystem,
  MovementRedFlagSeverity,
  SportContext,
} from '../enums';

export interface BiomechReportUpsertPayload {
  sharedAthleteId: UUID;
  reportId: UUID;
  capturedAt: Rfc3339Timestamp;
  sport: SportContext;
  /** e.g. "freestyle", "start", "turn", "squat", "snatch". */
  movementElement: string;
  /** Engine identifier + version that produced the analysis. */
  analysisMethod: string;
  analysisVersion: string;
  /** 0..1 — producer's confidence in the analysis. */
  confidence0to1: number;
  /** Structured analysis outputs (drag, power, efficiency, angles, ...). */
  metrics: JsonObject;
  /** Human-readable summary suitable for coach display. */
  summary?: string;
  videoAssetRef?: string;
  linkedSessionId?: UUID;
  createdAt: Rfc3339Timestamp;
}

export interface MovementRedFlagUpsertPayload {
  sharedAthleteId: UUID;
  redFlagId: UUID;
  observedAt: Rfc3339Timestamp;
  sport: SportContext;
  movementElement: string;
  /** e.g. "strokeRateDropUnderFatigue", "kneeValgusOnLanding". */
  dysfunctionCode: string;
  description: string;
  severity: MovementRedFlagSeverity;
  /**
   * Estimated additional recovery cost per internal system, 0..1 relative
   * units (consumer scales into its own fatigue model). This is the field
   * Swim State Pro ingests as recovery-cost input.
   */
  recoveryCostEstimate: Readonly<Partial<Record<InternalSystem, number>>>;
  /** 0..1 — producer's confidence in the detection. */
  confidence0to1: number;
  linkedReportId?: UUID;
  linkedSessionId?: UUID;
  createdAt: Rfc3339Timestamp;
}
