// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Dependency-free runtime validation for envelopes at trust boundaries.
 * Structural checks only — payload-type-specific required fields are listed
 * in REQUIRED_PAYLOAD_FIELDS and verified for presence, not deep shape.
 * Deep validation belongs to the producing/consuming app's own logic.
 */
import type { AnySyncEnvelope } from './envelope';
import { SOURCE_APPS, SYNC_PAYLOAD_TYPES, SourceApp, SyncPayloadType } from './enums';

const ENVELOPE_REQUIRED_FIELDS = [
  'syncSchemaVersion',
  'sourceApp',
  'exportedAt',
  'idempotencyKey',
  'payloadType',
  'payload',
  'payloadSchemaVersion',
] as const;

export const REQUIRED_PAYLOAD_FIELDS: Readonly<Record<SyncPayloadType, readonly string[]>> = {
  [SyncPayloadType.AthleteUpsert]: ['sharedAthleteId', 'sourceAthleteId', 'sourceApp', 'profile'],
  [SyncPayloadType.SessionPlanUpsert]: ['sharedAthleteId', 'planId', 'planRevision', 'startTimestamp', 'timeZone'],
  [SyncPayloadType.SessionResponseUpsert]: ['sharedAthleteId', 'responseId', 'responseRevision', 'startTimestamp', 'timeZone'],
  [SyncPayloadType.DerivedMetricsUpsert]: ['sharedAthleteId', 'derivedId', 'linkedResponseId', 'engineVersion'],
  [SyncPayloadType.ReadinessSnapshotUpsert]: ['sharedAthleteId', 'snapshotDate', 'timeZone', 'systemReadinessCategory', 'globalReadinessCategory'],
  [SyncPayloadType.RaceEventUpsert]: ['sharedAthleteId', 'raceEventId', 'eventDate', 'course', 'priority'],
  [SyncPayloadType.BiomechReportUpsert]: ['sharedAthleteId', 'reportId', 'capturedAt', 'sport', 'movementElement', 'analysisMethod', 'metrics'],
  [SyncPayloadType.MovementRedFlagUpsert]: ['sharedAthleteId', 'redFlagId', 'observedAt', 'sport', 'dysfunctionCode', 'severity', 'recoveryCostEstimate'],
  [SyncPayloadType.ObservationUpsert]: ['sharedAthleteId', 'observationId', 'observedAt', 'sport', 'sourceType', 'observationKind', 'values'],
  [SyncPayloadType.RecoveryPlanUpsert]: ['sharedAthleteId', 'planId', 'planRevision', 'planDate', 'timeZone', 'status', 'prescribedItems', 'advisoryItems', 'engineVersion'],
  [SyncPayloadType.RecoveryActionUpsert]: ['sharedAthleteId', 'actionId', 'modalityCode', 'tier', 'performedAt', 'durationMinutes', 'adherence'],
};

export interface EnvelopeValidationResult {
  valid: boolean;
  errors: readonly string[];
}

export function validateEnvelope(input: unknown): EnvelopeValidationResult {
  const errors: string[] = [];
  if (typeof input !== 'object' || input === null) {
    return { valid: false, errors: ['Envelope must be an object.'] };
  }
  const env = input as Record<string, unknown>;

  for (const field of ENVELOPE_REQUIRED_FIELDS) {
    if (env[field] === undefined || env[field] === null) {
      errors.push(`Missing envelope field: ${field}`);
    }
  }
  if (typeof env.sourceApp === 'string' && !SOURCE_APPS.includes(env.sourceApp as SourceApp)) {
    errors.push(`Unknown sourceApp: ${env.sourceApp}`);
  }
  if (
    typeof env.payloadType === 'string' &&
    !SYNC_PAYLOAD_TYPES.includes(env.payloadType as SyncPayloadType)
  ) {
    errors.push(`Unknown payloadType: ${env.payloadType}`);
  }

  if (errors.length === 0) {
    const payload = env.payload as Record<string, unknown>;
    if (typeof payload !== 'object' || payload === null) {
      errors.push('payload must be an object.');
    } else {
      const required = REQUIRED_PAYLOAD_FIELDS[env.payloadType as SyncPayloadType] ?? [];
      for (const field of required) {
        if (payload[field] === undefined || payload[field] === null) {
          errors.push(`Missing ${String(env.payloadType)} payload field: ${field}`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export function isSyncEnvelope(input: unknown): input is AnySyncEnvelope {
  return validateEnvelope(input).valid;
}

export function assertSyncEnvelope(input: unknown): asserts input is AnySyncEnvelope {
  const result = validateEnvelope(input);
  if (!result.valid) {
    throw new Error(`Invalid sync envelope: ${result.errors.join('; ')}`);
  }
}
