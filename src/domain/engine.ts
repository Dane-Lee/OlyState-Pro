import {
  COUPLING_WEIGHTS,
  EXERCISE_PROFILES,
  PAIN_REGION_SYSTEM_MAP,
  SYSTEM_CONSTANTS,
  ZERO_VECTOR
} from "./constants";
import { formatBodyweightClass } from "./iwfCategories";
import type {
  AthleteProfile,
  BodyRegion,
  ClassificationResult,
  ExerciseCategory,
  ExerciseEntry,
  PainRatings,
  ReadinessSnapshot,
  RecommendationAction,
  SessionLoad,
  SystemId,
  SystemVector,
  WeightliftingSession
} from "./types";
import { BODY_REGIONS, SYSTEM_IDS } from "./types";

const MS_PER_HOUR = 1000 * 60 * 60;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function round(value: number, digits = 0): number {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

export function createSystemVector(value = 0): SystemVector {
  return {
    neural: value,
    muscular: value,
    connective: value,
    autonomic: value
  };
}

function addToVector(target: SystemVector, add: Partial<SystemVector>, scale = 1): void {
  for (const system of SYSTEM_IDS) {
    target[system] += (add[system] ?? 0) * scale;
  }
}

function copyVector(vector: SystemVector): SystemVector {
  return { ...vector };
}

export function getReferenceMax(entry: ExerciseEntry, athlete: AthleteProfile): number {
  if (entry.targetMaxKg && entry.targetMaxKg > 0) {
    return entry.targetMaxKg;
  }

  switch (entry.category) {
    case "snatch":
      return athlete.personalBests.snatch;
    case "clean_jerk":
    case "meet_simulation":
      return athlete.personalBests.cleanJerk;
    case "pull":
      return entry.name.toLowerCase().includes("snatch")
        ? athlete.personalBests.snatchPull ?? athlete.personalBests.snatch * 1.1
        : athlete.personalBests.cleanPull ?? athlete.personalBests.cleanJerk * 1.1;
    case "squat":
      return entry.name.toLowerCase().includes("front")
        ? athlete.personalBests.frontSquat
        : athlete.personalBests.backSquat;
    case "press":
      return athlete.personalBests.jerk ?? athlete.personalBests.cleanJerk;
    case "complex":
      return Math.max(athlete.personalBests.snatch, athlete.personalBests.cleanJerk * 0.88);
    case "accessory":
      return athlete.personalBests.frontSquat;
    case "recovery":
      return 100;
    default:
      return athlete.personalBests.frontSquat;
  }
}

function getSetStress(
  entry: ExerciseEntry,
  set: ExerciseEntry["sets"][number],
  athlete: AthleteProfile
): {
  stress: number;
  intensity: number;
  isHeavy: boolean;
  technicalQuality: number;
} {
  if (entry.category === "recovery") {
    return {
      stress: Math.max(0.05, set.reps * 0.015),
      intensity: 0.1,
      isHeavy: false,
      technicalQuality: set.technicalQuality ?? 9
    };
  }

  const referenceMax = Math.max(1, getReferenceMax(entry, athlete));
  const percent = set.percentOfMax ?? (set.loadKg / referenceMax) * 100;
  const intensity = clamp(percent / 100, 0.2, 1.25);
  const rpe = set.rpe ?? (typeof set.rir === "number" ? clamp(10 - set.rir, 1, 10) : 7.5);
  const effortFactor = clamp(0.72 + (rpe - 6) * 0.09, 0.62, 1.42);
  const missFactor = set.made ? 1 : 1.65;
  const quality = set.technicalQuality ?? 8;
  const qualityFactor = clamp(1 + (7 - quality) * 0.07, 0.84, 1.42);
  const velocityLossFactor = typeof set.velocityMps === "number" && set.velocityMps < 0.55 ? 1.08 : 1;
  const relativeVolume = (set.loadKg * set.reps) / referenceMax;
  const intensityStress = set.reps * Math.pow(intensity, 2.35);
  const stress = (intensityStress * 0.72 + relativeVolume * 0.28) * effortFactor * missFactor * qualityFactor * velocityLossFactor;

  return {
    stress,
    intensity,
    isHeavy: intensity >= 0.85 || rpe >= 8.5,
    technicalQuality: quality
  };
}

export function calculateSessionLoad(session: WeightliftingSession, athlete: AthleteProfile): SessionLoad {
  const systemLoad = createSystemVector();
  const categoryStress = new Map<ExerciseCategory, number>();
  const painLoad: Partial<Record<BodyRegion, number>> = {};
  let technicalLoad = 0;
  let relativeVolume = 0;
  let missCount = 0;
  let heavyAttemptCount = 0;
  let heavyMissCount = 0;
  let intensityTotal = 0;
  let setCount = 0;
  let technicalQualityTotal = 0;
  let technicalQualityCount = 0;

  for (const entry of session.entries) {
    const profile = EXERCISE_PROFILES[entry.category];
    for (const set of entry.sets) {
      const setStress = getSetStress(entry, set, athlete);
      const setPainRegions = set.painRegions ?? [];
      setCount += 1;
      intensityTotal += setStress.intensity;
      technicalQualityTotal += setStress.technicalQuality;
      technicalQualityCount += 1;
      relativeVolume += set.loadKg * set.reps;
      categoryStress.set(entry.category, (categoryStress.get(entry.category) ?? 0) + setStress.stress);

      if (!set.made) {
        missCount += 1;
      }

      if (setStress.isHeavy) {
        heavyAttemptCount += 1;
        if (!set.made) {
          heavyMissCount += 1;
        }
      }

      for (const system of SYSTEM_IDS) {
        systemLoad[system] += setStress.stress * profile.systemWeights[system];
      }

      technicalLoad += setStress.stress * profile.technicalWeight;

      for (const region of [...profile.connectiveBiasRegions, ...setPainRegions]) {
        painLoad[region] = (painLoad[region] ?? 0) + setStress.stress * (setPainRegions.includes(region) ? 0.18 : 0.04);
      }
    }
  }

  applyWellnessLoad(systemLoad, painLoad, session, athlete);

  const sortedCategories = [...categoryStress.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([category]) => category);

  return {
    systemLoad,
    technicalLoad,
    relativeVolume,
    missCount,
    heavyAttemptCount,
    heavyMissCount,
    averageIntensity: setCount ? intensityTotal / setCount : 0,
    averageTechnicalQuality: technicalQualityCount ? technicalQualityTotal / technicalQualityCount : 9,
    painLoad,
    dominantCategories: sortedCategories.slice(0, 3)
  };
}

function applyWellnessLoad(
  systemLoad: SystemVector,
  painLoad: Partial<Record<BodyRegion, number>>,
  session: WeightliftingSession,
  athlete: AthleteProfile
): void {
  const wellness = session.wellness;
  if (wellness?.sleepQuality !== undefined) {
    const sleepDeficit = clamp(0.72 - wellness.sleepQuality, 0, 0.72);
    systemLoad.autonomic += sleepDeficit * 4;
    systemLoad.neural += sleepDeficit * 1.8;
  }

  if (wellness?.stress !== undefined) {
    const stressExcess = clamp(wellness.stress - 0.45, 0, 0.55);
    systemLoad.autonomic += stressExcess * 2.8;
    systemLoad.neural += stressExcess * 1.2;
  }

  if (wellness?.soreness !== undefined) {
    const soreness = clamp(wellness.soreness, 0, 1);
    systemLoad.muscular += soreness * 1.6;
    systemLoad.connective += soreness * 0.8;
  }

  if (wellness?.subjectiveReadiness !== undefined) {
    const lowReadiness = clamp(0.58 - wellness.subjectiveReadiness, 0, 0.58);
    systemLoad.neural += lowReadiness * 1.2;
    systemLoad.autonomic += lowReadiness * 1.4;
  }

  if (wellness?.hrvRmssd !== undefined && athlete.baselineHrvRmssd) {
    const hrvDrop = clamp((athlete.baselineHrvRmssd - wellness.hrvRmssd) / athlete.baselineHrvRmssd, 0, 0.5);
    systemLoad.autonomic += hrvDrop * 3;
    systemLoad.neural += hrvDrop * 1.4;
  }

  if (wellness?.restingHr !== undefined && athlete.baselineRestingHr) {
    const hrRise = clamp((wellness.restingHr - athlete.baselineRestingHr) / athlete.baselineRestingHr, 0, 0.3);
    systemLoad.autonomic += hrRise * 3.4;
  }

  if (session.painRatings) {
    for (const region of BODY_REGIONS) {
      const pain = clamp(session.painRatings[region] ?? 0, 0, 10);
      if (pain <= 0) {
        continue;
      }
      painLoad[region] = (painLoad[region] ?? 0) + pain / 2;
      addToVector(systemLoad, PAIN_REGION_SYSTEM_MAP[region], pain / 3);
    }
  }
}

export function classifySession(session: WeightliftingSession, load: SessionLoad): ClassificationResult {
  const componentTotals = Object.fromEntries(
    Object.keys(EXERCISE_PROFILES).map((category) => [category, 0])
  ) as Record<ExerciseCategory, number>;

  let total = 0;
  for (const entry of session.entries) {
    for (const set of entry.sets) {
      const profileStress = Math.max(0.05, set.loadKg * Math.max(1, set.reps));
      componentTotals[entry.category] += profileStress;
      total += profileStress;
    }
  }

  const componentShares = Object.fromEntries(
    Object.entries(componentTotals).map(([category, value]) => [category, total ? value / total : 0])
  ) as Record<ExerciseCategory, number>;

  if (session.taperFlag || session.meetSimulation) {
    return { label: "meet_taper", confidence: 0.86, componentShares };
  }

  const hasOnlyRecovery = session.entries.length > 0 && session.entries.every((entry) => entry.category === "recovery");
  if (hasOnlyRecovery || load.systemLoad.neural + load.systemLoad.muscular + load.systemLoad.connective < 1) {
    return { label: "recovery_mobility", confidence: 0.82, componentShares };
  }

  if ((componentShares.snatch + componentShares.clean_jerk + componentShares.meet_simulation > 0.48) && load.averageIntensity >= 0.82) {
    return { label: "max_classic", confidence: 0.78, componentShares };
  }

  if ((componentShares.squat + componentShares.pull > 0.48) && load.averageIntensity >= 0.74) {
    return { label: "heavy_strength", confidence: 0.74, componentShares };
  }

  if (load.relativeVolume > 3800 && load.averageIntensity < 0.82) {
    return { label: "volume_accumulation", confidence: 0.7, componentShares };
  }

  if (load.averageTechnicalQuality >= 8.2 && load.averageIntensity < 0.75) {
    return { label: "technical_skill", confidence: 0.72, componentShares };
  }

  if (componentShares.snatch + componentShares.clean_jerk + componentShares.complex > 0.45) {
    return { label: "power_speed", confidence: 0.68, componentShares };
  }

  return { label: "mixed", confidence: 0.55, componentShares };
}

export function applyRecoveryDecay(
  state: SystemVector,
  deltaHours: number,
  recoveryQuality = 0.72
): SystemVector {
  const next = copyVector(state);
  const qualityModifier = clamp(0.72 + recoveryQuality * 0.56, 0.72, 1.28);

  for (const system of SYSTEM_IDS) {
    const constant = SYSTEM_CONSTANTS[system];
    const rate = Math.log(2) / constant.decayHalfLifeHours;
    const effectiveRate = rate * qualityModifier;
    const old = state[system];

    if (old < 0) {
      const recoveryFraction = 1 - Math.exp(-effectiveRate * deltaHours);
      next[system] = old + Math.abs(old) * recoveryFraction;
    } else {
      const potentiationFade = Math.exp(-effectiveRate * deltaHours * 0.65);
      next[system] = old * potentiationFade;
    }

    next[system] = clamp(next[system], -6, 4);
  }

  return next;
}

function applyCoupling(state: SystemVector): SystemVector {
  const next = copyVector(state);
  for (const source of SYSTEM_IDS) {
    for (const target of SYSTEM_IDS) {
      if (source === target) {
        continue;
      }
      const weight = COUPLING_WEIGHTS[source][target] ?? 0;
      const suppression = state[source] < 0 ? Math.abs(state[source]) / 6 : -state[source] / 8;
      next[target] -= suppression * weight * 0.22;
    }
  }
  for (const system of SYSTEM_IDS) {
    next[system] = clamp(next[system], -6, 4);
  }
  return next;
}

export function applySessionToState(state: SystemVector, load: SessionLoad, session: WeightliftingSession): SystemVector {
  const next = applyCoupling(state);
  const loadScale = session.mode === "planned" ? 0.72 : 1;

  for (const system of SYSTEM_IDS) {
    const constant = SYSTEM_CONSTANTS[system];
    const rawLoad = Math.max(0, load.systemLoad[system]) * constant.loadSensitivity * loadScale;
    const downwardRoom = next[system] + 6;
    const decrement = (1 - Math.exp(-rawLoad / 7.8)) * downwardRoom * 0.62;
    next[system] = clamp(next[system] - decrement, -6, 4);
  }

  if (session.taperFlag && load.relativeVolume < 1800 && load.averageIntensity >= 0.72) {
    next.neural = clamp(next.neural + 0.3, -6, 4);
    next.autonomic = clamp(next.autonomic + 0.16, -6, 4);
  }

  if (session.entries.every((entry) => entry.category === "recovery")) {
    next.neural = clamp(next.neural + 0.18, -6, 4);
    next.muscular = clamp(next.muscular + 0.22, -6, 4);
    next.connective = clamp(next.connective + 0.2, -6, 4);
    next.autonomic = clamp(next.autonomic + 0.28, -6, 4);
  }

  return next;
}

export function calculateTechnicalReadiness(sessions: WeightliftingSession[]): number {
  const recent = sessions
    .filter((session) => session.mode === "actual")
    .slice(-8);

  if (!recent.length) {
    return 82;
  }

  let sets = 0;
  let misses = 0;
  let heavyAttempts = 0;
  let heavyMisses = 0;
  let qualitySum = 0;
  let qualityCount = 0;
  let jerkIssues = 0;

  for (const session of recent) {
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        sets += 1;
        if (!set.made) {
          misses += 1;
          if (entry.category === "clean_jerk" || entry.name.toLowerCase().includes("jerk")) {
            jerkIssues += 1;
          }
        }
        if ((set.percentOfMax ?? 0) >= 85 || (set.rpe ?? 0) >= 8.5) {
          heavyAttempts += 1;
          if (!set.made) {
            heavyMisses += 1;
          }
        }
        if (typeof set.technicalQuality === "number") {
          qualitySum += set.technicalQuality;
          qualityCount += 1;
        }
      }
    }
  }

  const missRate = sets ? misses / sets : 0;
  const heavyMissRate = heavyAttempts ? heavyMisses / heavyAttempts : 0;
  const avgQuality = qualityCount ? qualitySum / qualityCount : 8;
  const jerkPenalty = jerkIssues * 2.2;
  const score = 92 - missRate * 46 - heavyMissRate * 24 - Math.max(0, 8 - avgQuality) * 6 - jerkPenalty;
  return clamp(round(score), 0, 100);
}

