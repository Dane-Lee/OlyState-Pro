import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { initialDataSet } from "./sampleData";
import {
  applyRecoveryDecay,
  applySessionToState,
  adjustPlannedSession,
  calculateSessionLoad,
  calculateTechnicalReadiness,
  convertPlannedSessionToActual,
  createSystemVector,
  evaluateAthlete,
  reviewPlannedSession
} from "./engine";
import { formatBodyweightClass } from "./iwfCategories";
import type { AthleteProfile, WeightliftingSession } from "./types";

const athlete = initialDataSet.athletes[0];

function cloneAthlete(patch: Partial<AthleteProfile> = {}): AthleteProfile {
  return {
    ...athlete,
    ...patch,
    personalBests: { ...athlete.personalBests, ...patch.personalBests },
    systemState: patch.systemState ?? createSystemVector(0)
  };
}

function makeSession(patch: Partial<WeightliftingSession> = {}): WeightliftingSession {
  return {
    id: "test_session",
    athleteId: athlete.id,
    title: "Test session",
    date: new Date().toISOString(),
    mode: "actual",
    durationMinutes: 90,
    wellness: {
      sleepQuality: 0.75,
      hrvRmssd: 70,
      restingHr: 50,
      stress: 0.3,
      soreness: 0.2,
      subjectiveReadiness: 0.75
    },
    painRatings: {},
    entries: [
      {
        id: "entry",
        exerciseId: "snatch",
        name: "Snatch",
        category: "snatch",
        sets: [
          { id: "s1", reps: 1, loadKg: 70, percentOfMax: 85, rpe: 8, made: true, technicalQuality: 8 },
          { id: "s2", reps: 1, loadKg: 74, percentOfMax: 90, rpe: 9, made: true, technicalQuality: 7.5 }
        ]
      }
    ],
    ...patch
  };
}

