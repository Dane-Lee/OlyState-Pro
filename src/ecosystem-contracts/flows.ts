// VENDORED from @ecosystem/contracts — do not edit here.
// Canonical source: MasterMind/packages/ecosystem-contracts/src. See VERSIONING.md.
// Re-vendor with: node scripts/vendor.mjs "<this-dir>"
/**
 * The canonical flow specification (eco-flow-spec): who produces each payload
 * type, who consumes it, in what direction and order, and on what cadence.
 * Direction and order follow the Unified Performance System documents;
 * transport is hub-and-spoke per the ratified plan, so every flow physically
 * traverses AthleteOS even when AthleteOS is not the logical consumer.
 */
import { SourceApp, SyncPayloadType } from './enums';

export interface FlowSpec {
  payloadType: SyncPayloadType;
  producers: readonly SourceApp[];
  /** Logical consumers; the hub stores everything regardless. */
  consumers: readonly SourceApp[];
  cadence: string;
  trigger: string;
  /** Position in the docs' canonical order (lower = earlier in the loop). */
  flowOrder: number;
}

export const FLOW_SPECS: readonly FlowSpec[] = [
  {
    payloadType: SyncPayloadType.AthleteUpsert,
    producers: [
      SourceApp.SwimStatePro,
      SourceApp.OlbrechtSystem,
      SourceApp.TriathletePro,
      SourceApp.OlyStatePro,
      SourceApp.FormLab,
    ],
    consumers: [SourceApp.AthleteOS],
    cadence: 'on change',
    trigger: 'Athlete created or profile updated in a spoke app',
    flowOrder: 0,
  },
  {
    payloadType: SyncPayloadType.BiomechReportUpsert,
    producers: [SourceApp.FormLab],
    consumers: [SourceApp.AthleteOS, SourceApp.OlyStatePro],
    cadence: 'per analysis',
    trigger: 'FormLab analysis completes',
    flowOrder: 1,
  },
  {
    payloadType: SyncPayloadType.MovementRedFlagUpsert,
    producers: [SourceApp.FormLab],
    consumers: [SourceApp.SwimStatePro, SourceApp.AthleteOS],
    cadence: 'per detection',
    trigger: 'FormLab detects movement dysfunction above threshold',
    flowOrder: 2,
  },
  {
    payloadType: SyncPayloadType.ReadinessSnapshotUpsert,
    producers: [SourceApp.SwimStatePro, SourceApp.OlbrechtSystem, SourceApp.TriathletePro, SourceApp.OlyStatePro],
    consumers: [SourceApp.OlbrechtSystem, SourceApp.AthleteOS],
    cadence: 'daily',
    trigger: 'Daily readiness calculation (or recalculation after new inputs)',
    flowOrder: 3,
  },
  {
    payloadType: SyncPayloadType.SessionPlanUpsert,
    producers: [SourceApp.OlbrechtSystem],
    consumers: [SourceApp.SwimStatePro, SourceApp.AthleteOS],
    cadence: 'per plan',
    trigger: 'Coach finalizes or revises a session plan',
    flowOrder: 4,
  },
  {
    payloadType: SyncPayloadType.SessionResponseUpsert,
    producers: [SourceApp.OlbrechtSystem, SourceApp.SwimStatePro],
    consumers: [SourceApp.AthleteOS],
    cadence: 'per session',
    trigger: 'Athlete/coach records a completed session',
    flowOrder: 5,
  },
  {
    payloadType: SyncPayloadType.DerivedMetricsUpsert,
    producers: [SourceApp.OlbrechtSystem, SourceApp.TriathletePro],
    consumers: [SourceApp.AthleteOS, SourceApp.SwimStatePro],
    cadence: 'per session',
    trigger: 'Engine finishes classifying a recorded session',
    flowOrder: 6,
  },
  {
    payloadType: SyncPayloadType.RaceEventUpsert,
    producers: [SourceApp.SwimStatePro, SourceApp.OlbrechtSystem],
    consumers: [SourceApp.AthleteOS, SourceApp.OlbrechtSystem, SourceApp.SwimStatePro],
    cadence: 'on change',
    trigger: 'Race/meet created or taper window adjusted',
    flowOrder: 7,
  },
  {
    payloadType: SyncPayloadType.ObservationUpsert,
    producers: [SourceApp.OlyStatePro, SourceApp.FormLab],
    consumers: [SourceApp.OlyStatePro, SourceApp.AthleteOS],
    cadence: 'per observation',
    trigger: 'Normalized observation recorded (manual or sensor/video derived)',
    flowOrder: 8,
  },
  {
    payloadType: SyncPayloadType.RecoveryPlanUpsert,
    producers: [SourceApp.RecoveryAI],
    consumers: [SourceApp.AthleteOS],
    cadence: 'daily',
    trigger: 'RecoveryAI generates or revises a recovery plan (RAI_DECISIONS.md A2/D1)',
    flowOrder: 9,
  },
  {
    payloadType: SyncPayloadType.RecoveryActionUpsert,
    producers: [SourceApp.RecoveryAI],
    consumers: [SourceApp.AthleteOS, SourceApp.SwimStatePro],
    cadence: 'per action',
    trigger: 'Athlete logs a completed recovery modality in RecoveryAI (RAI_DECISIONS.md D3/D7)',
    flowOrder: 10,
  },
];

export function flowsProducedBy(app: SourceApp): readonly FlowSpec[] {
  return FLOW_SPECS.filter((flow) => flow.producers.includes(app));
}

export function flowsConsumedBy(app: SourceApp): readonly FlowSpec[] {
  return FLOW_SPECS.filter((flow) => flow.consumers.includes(app));
}