function systemStateToReadiness(state: number): number {
  return clamp(58 + state * 10.5, 0, 100);
}

function calculateRecoveryDebt(sessions: WeightliftingSession[], athlete: AthleteProfile): number {
  let debt = 0;
  let previousDate: string | undefined;

  for (const session of sessions.filter((item) => item.mode === "actual")) {
    if (previousDate) {
      const deltaHours = Math.max(0, (new Date(session.date).getTime() - new Date(previousDate).getTime()) / MS_PER_HOUR);
      const decayRate = Math.log(2) / (7 * 24);
      debt *= Math.exp(-decayRate * deltaHours);
    }
    const load = calculateSessionLoad(session, athlete);
    const mismatch = load.missCount * 0.28 + Math.max(0, load.averageIntensity - 0.86) * 2 + painSeverity(session.painRatings) * 0.18;
    debt += mismatch;
    previousDate = session.date;
  }

  return clamp(round(debt, 1), 0, 10);
}

function painSeverity(painRatings?: PainRatings): number {
  if (!painRatings) {
    return 0;
  }
  return BODY_REGIONS.reduce((max, region) => Math.max(max, painRatings[region] ?? 0), 0);
}

function getRecentRegionPain(sessions: WeightliftingSession[]): Partial<Record<BodyRegion, number>> {
  const recent = sessions.filter((session) => session.mode === "actual").slice(-3);
  const pain: Partial<Record<BodyRegion, number>> = {};
  for (const session of recent) {
    for (const region of BODY_REGIONS) {
      pain[region] = Math.max(pain[region] ?? 0, session.painRatings?.[region] ?? 0);
    }
  }
  return pain;
}

