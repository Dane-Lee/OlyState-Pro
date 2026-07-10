export const SYSTEM_IDS = ["neural", "muscular", "connective", "autonomic"] as const;
export type SystemId = (typeof SYSTEM_IDS)[number];
export type SystemVector = Record<SystemId, number>;

export const BODY_REGIONS = [
  "knee",
  "low_back",
  "shoulder",
  "wrist",
  "elbow",
  "hand_fingers",
  "hip",
  "ankle"
] as const;
export type BodyRegion = (typeof BODY_REGIONS)[number];

export type Sex = "female" | "male" | "other";

export type SourceType =
  | "manual"
  | "wearable"
  | "vbt"
  | "force_plate"
  | "video_formlab"
  | "imu"
  | "hr_strap"
  | "bodyweight_scale"
  | "recovery_device"
  | "import";

export type ExerciseCategory =
  | "snatch"
  | "clean_jerk"
  | "pull"
  | "squat"
  | "press"
  | "accessory"
  | "complex"
  | "recovery"
  | "meet_simulation";

export type SessionMode = "planned" | "actual";

export interface Observation {
  id: string;
  timestamp: string;
  source: string;
  sourceType: SourceType;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  confidence: number;
  bodyRegion?: BodyRegion;
  exerciseId?: string;
  sessionId?: string;
  setId?: string;
  repId?: string;
  notes?: string;
}

export interface SetEntry {
  id: string;
  reps: number;
  loadKg: number;
  percentOfMax?: number;
  rpe?: number;
  rir?: number;
  made: boolean;
  technicalQuality?: number;
  velocityMps?: number;
  painRegions?: BodyRegion[];
}

export interface ExerciseEntry {
  id: string;
  exerciseId: string;
  name: string;
  category: ExerciseCategory;
  targetMaxKg?: number;
  sets: SetEntry[];
}

export interface WellnessInput {
  sleepQuality?: number;
  hrvRmssd?: number;
  restingHr?: number;
  stress?: number;
  soreness?: number;
  subjectiveReadiness?: number;
  bodyweightKg?: number;
}

export type PainRatings = Partial<Record<BodyRegion, number>>;

export interface WeightliftingSession {
  id: string;
  athleteId: string;
  date: string;
  title: string;
  mode: SessionMode;
  startTime?: string;
  durationMinutes?: number;
  plannedSessionId?: string;
  adjustedFromPlanId?: string;
  adjustmentNotes?: string[];
  entries: ExerciseEntry[];
  wellness?: WellnessInput;
  painRatings?: PainRatings;
  observations?: Observation[];
  taperFlag?: boolean;
  meetSimulation?: boolean;
  notes?: string;
}

export interface PersonalBests {
  snatch: number;
  cleanJerk: number;
  backSquat: number;
  frontSquat: number;
  jerk?: number;
  clean?: number;
  snatchPull?: number;
  cleanPull?: number;
}

export interface MeetPlan {
  id: string;
  name: string;
  date: string;
  competitionType: "local" | "national" | "international" | "olympic";
  targetBodyweightKg?: number;
  openerSnatchKg?: number;
  openerCleanJerkKg?: number;
}

export interface AthleteProfile {
  id: string;
  name: string;
  sex: Sex;
  birthDate?: string;
  bodyweightKg: number;
  personalBests: PersonalBests;
  baselineHrvRmssd?: number;
  baselineRestingHr?: number;
  systemState: SystemVector;
  stateUpdatedAt: string;
  meets: MeetPlan[];
}

export interface SessionLoad {
  systemLoad: SystemVector;
  technicalLoad: number;
  relativeVolume: number;
  missCount: number;
  heavyAttemptCount: number;
  heavyMissCount: number;
  averageIntensity: number;
  averageTechnicalQuality: number;
  painLoad: Partial<Record<BodyRegion, number>>;
  dominantCategories: ExerciseCategory[];
}

export interface ClassificationResult {
  label:
    | "max_classic"
    | "heavy_strength"
    | "power_speed"
    | "technical_skill"
    | "volume_accumulation"
    | "recovery_mobility"
    | "meet_taper"
    | "mixed";
  confidence: number;
  componentShares: Record<ExerciseCategory, number>;
}

export interface RecommendationAction {
  id: string;
  severity: "info" | "watch" | "limit" | "stop";
  title: string;
  detail: string;
  affectedSystems: SystemId[];
  affectedRegions?: BodyRegion[];
}

export interface AttemptConfidence {
  snatch: number;
  cleanJerk: number;
  total: number;
  projectedSnatchOpenerKg: number;
  projectedCleanJerkOpenerKg: number;
}

export interface ReadinessSnapshot {
  athleteId: string;
  generatedAt: string;
  systemState: SystemVector;
  systemReadiness: SystemVector;
  globalReadiness: number;
  readinessBand: "red" | "amber" | "green" | "peak";
  technicalReadiness: number;
  attemptConfidence: AttemptConfidence;
  latestLoad: SessionLoad;
  classification: ClassificationResult;
  volatility: number;
  recoveryDebt: number;
  warnings: RecommendationAction[];
  recommendations: RecommendationAction[];
}

export interface OlyStateDataSet {
  athletes: AthleteProfile[];
  sessions: WeightliftingSession[];
  plannedSessions: WeightliftingSession[];
  observations: Observation[];
}
