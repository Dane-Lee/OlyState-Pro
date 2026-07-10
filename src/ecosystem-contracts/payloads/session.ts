// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Session payloads, donated unchanged from the Olbrecht Energy Tracker sync
 * domain (engineering-lock compatible). Field semantics follow the
 * Olbrecht_Final_Engineering_Lock_Specification.
 */
import type {
  CoachFocusTag,
  IanaTimeZone,
  LocalDate,
  Rfc3339Timestamp,
  UUID,
} from '../common';
import {
  EnergySystemFocus,
  IntensityDomain,
  InternalSystem,
  PaceAnchorType,
  PoolCourse,
  RacePriority,
  SessionClass,
  SourceApp,
} from '../enums';

export type SessionRpeScaleType = string;
export type SessionResponseDataSource = string;

export interface SessionRpeEntry {
  value: number;
  scaleType: SessionRpeScaleType;
}

export interface ReadinessInputs {
  readinessScore: number;
  focusScore: number;
  intensityPerception: number;
  fatigueIndicators: Readonly<Record<InternalSystem, number>>;
}

export interface HooperInputs {
  sleepQuality: number;
  stress: number;
  fatigue: number;
  muscleSoreness: number;
}

export interface HeartRateSummary {
  averageBpm?: number;
  peakBpm?: number;
  zoneDistribution?: Readonly<Record<string, number>>;
}

export interface PostMainSetHeartRateRecovery {
  hrAtEndMainSet: number;
  hrAfter1Min?: number;
  hrAfter3Min?: number;
  hrAfter5Min?: number;
  recoveryDrop: {
    oneMinute?: number;
    threeMinute?: number;
    fiveMinute?: number;
  };
}

export interface StrokeMetrics {
  distancePerStroke?: number;
  strokeLengthPerCycle?: number;
  strokeIndex?: number;
  swolf?: number;
  strokeRate?: number;
  strokeIndexSeries?: readonly number[];
  swolfSeries?: readonly number[];
}

export interface IntervalTimeEntry {
  setIndex: number;
  repeatIndex: number;
  distanceMeters: number;
  seconds: number;
  restSeconds?: number;
  stroke?: string;
  techniqueTag?: string;
  heartRateBpm?: number;
}

export interface IntervalSet {
  setIndex: number;
  setLabel: string;
  primaryStroke: string;
  equipmentTags: readonly string[];
  repeatDistanceMeters: number;
  repeatCount: number;
  targetPaceSeconds: number;
  targetPaceAnchorType: PaceAnchorType | null;
  restSeconds: number;
  blockRestSeconds: number | null;
  drillTag: string | null;
  intensityDomain: IntensityDomain;
}

export interface AthleteUpsertProfile {
  givenName: string;
  familyName: string;
  dateOfBirth?: LocalDate;
  sex?: string;
  primaryTeamId?: string;
  timezone: IanaTimeZone;
  createdAt: Rfc3339Timestamp;
  updatedAt: Rfc3339Timestamp;
}

export interface AthleteUpsertPayload {
  sharedAthleteId: UUID;
  sourceAthleteId: UUID;
  sourceApp: SourceApp;
  externalStableKey?: string;
  profile: AthleteUpsertProfile;
}

export interface SessionPlanUpsertPayload {
  sharedAthleteId: UUID;
  planId: UUID;
  planRevision: number;
  startTimestamp: Rfc3339Timestamp;
  timeZone: IanaTimeZone;
  poolCourse: PoolCourse;
  plannedTotalDistanceMeters: number;
  plannedDurationMinutes: number;
  intendedSessionClass: SessionClass;
  intendedEnergySystemFocus: EnergySystemFocus;
  intervalSets: readonly IntervalSet[];
  coachFocusTag: CoachFocusTag;
  notes?: string;
  createdAt: Rfc3339Timestamp;
  updatedAt: Rfc3339Timestamp;
}

export interface SessionResponseUpsertPayload {
  sharedAthleteId: UUID;
  responseId: UUID;
  responseRevision: number;
  linkedPlanId?: UUID;
  startTimestamp: Rfc3339Timestamp;
  timeZone: IanaTimeZone;
  actualTotalDistanceMeters: number;
  actualDurationMinutes: number;
  sessionRPE: SessionRpeEntry;
  readinessInputs: ReadinessInputs;
  hooperInputs?: HooperInputs;
  heartRateSummary?: HeartRateSummary;
  postMainSetHeartRateRecovery?: PostMainSetHeartRateRecovery;
  strokeMetrics?: StrokeMetrics;
  intervalTimes?: readonly IntervalTimeEntry[];
  dataSource: SessionResponseDataSource;
  supersededByResponseId?: UUID;
  createdAt: Rfc3339Timestamp;
  updatedAt: Rfc3339Timestamp;
}

export interface RaceEventUpsertPayload {
  sharedAthleteId: UUID;
  raceEventId: UUID;
  eventDate: LocalDate;
  course: PoolCourse;
  priority: RacePriority;
  targetEvents: readonly string[];
  taperStartDate?: LocalDate;
  taperEndDate?: LocalDate;
  createdAt: Rfc3339Timestamp;
  updatedAt: Rfc3339Timestamp;
}
