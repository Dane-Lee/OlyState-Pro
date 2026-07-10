// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
import { IntensityDomain, InternalSystem, SessionClass } from './enums';

export type UUID = string;
export type Rfc3339Timestamp = string;
export type LocalDate = string;
export type IanaTimeZone = string;
export type CoachFocusTag = string | readonly string[];

export type JsonPrimitive = string | number | boolean | null;
export interface JsonObject {
  readonly [key: string]: JsonValue;
}
export interface JsonArray extends ReadonlyArray<JsonValue> {}
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

/**
 * Fatigue scale shared with the Olbrecht engineering lock: -6 (crashed)
 * through +4 (supercompensated), 0 = baseline.
 */
export const FATIGUE_SCALE = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4] as const;
export type FatigueLevel = (typeof FATIGUE_SCALE)[number];

export type SessionClassDistribution = Readonly<Record<SessionClass, number>>;
export type IntensityDomainDistribution = Readonly<Record<IntensityDomain, number>>;
export type SystemLoadVector = Readonly<Record<InternalSystem, number>>;
export type SystemFatigueState = Readonly<Record<InternalSystem, FatigueLevel>>;

/**
 * 0-100 per-system scores as produced by Swim State Pro's readiness engine
 * (higher = more ready). Distinct from SystemFatigueState, which uses the
 * Olbrecht -6..+4 fatigue scale. A snapshot may carry either or both; see
 * ReadinessSnapshotUpsertPayload.
 */
export interface SystemScores0to100 {
  neurological: number;
  muscular: number;
  cardiovascular: number;
}

export type DataConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW';