function calculateAttemptConfidence(
  athlete: AthleteProfile,
  systemReadiness: SystemVector,
  technicalReadiness: number,
  sessions: WeightliftingSession[]
) {
  const recent = sessions.filter((session) => session.mode === "actual").slice(-8);
  let snatchHeavy = 0;
  let snatchMade = 0;
  let cjHeavy = 0;
  let cjMade = 0;

  for (const session of recent) {
    for (const entry of session.entries) {
      for (const set of entry.sets) {
        const isHeavy = (set.percentOfMax ?? 0) >= 83 || (set.rpe ?? 0) >= 8.2;
        if (!isHeavy) {
          continue;
        }
        if (entry.category === "snatch") {
          snatchHeavy += 1;
          if (set.made) snatchMade += 1;
        }
        if (entry.category === "clean_jerk" || entry.category === "meet_simulation") {
          cjHeavy += 1;
          if (set.made) cjMade += 1;
        }
      }
    }
  }

  const snatchMake = snatchHeavy ? snatchMade / snatchHeavy : 0.78;
  const cjMake = cjHeavy ? cjMade / cjHeavy : 0.78;
  const pain = getRecentRegionPain(sessions);
  const overheadPain = Math.max(pain.shoulder ?? 0, pain.wrist ?? 0, pain.elbow ?? 0);
  const lowerPain = Math.max(pain.knee ?? 0, pain.low_back ?? 0, pain.hip ?? 0);

  const snatch = clamp(
    technicalReadiness * 0.34 +
      systemReadiness.neural * 0.24 +
      systemReadiness.connective * 0.18 +
      systemReadiness.autonomic * 0.08 +
      snatchMake * 16 -
      overheadPain * 2.1 -
      lowerPain * 0.9,
    0,
    100
  );

  const cleanJerk = clamp(
    technicalReadiness * 0.3 +
      systemReadiness.neural * 0.2 +
      systemReadiness.muscular * 0.16 +
      systemReadiness.connective * 0.18 +
      systemReadiness.autonomic * 0.08 +
      cjMake * 16 -
      overheadPain * 1.4 -
      lowerPain * 1.2,
    0,
    100
  );

  const projectedSnatchOpenerKg = round(athlete.personalBests.snatch * (0.86 + snatch / 1000));
  const projectedCleanJerkOpenerKg = round(athlete.personalBests.cleanJerk * (0.86 + cleanJerk / 1000));

  return {
    snatch: round(snatch),
    cleanJerk: round(cleanJerk),
    total: round((snatch + cleanJerk) / 2),
    projectedSnatchOpenerKg,
    projectedCleanJerkOpenerKg
  };
}

