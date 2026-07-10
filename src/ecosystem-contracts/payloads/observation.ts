// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Normalized observation payload — NEW, modeled on OlyState Pro's
 * observation-first architecture so manual entries and future sensor sources
 * share one shape. OlyState's `video_formlab` source type maps onto
 * sourceType "video_formlab" here, which is how FormLab lift analyses arrive
 * as OlyState observations.
 */
import type { JsonObject, Rfc3339Timestamp, UUID } from '../common';
import { SportContext } from '../enums';

export interface ObservationUpsertPayload {
  sharedAthleteId: UUID;
  observationId: UUID;
  observedAt: Rfc3339Timestamp;
  sport: SportContext;
  /** e.g. "manual", "video_formlab", "bar_velocity", "force_plate". */
  sourceType: string;
  /** What was observed, producer-defined taxonomy, e.g. "snatch_attempt". */
  observationKind: string;
  /** Normalized measurement values keyed by metric name. */
  values: JsonObject;
  /** 0..1 producer confidence. */
  confidence0to1?: number;
  notes?: string;
  linkedSessionId?: UUID;
  createdAt: Rfc3339Timestamp;
}
