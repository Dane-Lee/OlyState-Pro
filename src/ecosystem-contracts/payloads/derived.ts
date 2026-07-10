// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Derived metrics payload, donated unchanged from the Olbrecht Energy Tracker
 * sync domain. Carries the engine's post-session classification, mismatch,
 * fatigue, readiness, and recommendation outputs.
 */
import type {
  IntensityDomainDistribution,
  JsonObject,
  Rfc3339Timestamp,
  SessionClassDistribution,
  SystemFatigueState,
  SystemLoadVector,
  UUID,
} from '../common';
import {
  InternalSystem,
  MismatchComponent,
  ReadinessCategory,
  RecommendationCode,
  WarningCode,
} from '../enums';

export interface DerivedMetricsUpsertPayload {
  sharedAthleteId: UUID;
  derivedId: UUID;
  linkedResponseId: UUID;
  engineVersion: string;
  configVersion: string;
  inputHash: string;
  achievedClassDistribution: SessionClassDistribution;
  achievedIntensityDomainDistribution: IntensityDomainDistribution;
  mismatchSeverity0to100: number;
  mismatchComponents0to1: Readonly<Record<MismatchComponent, number>>;
  mismatchWeights: Readonly<Record<MismatchComponent, number>>;
  systemLoadRaw: SystemLoadVector;
  fatigueStateAfterDecay: SystemFatigueState;
  fatigueStateAfterCoupling: SystemFatigueState;
  fatigueStateAfterAccumulation: SystemFatigueState;
  recoveryDebt: number;
  systemReadinessCategory: Readonly<Record<InternalSystem, ReadinessCategory>>;
  globalReadinessCategory: ReadinessCategory;
  warnings: readonly WarningCode[];
  recommendationCode: RecommendationCode;
  recommendationDetail: JsonObject;
  createdAt: Rfc3339Timestamp;
}