function makeAction(
  id: string,
  severity: RecommendationAction["severity"],
  title: string,
  detail: string,
  affectedSystems: SystemId[],
  affectedRegions?: BodyRegion[]
): RecommendationAction {
  return { id, severity, title, detail, affectedSystems, affectedRegions };
}

function buildRecommendations(
  snapshotBase: {
    systemState: SystemVector;
    systemReadiness: SystemVector;
    globalReadiness: number;
    technicalReadiness: number;
    attemptConfidence: { snatch: number; cleanJerk: number; total: number };
    recoveryDebt: number;
  },
  sessions: WeightliftingSession[],
  plannedSession?: WeightliftingSession
): { warnings: RecommendationAction[]; recommendations: RecommendationAction[] } {
  const warnings: RecommendationAction[] = [];
  const recommendations: RecommendationAction[] = [];
  const pain = getRecentRegionPain(sessions);

  if (snapshotBase.globalReadiness < 35) {
    recommendations.push(
      makeAction(
        "global-low",
        "limit",
        "Run recovery or technical work only",
        "Global readiness is below 35. Keep bar speed high, avoid grinding, and remove maximal classic attempts.",
        ["neural", "muscular", "autonomic"]
      )
    );
  }

  if (snapshotBase.systemReadiness.neural < 45) {
    recommendations.push(
      makeAction(
        "neural-cap",
        "limit",
        "Cap classic lift intensity",
        "Neural readiness is suppressed. Cap snatch and clean & jerk near 80-85% and bias crisp singles or doubles.",
        ["neural"]
      )
    );
  }

  if (snapshotBase.systemReadiness.muscular < 45) {
    recommendations.push(
      makeAction(
        "muscular-volume",
        "limit",
        "Reduce squat and pull volume",
        "Muscular state is suppressed. Cut squat and pull volume by 25-40% before adding more tonnage.",
        ["muscular"]
      )
    );
  }

  if (snapshotBase.systemReadiness.connective < 48) {
    recommendations.push(
      makeAction(
        "connective-protect",
        "limit",
        "Protect tissue tolerance",
        "Connective readiness is the limiting system. Keep receiving positions submaximal and avoid repeated misses.",
        ["connective"]
      )
    );
  }

  if (snapshotBase.systemReadiness.autonomic < 45) {
    recommendations.push(
      makeAction(
        "autonomic-density",
        "watch",
        "Lower density and extend rest",
        "Autonomic readiness is suppressed. Keep rest periods generous and avoid compressed high-density work.",
        ["autonomic"]
      )
    );
  }

  if (snapshotBase.technicalReadiness < 68) {
    recommendations.push(
      makeAction(
        "technical-reset",
        "limit",
        "Bias technique quality",
        "Technical readiness is below the heavy-attempt threshold. Use lower-risk variations and stop sets when quality drops.",
        ["neural", "connective"]
      )
    );
  }

  if (snapshotBase.recoveryDebt >= 4) {
    warnings.push(
      makeAction(
        "debt",
        "watch",
        "Recovery debt is elevated",
        "Recent mismatch, misses, or pain have accumulated. Plan 24-48 hours of lower-risk loading.",
        ["neural", "muscular", "connective", "autonomic"]
      )
    );
  }

  for (const region of BODY_REGIONS) {
    const painScore = pain[region] ?? 0;
    if (painScore >= 6) {
      warnings.push(
        makeAction(
          `pain-${region}`,
          "stop",
          "Pain guardrail active",
          `${region.replace("_", " ")} pain is ${painScore}/10. Avoid loading that region aggressively and refer out if symptoms persist or worsen.`,
          ["connective"],
          [region]
        )
      );
    } else if (painScore >= 4) {
      recommendations.push(
        makeAction(
          `pain-mod-${region}`,
          "watch",
          "Modify around region pain",
          `${region.replace("_", " ")} pain is elevated. Reduce exposure to positions that reproduce it.`,
          ["connective"],
          [region]
        )
      );
    }
  }

  if (snapshotBase.attemptConfidence.snatch < 70 || snapshotBase.attemptConfidence.cleanJerk < 70) {
    recommendations.push(
      makeAction(
        "attempts",
        "watch",
        "Keep openers conservative",
        "Attempt confidence is not high enough for aggressive opener jumps. Prioritize a made first attempt.",
        ["neural", "connective"]
      )
    );
  }

  if (plannedSession?.taperFlag) {
    recommendations.push(
      makeAction(
        "taper",
        "info",
        "Preserve intensity, cut volume",
        "This is marked as taper work. Keep enough intensity for timing, but remove extra back-off volume.",
        ["neural", "muscular", "autonomic"]
      )
    );
  }

  return { warnings, recommendations };
}