describe("OlyState engine", () => {
  it("keeps the sign convention: training pushes state downward and recovery restores toward zero", () => {
    const state = createSystemVector(0);
    const session = makeSession();
    const load = calculateSessionLoad(session, athlete);
    const afterTraining = applySessionToState(state, load, session);

    assert.ok(afterTraining.neural < 0);
    assert.ok(afterTraining.muscular < 0);

    const afterRecovery = applyRecoveryDecay(afterTraining, 48, 0.8);
    assert.ok(afterRecovery.neural > afterTraining.neural);
    assert.ok(afterRecovery.neural <= 0);
  });

  it("allocates snatch work mainly to neural and technical load", () => {
    const load = calculateSessionLoad(makeSession(), athlete);

    assert.ok(load.systemLoad.neural > load.systemLoad.autonomic);
    assert.ok(load.technicalLoad > 0);
    assert.equal(load.dominantCategories[0], "snatch");
  });

  it("penalizes technical readiness after repeated heavy misses", () => {
    const cleanMisses = Array.from({ length: 4 }, (_, index) =>
      makeSession({
        id: `miss_${index}`,
        date: new Date(Date.now() - index * 86_400_000).toISOString(),
        entries: [
          {
            id: `entry_${index}`,
            exerciseId: "clean-jerk",
            name: "Clean & jerk",
            category: "clean_jerk",
            sets: [
              { id: `set_${index}`, reps: 1, loadKg: 98, percentOfMax: 94, rpe: 9.5, made: false, technicalQuality: 5.5 }
            ]
          }
        ]
      })
    );

    assert.ok(calculateTechnicalReadiness(cleanMisses) < 60);
  });

  it("activates pain guardrails when regional pain is high", () => {
    const painful = makeSession({
      painRatings: { knee: 7 },
      entries: [
        {
          id: "squat",
          exerciseId: "front-squat",
          name: "Front squat",
          category: "squat",
          sets: [{ id: "set", reps: 3, loadKg: 98, percentOfMax: 83, rpe: 8.5, made: true, technicalQuality: 7, painRegions: ["knee"] }]
        }
      ]
    });

    const snapshot = evaluateAthlete(athlete, [painful]);
    assert.equal(snapshot.warnings.some((warning) => warning.id === "pain-knee"), true);
  });

  it("reviewPlannedSession returns constraints for an aggressive plan after suppressed state", () => {
    const suppressed = cloneAthlete({
      systemState: {
        neural: -4,
        muscular: -3,
        connective: -2,
        autonomic: -3
      },
      stateUpdatedAt: new Date().toISOString()
    });
    const planned = makeSession({
      id: "planned",
      mode: "planned",
      entries: [
        {
          id: "heavy",
          exerciseId: "clean-jerk",
          name: "Clean & jerk",
          category: "clean_jerk",
          sets: [{ id: "set", reps: 1, loadKg: 98, percentOfMax: 94, rpe: 9, made: true, technicalQuality: 8 }]
        }
      ]
    });

    const review = reviewPlannedSession(suppressed, [], planned);
    assert.ok(review.globalReadiness < 50);
    assert.ok(review.recommendations.length > 0);
  });

  it("adjustPlannedSession caps classic lifts when neural readiness is suppressed", () => {
    const suppressed = cloneAthlete({
      systemState: { neural: -4, muscular: 0, connective: 0, autonomic: 0 },
      stateUpdatedAt: new Date().toISOString()
    });
    const planned = makeSession({
      id: "neural_plan",
      mode: "planned",
      entries: [
        {
          id: "snatch",
          exerciseId: "snatch",
          name: "Snatch",
          category: "snatch",
          sets: [{ id: "set", reps: 1, loadKg: 76, percentOfMax: 92, rpe: 9, made: true, technicalQuality: 8 }]
        }
      ]
    });

    const adjusted = adjustPlannedSession(suppressed, [], planned);
    assert.ok((adjusted.entries[0].sets[0].percentOfMax ?? 0) <= 85);
    assert.equal(adjusted.adjustedFromPlanId, planned.id);
  });

  it("adjustPlannedSession reduces squat and pull sets when muscular readiness is suppressed", () => {
    const suppressed = cloneAthlete({
      systemState: { neural: 0, muscular: -4, connective: 0, autonomic: 0 },
      stateUpdatedAt: new Date().toISOString()
    });
    const planned = makeSession({
      id: "muscular_plan",
      mode: "planned",
      entries: [
        {
          id: "squat",
          exerciseId: "front-squat",
          name: "Front squat",
          category: "squat",
          sets: Array.from({ length: 4 }, (_, index) => ({
            id: `set_${index}`,
            reps: 2,
            loadKg: 100,
            percentOfMax: 85,
            rpe: 8,
            made: true,
            technicalQuality: 8
          }))
        }
      ]
    });

    const adjusted = adjustPlannedSession(suppressed, [], planned);
    assert.ok(adjusted.entries[0].sets.length < planned.entries[0].sets.length);
    assert.ok(adjusted.entries[0].sets.length >= 1);
  });

  it("adjustPlannedSession preserves taper top exposure while reducing extra volume", () => {
    const planned = makeSession({
      id: "taper_plan",
      mode: "planned",
      taperFlag: true,
      entries: [
        {
          id: "snatch",
          exerciseId: "snatch",
          name: "Snatch",
          category: "snatch",
          sets: [
            { id: "s1", reps: 1, loadKg: 60, percentOfMax: 73, rpe: 7, made: true, technicalQuality: 8 },
            { id: "s2", reps: 1, loadKg: 66, percentOfMax: 80, rpe: 7.5, made: true, technicalQuality: 8 },
            { id: "s3", reps: 1, loadKg: 72, percentOfMax: 88, rpe: 8.2, made: true, technicalQuality: 8 },
            { id: "s4", reps: 1, loadKg: 64, percentOfMax: 78, rpe: 7, made: true, technicalQuality: 8 }
          ]
        }
      ]
    });

    const adjusted = adjustPlannedSession(athlete, [], planned);
    const maxOriginal = Math.max(...planned.entries[0].sets.map((set) => set.percentOfMax ?? 0));
    const maxAdjusted = Math.max(...adjusted.entries[0].sets.map((set) => set.percentOfMax ?? 0));
    assert.equal(maxAdjusted, maxOriginal);
    assert.ok(adjusted.entries[0].sets.length < planned.entries[0].sets.length);
  });

  it("convertPlannedSessionToActual preserves plan linkage without mutating the plan", () => {
    const planned = makeSession({ id: "convert_plan", mode: "planned", title: "Adjusted Heavy classic" });
    const actual = convertPlannedSessionToActual(planned, "2026-06-01T15:00:00.000Z");

    assert.equal(actual.mode, "actual");
    assert.equal(actual.plannedSessionId, planned.id);
    assert.equal(planned.mode, "planned");
    assert.notEqual(actual.id, planned.id);
  });

  it("uses date-aware IWF bodyweight categories", () => {
    assert.equal(formatBodyweightClass(69.2, "female", "2026-07-31"), "77 kg");
    assert.equal(formatBodyweightClass(69.2, "female", "2026-08-01"), "77 kg");
    assert.equal(formatBodyweightClass(60.4, "female", "2026-08-01", true), "61 kg");
  });
});
