import type { BodyRegion, Observation, SourceType } from "./types";

export interface SensorAdapter<TInput = unknown> {
  id: string;
  sourceType: SourceType;
  displayName: string;
  normalize(input: TInput): Observation[];
}

export interface ManualObservationInput {
  timestamp: string;
  metric: string;
  value: number | string | boolean;
  unit?: string;
  confidence?: number;
  bodyRegion?: BodyRegion;
  exerciseId?: string;
  sessionId?: string;
  setId?: string;
  repId?: string;
  notes?: string;
}

export function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

export function createManualObservation(input: ManualObservationInput): Observation {
  return {
    id: makeId("obs"),
    timestamp: input.timestamp,
    source: "manual",
    sourceType: "manual",
    metric: input.metric,
    value: input.value,
    unit: input.unit,
    confidence: input.confidence ?? 0.8,
    bodyRegion: input.bodyRegion,
    exerciseId: input.exerciseId,
    sessionId: input.sessionId,
    setId: input.setId,
    repId: input.repId,
    notes: input.notes
  };
}

export const futureSensorAdapters: SensorAdapter[] = [
  {
    id: "vbt-bar-velocity",
    sourceType: "vbt",
    displayName: "Bar velocity",
    normalize: () => []
  },
  {
    id: "force-plate",
    sourceType: "force_plate",
    displayName: "Force plate",
    normalize: () => []
  },
  {
    id: "formlab-video",
    sourceType: "video_formlab",
    displayName: "FormLab video",
    normalize: () => []
  },
  {
    id: "imu",
    sourceType: "imu",
    displayName: "IMU",
    normalize: () => []
  },
  {
    id: "sleep-wearable",
    sourceType: "wearable",
    displayName: "Sleep wearable",
    normalize: () => []
  },
  {
    id: "bodyweight-scale",
    sourceType: "bodyweight_scale",
    displayName: "Bodyweight scale",
    normalize: () => []
  }
];