export function evaluateAthlete(
  athlete: AthleteProfile,
  sessions: WeightliftingSession[],
  plannedSession?: WeightliftingSession,
  generatedAt = new Date().toISOString()
): ReadinessSnapshot {
  const athleteSessions = sessions
    .filter((session) => session.athleteId === athlete.id && session.mode === "actual")
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let state = copyVector(athlete.systemState);
  let previousDate = athlete.stateUpdatedAt;
  let latestLoad: SessionLoad = {
    systemLoad: copyVector(ZERO_VECTOR),
    technicalLoad: 0,
    relativeVolume: 0,
    missCount: 0,
    heavyAttemptCount: 0,
    heavyMissCount: 0,
    averageIntensity: 0,
    averageTechnicalQuality: 9,
    painLoad: {},
    dominantCategories: []
  };
  let latestClassification: ClassificationResult = {
    label: "mixed",
    confidence: 0,
    componentShares: {
      snatch: 0,
      clean_jerk: 0,
      pull: 0,
      squat: 0,
      press: 0,
      accessory: 0,
      complex: 0,
      recovery: 0,
      meet_simulation: 0
    }
  };

  for (const session of athleteSessions) {
    const deltaHours = Math.max(0, (new Date(session.date).getTime() - new Date(previousDate).getTime()) / MS_PER_HOUR);
    state = applyRecoveryDecay(state, deltaHours, session.wellness?.sleepQuality ?? 0.72);
    latestLoad = calculateSessionLoad(session, athlete);
    latestClassification = classifySession(session, latestLoad);
    state = applySessionToState(state, latestLoad, session);
    previousDate = session.date;
  }

  const sinceLast = Math.max(0, (new Date(generatedAt).getTime() - new Date(previousDate).getTime()) / MS_PER_HOUR);
  state = applyRecoveryDecay(state, sinceLast, athleteSessions.at(-1)?.wellness?.sleepQuality ?? 0.72);

  if (plannedSession) {
    latestLoad = calculateSessionLoad(plannedSession, athlete);
    latestClassification = classifySession(plannedSession, latestLoad);
  }

  const systemReadiness = createSystemVector();
  for (const system of SYSTEM_IDS) {
    systemReadiness[system] = round(systemStateToReadiness(state[system]));
  }

  const weightedReadiness = SYSTEM_IDS.reduce(
    (sum, system) => sum + systemReadiness[system] * SYSTEM_CONSTANTS[system].readinessWeight,
    0
  );
  const technicalReadiness = calculateTechnicalReadiness(athleteSessions);
  const attemptConfidence = calculateAttemptConfidence(athlete, systemReadiness, technicalReadiness, athleteSessions);
  const recoveryDebt = calculateRecoveryDebt(athleteSessions, athlete);
  const volatility = round(
    SYSTEM_IDS.reduce((sum, system) => sum + Math.abs(state[system]) * SYSTEM_CONSTANTS[system].volatility, 0) +
      recoveryDebt * 0.02,
    2
  );
  const painPenalty = painSeverity(athleteSessions.at(-1)?.painRatings) * 1.4;
  const debtPenalty = recoveryDebt * 1.8;
  const globalReadiness = clamp(
    round(weightedReadiness * 0.72 + technicalReadiness * 0.16 + attemptConfidence.total * 0.12 - painPenalty - debtPenalty),
    0,
    100
  );

  const readinessBand =
    globalReadiness >= 86 ? "peak" : globalReadiness >= 68 ? "green" : globalReadiness >= 42 ? "amber" : "red";

  const { warnings, recommendations } = buildRecommendations(
    {
      systemState: state,
      systemReadiness,
      globalReadiness,
      technicalReadiness,
      attemptConfidence,
      recoveryDebt
    },
    athleteSessions,
    plannedSession
  );

  return {
    athleteId: athlete.id,
    generatedAt,
    systemState: {
      neural: round(state.neural, 2),
      muscular: round(state.muscular, 2),
      connective: round(state.connective, 2),
      autonomic: round(state.autonomic, 2)
    },
    systemReadiness,
    globalReadiness,
    readinessBand,
    technicalReadiness,
    attemptConfidence,
    latestLoad,
    classification: latestClassification,
    volatility,
    recoveryDebt,
    warnings,
    recommendations
  };
}

