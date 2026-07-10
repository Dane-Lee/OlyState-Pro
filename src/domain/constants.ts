import type { BodyRegion, ExerciseCategory, SystemId, SystemVector } from "./types";

export const ZERO_VECTOR: SystemVector = {
  neural: 0,
  muscular: 0,
  connective: 0,
  autonomic: 0
};

export const SYSTEM_CONSTANTS: Record<
  SystemId,
  {
    decayHalfLifeHours: number;
    loadSensitivity: number;
    volatility: number;
    readinessWeight: number;
  }
> = {
  neural: {
    decayHalfLifeHours: 36,
    loadSensitivity: 1.18,
    volatility: 0.11,
    readinessWeight: 0.32
  },
  muscular: {
    decayHalfLifeHours: 72,
    loadSensitivity: 1,
    volatility: 0.08,
    readinessWeight: 0.28
  },
  connective: {
    decayHalfLifeHours: 120,
    loadSensitivity: 0.84,
    volatility: 0.07,
    readinessWeight: 0.2
  },
  autonomic: {
    decayHalfLifeHours: 48,
    loadSensitivity: 0.78,
    volatility: 0.09,
    readinessWeight: 0.2
  }
};

export const EXERCISE_PROFILES: Record<
  ExerciseCategory,
  {
    systemWeights: SystemVector;
    technicalWeight: number;
    connectiveBiasRegions: BodyRegion[];
  }
> = {
  snatch: {
    systemWeights: { neural: 1.25, muscular: 0.72, connective: 0.74, autonomic: 0.34 },
    technicalWeight: 1.25,
    connectiveBiasRegions: ["shoulder", "wrist", "knee", "low_back"]
  },
  clean_jerk: {
    systemWeights: { neural: 1.18, muscular: 0.95, connective: 0.92, autonomic: 0.42 },
    technicalWeight: 1.18,
    connectiveBiasRegions: ["shoulder", "wrist", "elbow", "knee", "low_back"]
  },
  pull: {
    systemWeights: { neural: 0.68, muscular: 1.18, connective: 0.82, autonomic: 0.36 },
    technicalWeight: 0.42,
    connectiveBiasRegions: ["low_back", "hand_fingers", "knee"]
  },
  squat: {
    systemWeights: { neural: 0.58, muscular: 1.32, connective: 0.98, autonomic: 0.42 },
    technicalWeight: 0.28,
    connectiveBiasRegions: ["knee", "hip", "low_back", "ankle"]
  },
  press: {
    systemWeights: { neural: 0.46, muscular: 0.7, connective: 1.05, autonomic: 0.24 },
    technicalWeight: 0.36,
    connectiveBiasRegions: ["shoulder", "elbow", "wrist"]
  },
  accessory: {
    systemWeights: { neural: 0.22, muscular: 0.82, connective: 0.62, autonomic: 0.32 },
    technicalWeight: 0.12,
    connectiveBiasRegions: ["knee", "low_back", "shoulder", "hip"]
  },
  complex: {
    systemWeights: { neural: 0.92, muscular: 1.04, connective: 0.88, autonomic: 0.58 },
    technicalWeight: 0.94,
    connectiveBiasRegions: ["shoulder", "wrist", "knee", "low_back", "hip"]
  },
  recovery: {
    systemWeights: { neural: 0.08, muscular: 0.08, connective: 0.06, autonomic: 0.04 },
    technicalWeight: 0.02,
    connectiveBiasRegions: []
  },
  meet_simulation: {
    systemWeights: { neural: 1.35, muscular: 0.9, connective: 0.92, autonomic: 0.62 },
    technicalWeight: 1.3,
    connectiveBiasRegions: ["shoulder", "wrist", "knee", "low_back", "elbow"]
  }
};

export const COUPLING_WEIGHTS: Record<SystemId, Partial<Record<SystemId, number>>> = {
  neural: { muscular: 0.2, connective: 0.12, autonomic: 0.18 },
  muscular: { neural: 0.15, connective: 0.16, autonomic: 0.1 },
  connective: { neural: 0.1, muscular: 0.2, autonomic: 0.08 },
  autonomic: { neural: 0.18, muscular: 0.12, connective: 0.1 }
};

export const PAIN_REGION_SYSTEM_MAP: Record<BodyRegion, SystemVector> = {
  knee: { neural: 0.08, muscular: 0.16, connective: 1, autonomic: 0.12 },
  low_back: { neural: 0.18, muscular: 0.28, connective: 1, autonomic: 0.18 },
  shoulder: { neural: 0.12, muscular: 0.18, connective: 1, autonomic: 0.1 },
  wrist: { neural: 0.08, muscular: 0.08, connective: 0.92, autonomic: 0.06 },
  elbow: { neural: 0.06, muscular: 0.12, connective: 0.9, autonomic: 0.06 },
  hand_fingers: { neural: 0.06, muscular: 0.1, connective: 0.78, autonomic: 0.05 },
  hip: { neural: 0.08, muscular: 0.22, connective: 0.95, autonomic: 0.1 },
  ankle: { neural: 0.06, muscular: 0.1, connective: 0.82, autonomic: 0.06 }
};

export const REGION_LABELS: Record<BodyRegion, string> = {
  knee: "Knee",
  low_back: "Low back",
  shoulder: "Shoulder",
  wrist: "Wrist",
  elbow: "Elbow",
  hand_fingers: "Hand/fingers",
  hip: "Hip",
  ankle: "Ankle"
};

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  snatch: "Snatch",
  clean_jerk: "Clean & jerk",
  pull: "Pull",
  squat: "Squat",
  press: "Press",
  accessory: "Accessory",
  complex: "Complex",
  recovery: "Recovery",
  meet_simulation: "Meet simulation"
};
