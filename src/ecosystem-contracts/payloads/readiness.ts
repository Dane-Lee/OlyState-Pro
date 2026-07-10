// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Readiness snapshot payload — the additive merge of the Olbrecht
 * ReadinessSnapshotUpsertPayload (categories + -6..+4 fatigue scale) and the
 * Swim State Pro ReadinessLog (0-100 system scores, composite, confidence,
 * data quality). A producer fills the representation it natively computes;
 * categories are REQUIRED so every consumer has a common denominator.
 *
 * Mapping guidance for 0-100 producers (Swim State Pro, OlyState Pro,
 * Triathlete Pro): the producing adapter owns the score→category banding and
 * must report it in `categoryBanding` so consumers can audit the conversion.
 */
import type {
  DataConfidenceLevel,
  IanaTimeZone,
  JsonObject,
  LocalDate,
  Rfc3339Timestamp,
  SystemFatigueState,
  SystemScores0to100,
  UUID,
} from '../common';
import { InternalSystem, ReadinessCategory, SportContext } from '../enums';

export interface ReadinessDataQuality {
  hrvAvailable?: boolean;
  sleepQualityAvailable?: boolean;
  muscleSorenessAvailable?: boolean;
  trainingLoadComplete?: boolean;
  confidenceLevel: DataConfidenceLevel;
}

export interface ReadinessSnapshotUpsertPayload {
  sharedAthleteId: UUID;
  snapshotDate: LocalDate;
  timeZone: IanaTimeZone;
  sport?: SportContext;

  /** Common denominator — required from every producer. */
  systemReadinessCategory: Readonly<Record<InternalSystem, ReadinessCategory>>;
  globalReadinessCategory: ReadinessCategory;

  /** Olbrecht-native representation (-6..+4 per system). */
  systemFatigue?: SystemFatigueState;

  /** Swim State Pro-native representation (0-100 per system, higher = readier). */
  systemScores0to100?: SystemScores0to100;
  compositeScore0to100?: number;
  /** e.g. "green>=75,yellow>=55,orange>=35,red<35" — producer documents its banding. */
  categoryBanding?: string;

  psychScore0to100?: number;
  psychVolatilityPercent?: number;
  sleepScore?: number;

  dataQuality?: ReadinessDataQuality;
  /** Producer-specific extras that don't warrant schema changes. */
  extensions?: JsonObject;
  createdAt: Rfc3339Timestamp;
}