export function reviewPlannedSession(
  athlete: AthleteProfile,
  actualSessions: WeightliftingSession[],
  plannedSession: WeightliftingSession
): ReadinessSnapshot {
  return evaluateAthlete(athlete, actualSessions, plannedSession);
}

const CLASSIC_PLAN_CATEGORIES = new Set<ExerciseCategory>(["snatch", "clean_jerk", "complex", "meet_simulation"]);
const RECEIVING_OVERHEAD_CATEGORIES = new Set<ExerciseCategory>(["snatch", "clean_jerk", "complex", "meet_simulation", "press"]);
const STRENGTH_VOLUME_CATEGORIES = new Set<ExerciseCategory>(["squat", "pull"]);

function createDerivedId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function cloneSessionWithIds(session: WeightliftingSession, mode: WeightliftingSession["mode"]): WeightliftingSession {
  return {
    ...session,
    id: createDerivedId(mode === "planned" ? "plan" : "session"),
    mode,
    entries: session.entries.map((entry) => ({
      ...entry,
      id: createDerivedId("entry"),
      sets: entry.sets.map((set) => ({
        ...set,
        id: createDerivedId("set")
      }))
    })),
    wellness: session.wellness ? { ...session.wellness } : undefined,
    painRatings: session.painRatings ? { ...session.painRatings } : undefined,
    observations: session.observations ? [...session.observations] : undefined,
    adjustmentNotes: session.adjustmentNotes ? [...session.adjustmentNotes] : undefined
  };
}

