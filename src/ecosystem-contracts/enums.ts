// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Ecosystem-wide enumerations.
 *
 * SourceApp, InternalSystem, ReadinessCategory, SyncPayloadType and the
 * session/race enums originate from the Olbrecht Energy Tracker sync domain
 * (donated per INTEGRATION_PLAN.md Phase 2, decision 3). SourceApp is
 * extended from the original two values to the full ecosystem, and three
 * payload types are added: BiomechReportUpsert, MovementRedFlagUpsert,
 * ObservationUpsert.
 *
 * 2026-08-12 (RAI_DECISIONS.md, RECOVERY_AI_BUILD_PLAN.md Increment 1):
 * SourceApp gains RecoveryAI; SyncPayloadType gains RecoveryPlanUpsert and
 * RecoveryActionUpsert; ModalityTier, ScreeningSource and RecoveryPlanStatus
 * are added to support them. See src/payloads/recovery.ts.
 */

export enum SourceApp {
  AthleteOS = 'athleteOS',
  SwimStatePro = 'swimStatePro',
  OlbrechtSystem = 'olbrechtSystem',
  FormLab = 'formLab',
  TriathletePro = 'triathletePro',
  OlyStatePro = 'olyStatePro',
  SentiOS = 'sentiOS',
  RecoveryAI = 'recoveryAI',
}

export enum InternalSystem {
  Neurological = 'neurological',
  Muscular = 'muscular',
  Cardiovascular = 'cardiovascular',
}

export enum ReadinessCategory {
  Green = 'green',
  Yellow = 'yellow',
  Orange = 'orange',
  Red = 'red',
}

export enum SessionClass {
  NeuralSprint = 'neuralSprint',
  MusclePowerEndurance = 'musclePowerEndurance',
  AnaerobicCapacity = 'anaerobicCapacity',
  RacePace = 'racePace',
  AerobicBase = 'aerobicBase',
  ThresholdAerobicPower = 'thresholdAerobicPower',
  RecoveryTechnique = 'recoveryTechnique',
}

export enum IntensityDomain {
  Low = 'low',
  Moderate = 'moderate',
  Heavy = 'heavy',
  Severe = 'severe',
  Extreme = 'extreme',
}

export enum EnergySystemFocus {
  Neurological = 'neurological',
  Muscular = 'muscular',
  Cardiovascular = 'cardiovascular',
}

export enum PaceAnchorType {
  EventPace = 'eventPace',
  CriticalVelocity = 'criticalVelocity',
  Sprint = 'sprint',
}

export enum PoolCourse {
  Lcm = 'lcm',
  Scm = 'scm',
  Yards = 'yards',
  OpenWater = 'openWater',
}

export enum RacePriority {
  Low = 'low',
  Secondary = 'secondary',
  Primary = 'primary',
}

export enum MismatchComponent {
  Intent = 'intent',
  IntensityDomain = 'intensityDomain',
  TechnicalDegradation = 'technicalDegradation',
  Perceptual = 'perceptual',
  AutonomicRecovery = 'autonomicRecovery',
}

export enum RecommendationCode {
  MaintainLoad = 'maintainLoad',
  TightenLoad = 'tightenLoad',
  ReduceLoad = 'reduceLoad',
  AdjustRestStructure = 'adjustRestStructure',
  PrioritizeMeasurementCapture = 'prioritizeMeasurementCapture',
  ScheduleRecoveryTechnique = 'scheduleRecoveryTechnique',
  ProtectTaper = 'protectTaper',
}

export enum WarningCode {
  RepeatedMismatch = 'repeatedMismatch',
  SlowedHeartRateRecovery = 'slowedHeartRateRecovery',
  MusclePowerEnduranceFrequency = 'musclePowerEnduranceFrequency',
  DataReliability = 'dataReliability',
  LowDataQuality = 'lowDataQuality',
  MixedIntent = 'mixedIntent',
}

export enum SessionLinkType {
  Plan = 'plan',
  Response = 'response',
  DerivedMetrics = 'derivedMetrics',
}

export enum SyncPayloadType {
  AthleteUpsert = 'athleteUpsert',
  SessionPlanUpsert = 'sessionPlanUpsert',
  SessionResponseUpsert = 'sessionResponseUpsert',
  DerivedMetricsUpsert = 'derivedMetricsUpsert',
  ReadinessSnapshotUpsert = 'readinessSnapshotUpsert',
  RaceEventUpsert = 'raceEventUpsert',
  BiomechReportUpsert = 'biomechReportUpsert',
  MovementRedFlagUpsert = 'movementRedFlagUpsert',
  ObservationUpsert = 'observationUpsert',
  RecoveryPlanUpsert = 'recoveryPlanUpsert',
  RecoveryActionUpsert = 'recoveryActionUpsert',
}

/**
 * Modality administration-risk tier (RAI_DECISIONS.md D1, ratified
 * 2026-08-12). Tier C items are advisory-only: a plan may name them with
 * rationale but must never carry a numeric dose for them — enforced at the
 * type level in RecoveryPlanUpsertPayload.
 */
export enum ModalityTier {
  /** Self-administered, low risk (sleep, naps, mobility, hydration, ...). */
  A = 'A',
  /** Equipment/supervision (massage, sauna, CWI, percussive, PBM, ...). */
  B = 'B',
  /** Clinically adjacent (WBC, BFR, EMS/NMES, PEMF, hypoxic). Advisory only. */
  C = 'C',
}

/**
 * Who performed the contraindication screen backing a plan (RAI_DECISIONS.md
 * D2): all three are accepted as sources, provenance is always recorded, and
 * Tier B prescriptions require coach-or-above.
 */
export enum ScreeningSource {
  Athlete = 'athlete',
  Coach = 'coach',
  Practitioner = 'practitioner',
}

export enum RecoveryPlanStatus {
  Active = 'active',
  Superseded = 'superseded',
  /** Emitted when safety inputs are missing — plan carries no items (fail-closed). */
  ScreeningIncomplete = 'screeningIncomplete',
}

export enum AdherenceLevel {
  Skipped = 'skipped',
  Partial = 'partial',
  Full = 'full',
}

/** Sport context for multi-sport payloads (FormLab and OlyState cover lifting). */
export enum SportContext {
  Swim = 'swim',
  Bike = 'bike',
  Run = 'run',
  Lift = 'lift',
  Other = 'other',
}

export enum MovementRedFlagSeverity {
  Info = 'info',
  Caution = 'caution',
  Warning = 'warning',
  Critical = 'critical',
}

export const SOURCE_APPS = Object.values(SourceApp);
export const SYNC_PAYLOAD_TYPES = Object.values(SyncPayloadType);
export const INTERNAL_SYSTEMS = [
  InternalSystem.Neurological,
  InternalSystem.Muscular,
  InternalSystem.Cardiovascular,
] as const;
