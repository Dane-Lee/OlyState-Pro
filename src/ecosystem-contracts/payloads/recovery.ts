// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * Recovery Programming AI payloads — NEW in the shared contracts
 * (RECOVERY_AI_BUILD_PLAN.md Increment 1; decisions ratified 2026-08-12 in
 * RAI_DECISIONS.md). Two payload types:
 *
 * - RecoveryPlanUpsert: the product — a modality plan derived from fatigue
 *   state. Tier A/B items carry a structured dose; Tier C items are advisory
 *   only and structurally cannot carry one (D1). Screening provenance is
 *   stamped on every plan (D2); a plan with no valid screening is emitted as
 *   `screeningIncomplete` with zero prescribed items (fail-closed on safety).
 * - RecoveryActionUpsert: first-party adherence capture (D3) — the producer
 *   side of the readiness spec's `e_modalityUsed` / `e_modalityMinutes`,
 *   `M_recovery_s`, and `β·e_recovery_actions` inputs, which no app feeds
 *   today. Consumers scale doses into their own fatigue models.
 */
import type {
  JsonObject,
  Rfc3339Timestamp,
  UUID,
} from '../common';
import {
  AdherenceLevel,
  InternalSystem,
  ModalityTier,
  RecoveryPlanStatus,
  ScreeningSource,
} from '../enums';

/** Structured dose for a self-administrable or supervised modality. */
export interface ModalityDose {
  /** Prescribed duration in minutes. */
  durationMinutes: number;
  /** Free-form intensity descriptor (e.g. "12 °C", "70% pressure", "RPE 3"). */
  intensity?: string;
  /** Suggested timing relative to training (e.g. "within 2h post-session"). */
  timing?: string;
  /** Doses per day when more than one application is intended. */
  frequencyPerDay?: number;
}

/**
 * A Tier A or B plan item: named modality + structured dose. Tier B items
 * additionally state their preconditions (equipment, supervision).
 */
export interface PrescribedModalityItem {
  /** Stable registry code, e.g. "coldWaterImmersion", "sleepExtension". */
  modalityCode: string;
  tier: ModalityTier.A | ModalityTier.B;
  dose: ModalityDose;
  /** Systems this item targets, 0..1 relative emphasis per system. */
  targetSystems: Readonly<Partial<Record<InternalSystem, number>>>;
  /** Why the engine selected it, coach-readable. */
  rationale: string;
  /** Tier B only: stated preconditions (equipment, supervision, screening). */
  preconditions?: readonly string[];
  /** Evidence grade from the modality registry, e.g. "strong", "moderate". */
  evidenceGrade?: string;
}

/**
 * A Tier C advisory: the modality is named with rationale but never dosed
 * (D1 — the type carries no dose field by design; do not add one).
 */
export interface AdvisoryModalityItem {
  modalityCode: string;
  tier: ModalityTier.C;
  targetSystems: Readonly<Partial<Record<InternalSystem, number>>>;
  rationale: string;
  /** Screening provenance restated on every Tier C advisory (D2). */
  screeningSource: ScreeningSource;
  evidenceGrade?: string;
}

export interface RecoveryPlanUpsertPayload {
  sharedAthleteId: UUID;
  planId: UUID;
  /** Monotonic revision; a re-plan for the same day supersedes lower revisions. */
  planRevision: number;
  /** Local date the plan applies to. */
  planDate: string;
  timeZone: string;
  status: RecoveryPlanStatus;
  /**
   * Screening provenance for the whole plan (D2). Absent only when status is
   * `screeningIncomplete` — in that state prescribedItems MUST be empty and
   * advisoryItems MAY name Tier A modalities' codes as unscored suggestions.
   */
  screeningSource?: ScreeningSource;
  /** Version of the contraindication screening record the plan was gated on. */
  screeningRecordVersion?: number;
  /** Tier A/B items with structured doses. */
  prescribedItems: readonly PrescribedModalityItem[];
  /** Tier C advisories (and unscored suggestions when screening is incomplete). */
  advisoryItems: readonly AdvisoryModalityItem[];
  /** Fatigue state snapshot (F_i, 0..10 per system) the plan was derived from. */
  inputFatigueState?: Readonly<Partial<Record<InternalSystem, number>>>;
  /** Remaining recovery budget B[d] after allocation, engine units. */
  residualBudget?: number;
  /** Engine + config version that produced the plan. */
  engineVersion: string;
  configVersion?: string;
  /** Structured extras (calibration flags, OlyState 4→3 mapping flag, ...). */
  extensions?: JsonObject;
  createdAt: Rfc3339Timestamp;
}

export interface RecoveryActionUpsertPayload {
  sharedAthleteId: UUID;
  actionId: UUID;
  /** Plan this action responds to, when it was prescribed (ad-hoc = absent). */
  linkedPlanId?: UUID;
  modalityCode: string;
  tier: ModalityTier;
  /** When the modality was actually performed. */
  performedAt: Rfc3339Timestamp;
  /** Actual duration in minutes — the readiness spec's `e_modalityMinutes`. */
  durationMinutes: number;
  adherence: AdherenceLevel;
  /** Actual intensity as performed, free-form (mirrors ModalityDose.intensity). */
  intensity?: string;
  /** Athlete-reported response, e.g. 0..10 perceived benefit. */
  perceivedBenefit0to10?: number;
  notes?: string;
  createdAt: Rfc3339Timestamp;
}