function reduceSetCount(session: WeightliftingSession, categories: Set<ExerciseCategory>, multiplier: number): void {
  for (const entry of session.entries) {
    if (!categories.has(entry.category) || entry.sets.length <= 1) {
      continue;
    }
    const nextCount = Math.max(1, Math.ceil(entry.sets.length * multiplier));
    entry.sets = entry.sets.slice(0, nextCount);
  }
}

function capEntryIntensity(entry: ExerciseEntry, athlete: AthleteProfile, capPercent: number): boolean {
  let changed = false;
  const referenceMax = getReferenceMax(entry, athlete);
  entry.sets = entry.sets.map((set) => {
    const percent = set.percentOfMax ?? (referenceMax ? (set.loadKg / referenceMax) * 100 : 0);
    if (percent <= capPercent) {
      return set;
    }
    changed = true;
    return {
      ...set,
      percentOfMax: capPercent,
      loadKg: round((referenceMax * capPercent) / 100),
      rpe: typeof set.rpe === "number" ? Math.min(set.rpe, capPercent <= 75 ? 7.5 : 8.2) : set.rpe
    };
  });
  return changed;
}

function scaleEntryLoads(entry: ExerciseEntry, scale: number): boolean {
  let changed = false;
  entry.sets = entry.sets.map((set) => {
    if (set.loadKg <= 0) {
      return set;
    }
    changed = true;
    return {
      ...set,
      loadKg: round(set.loadKg * scale),
      percentOfMax: typeof set.percentOfMax === "number" ? round(set.percentOfMax * scale, 1) : set.percentOfMax
    };
  });
  return changed;
}

function preserveTopTaperExposure(session: WeightliftingSession): boolean {
  let changed = false;
  for (const entry of session.entries) {
    if (entry.sets.length <= 2) {
      continue;
    }

    const maxIndex = entry.sets.reduce((bestIndex, set, index) => {
      const bestSet = entry.sets[bestIndex];
      const bestIntensity = bestSet.percentOfMax ?? bestSet.loadKg;
      const intensity = set.percentOfMax ?? set.loadKg;
      return intensity > bestIntensity ? index : bestIndex;
    }, 0);

    const keepIndexes = new Set([0, maxIndex]);
    if (keepIndexes.size < 2 && entry.sets.length > 1) {
      keepIndexes.add(1);
    }
    entry.sets = entry.sets.filter((_, index) => keepIndexes.has(index));
    changed = true;
  }
  return changed;
}

