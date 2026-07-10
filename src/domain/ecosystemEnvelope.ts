/**
 * Observation → ecosystem ObservationUpsert adapter (milestone
 * osp-observation-envelopes).
 *
 * OlyState's normalized observation model was the template for the contract
 * payload, so the mapping is near-1:1. The athlete is resolved through the
 * observation's session (observations carry sessionId, sessions carry
 * athleteId); observations without a resolvable athlete are not publishable
 * and are skipped by the caller.
 */
import { SportContext } from "../ecosystem-contracts/enums";
import type { ObservationUpsertPayload } from "../ecosystem-contracts/payloads/observation";
import type { Observation, OlyStateDataSet } from "./types";

export type ObservationDraft = Omit<ObservationUpsertPayload, "sharedAthleteId">;

export function buildObservationDraft(observation: Observation): ObservationDraft {
  const values: Record<string, string | number | boolean> = {
    [observation.metric]: observation.value,
  };
  if (observation.unit) values.unit = observation.unit;
  if (observation.bodyRegion) values.bodyRegion = observation.bodyRegion;
  if (observation.exerciseId) values.exerciseId = observation.exerciseId;
  if (observation.setId) values.setId = observation.setId;
  if (observation.repId) values.repId = observation.repId;

  return {
    observationId: observation.id,
    observedAt: observation.timestamp,
    sport: SportContext.Lift,
    sourceType: observation.sourceType,
    observationKind: observation.metric,
    values,
    confidence0to1: Math.max(0, Math.min(1, observation.confidence)),
    notes: observation.notes,
    linkedSessionId: observation.sessionId,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Resolves the local athlete for an observation via its session. Returns
 * undefined when the observation has no session linkage (not publishable).
 */
export function resolveObservationAthleteId(
  observation: Observation,
  dataSet: Pick<OlyStateDataSet, "sessions" | "plannedSessions">
): string | undefined {
  if (!observation.sessionId) return undefined;
  const session =
    dataSet.sessions.find((candidate) => candidate.id === observation.sessionId) ??
    dataSet.plannedSessions.find((candidate) => candidate.id === observation.sessionId);
  return session?.athleteId;
}

/** All publishable (athlete-resolvable) observation drafts in a dataset. */
export function collectPublishableObservations(
  dataSet: OlyStateDataSet
): { athleteId: string; draft: ObservationDraft }[] {
  const drafts: { athleteId: string; draft: ObservationDraft }[] = [];
  for (const observation of dataSet.observations) {
    const athleteId = resolveObservationAthleteId(observation, dataSet);
    if (!athleteId) continue;
    drafts.push({ athleteId, draft: buildObservationDraft(observation) });
  }
  return drafts;
}
