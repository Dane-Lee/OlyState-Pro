import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildObservationDraft,
  collectPublishableObservations,
  resolveObservationAthleteId,
} from "./ecosystemEnvelope";
import type { Observation, OlyStateDataSet } from "./types";

const observation = (over: Partial<Observation> = {}): Observation => ({
  id: "obs-1",
  timestamp: "2026-07-10T09:00:00.000Z",
  source: "coach-entry",
  sourceType: "manual",
  metric: "snatch_technical_quality",
  value: 7,
  unit: "score_0_10",
  confidence: 0.85,
  sessionId: "sess-1",
  ...over,
});

const dataSet = (): Pick<OlyStateDataSet, "athletes" | "sessions" | "plannedSessions"> =>
  ({
    athletes: [{ id: "ath-9" }],
    sessions: [{ id: "sess-1", athleteId: "ath-9" }],
    plannedSessions: [{ id: "plan-1", athleteId: "ath-9" }],
  }) as unknown as Pick<OlyStateDataSet, "athletes" | "sessions" | "plannedSessions">;

describe("buildObservationDraft", () => {
  it("maps the observation near-1:1 with sport=lift and metric-keyed values", () => {
    const draft = buildObservationDraft(observation());

    assert.equal(draft.observationId, "obs-1");
    assert.equal(draft.sport, "lift");
    assert.equal(draft.sourceType, "manual");
    assert.equal(draft.observationKind, "snatch_technical_quality");
    assert.equal(draft.values.snatch_technical_quality, 7);
    assert.equal(draft.values.unit, "score_0_10");
    assert.equal(draft.confidence0to1, 0.85);
    assert.equal(draft.linkedSessionId, "sess-1");
  });

  it("clamps confidence into 0..1", () => {
    assert.equal(buildObservationDraft(observation({ confidence: 3 })).confidence0to1, 1);
    assert.equal(buildObservationDraft(observation({ confidence: -1 })).confidence0to1, 0);
  });

  it("carries FormLab-sourced observations with their source type intact", () => {
    const draft = buildObservationDraft(observation({ sourceType: "video_formlab" }));
    assert.equal(draft.sourceType, "video_formlab");
  });
});

describe("resolveObservationAthleteId", () => {
  it("prefers a valid direct athleteId for session-less observations", () => {
    assert.equal(
      resolveObservationAthleteId(
        observation({ athleteId: "ath-9", sessionId: undefined }),
        dataSet()
      ),
      "ath-9"
    );
    assert.equal(
      resolveObservationAthleteId(
        observation({ athleteId: "missing", sessionId: undefined }),
        dataSet()
      ),
      undefined
    );
  });

  it("resolves through actual sessions and planned sessions", () => {
    assert.equal(resolveObservationAthleteId(observation(), dataSet()), "ath-9");
    assert.equal(
      resolveObservationAthleteId(observation({ sessionId: "plan-1" }), dataSet()),
      "ath-9"
    );
  });

  it("returns undefined without a session linkage", () => {
    assert.equal(resolveObservationAthleteId(observation({ sessionId: undefined }), dataSet()), undefined);
    assert.equal(resolveObservationAthleteId(observation({ sessionId: "missing" }), dataSet()), undefined);
  });
});

describe("collectPublishableObservations", () => {
  it("keeps athlete-resolvable observations and skips orphans", () => {
    const set = {
      athletes: [{ id: "ath-9" }],
      sessions: [{ id: "sess-1", athleteId: "ath-9" }],
      plannedSessions: [],
      observations: [
        observation(),
        observation({ id: "obs-2", athleteId: "ath-9", sessionId: undefined }),
        observation({ id: "obs-3", sessionId: undefined }),
      ],
    } as unknown as OlyStateDataSet;

    const publishable = collectPublishableObservations(set);
    assert.equal(publishable.length, 2);
    assert.equal(publishable[0].athleteId, "ath-9");
    assert.equal(publishable[0].draft.observationId, "obs-1");
    assert.equal(publishable[1].draft.observationId, "obs-2");
  });
});