export function adjustPlannedSession(
  athlete: AthleteProfile,
  sessions: WeightliftingSession[],
  plannedSession: WeightliftingSession
): WeightliftingSession {
  const baseSnapshot = evaluateAthlete(athlete, sessions);
  const adjusted = cloneSessionWithIds(plannedSession, "planned");
  const notes: string[] = [];

  adjusted.adjustedFromPlanId = plannedSession.id;
  adjusted.title = plannedSession.title.startsWith("Adjusted") ? plannedSession.title : `Adjusted ${plannedSession.title}`;

  if (baseSnapshot.systemReadiness.neural < 45) {
    let changed = false;
    for (const entry of adjusted.entries) {
      if (CLASSIC_PLAN_CATEGORIES.has(entry.category)) {
        changed = capEntryIntensity(entry, athlete, 85) || changed;
      }
    }
    if (changed) {
      notes.push("Neural cap applied: classic-lift and complex work capped at 85%.");
    }
  }

  if (baseSnapshot.systemReadiness.muscular < 45) {
    const before = adjusted.entries.reduce((sum, entry) => sum + (STRENGTH_VOLUME_CATEGORIES.has(entry.category) ? entry.sets.length : 0), 0);
    reduceSetCount(adjusted, STRENGTH_VOLUME_CATEGORIES, 0.7);
    const after = adjusted.entries.reduce((sum, entry) => sum + (STRENGTH_VOLUME_CATEGORIES.has(entry.category) ? entry.sets.length : 0), 0);
    if (after < before) {
      notes.push("Muscular volume reduced: squat and pull sets cut by about 30%.");
    }
  }

  if (baseSnapshot.systemReadiness.connective < 48) {
    let changed = false;
    for (const entry of adjusted.entries) {
      if (RECEIVING_OVERHEAD_CATEGORIES.has(entry.category)) {
        changed = scaleEntryLoads(entry, 0.9) || changed;
      }
    }
    if (changed) {
      notes.push("Connective guardrail applied: receiving/overhead loads reduced 10%; avoid repeated misses.");
    }
  }

  if (baseSnapshot.systemReadiness.autonomic < 45) {
    const before = adjusted.entries.reduce((sum, entry) => sum + entry.sets.length, 0);
    reduceSetCount(adjusted, new Set(Object.keys(EXERCISE_PROFILES) as ExerciseCategory[]), 0.8);
    const after = adjusted.entries.reduce((sum, entry) => sum + entry.sets.length, 0);
    if (after < before) {
      notes.push("Autonomic density reduced: total sets cut about 20%; extend rest periods.");
    }
  }

  if (baseSnapshot.technicalReadiness < 68) {
    let changed = false;
    for (const entry of adjusted.entries) {
      if (CLASSIC_PLAN_CATEGORIES.has(entry.category)) {
        changed = capEntryIntensity(entry, athlete, 75) || changed;
        entry.sets = entry.sets.map((set) => ({
          ...set,
          technicalQuality: Math.max(set.technicalQuality ?? 8, 8.5)
        }));
      }
    }
    if (changed) {
      notes.push("Technical reset applied: classic-lift work capped at 75% with technique-quality targets.");
    }
  }

  if (plannedSession.taperFlag && preserveTopTaperExposure(adjusted)) {
    notes.push("Taper adjustment applied: top exposure preserved while extra back-off volume was removed.");
  }

  adjusted.adjustmentNotes = [...(plannedSession.adjustmentNotes ?? []), ...notes];
  return adjusted;
}

export function summarizePlanChanges(originalPlan: WeightliftingSession, adjustedPlan: WeightliftingSession): RecommendationAction[] {
  const actions: RecommendationAction[] = [];
  const originalSets = originalPlan.entries.reduce((sum, entry) => sum + entry.sets.length, 0);
  const adjustedSets = adjustedPlan.entries.reduce((sum, entry) => sum + entry.sets.length, 0);
  const originalMaxPercent = Math.max(0, ...originalPlan.entries.flatMap((entry) => entry.sets.map((set) => set.percentOfMax ?? 0)));
  const adjustedMaxPercent = Math.max(0, ...adjustedPlan.entries.flatMap((entry) => entry.sets.map((set) => set.percentOfMax ?? 0)));

  if (adjustedMaxPercent < originalMaxPercent) {
    actions.push(
      makeAction(
        "plan-intensity-change",
        "limit",
        "Intensity cap applied",
        `Top planned intensity moved from ${round(originalMaxPercent, 1)}% to ${round(adjustedMaxPercent, 1)}%.`,
        ["neural", "connective"]
      )
    );
  }

  if (adjustedSets < originalSets) {
    actions.push(
      makeAction(
        "plan-volume-change",
        "watch",
        "Set volume reduced",
        `Planned work moved from ${originalSets} sets to ${adjustedSets} sets.`,
        ["muscular", "autonomic"]
      )
    );
  }

  for (const [index, note] of (adjustedPlan.adjustmentNotes ?? []).entries()) {
    actions.push(makeAction(`plan-note-${index}`, "info", "Adjustment note", note, ["neural", "muscular", "connective", "autonomic"]));
  }

  return actions;
}

export function convertPlannedSessionToActual(plannedSession: WeightliftingSession, actualDate = new Date().toISOString()): WeightliftingSession {
  const actual = cloneSessionWithIds(plannedSession, "actual");
  actual.date = actualDate;
  actual.plannedSessionId = plannedSession.id;
  actual.title = plannedSession.title.replace(/^Adjusted\s+/, "");
  return actual;
}

export function getMeetSummary(athlete: AthleteProfile, snapshot: ReadinessSnapshot): string {
  const nextMeet = athlete.meets
    .filter((meet) => new Date(meet.date).getTime() >= Date.now())
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];

  if (!nextMeet) {
    return "No meet scheduled";
  }

  const bodyweight = nextMeet.targetBodyweightKg ?? athlete.bodyweightKg;
  const category = formatBodyweightClass(bodyweight, athlete.sex, nextMeet.date, nextMeet.competitionType === "olympic");
  return `${nextMeet.name}: ${category}, projected openers ${snapshot.attemptConfidence.projectedSnatchOpenerKg}/${snapshot.attemptConfidence.projectedCleanJerkOpenerKg}`;
}
