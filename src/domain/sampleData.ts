import { createSystemVector } from "./engine";
import type { AthleteProfile, OlyStateDataSet, WeightliftingSession } from "./types";

const now = new Date();
const isoDaysAgo = (days: number, hour = 15): string => {
  const date = new Date(now);
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

const isoDaysAhead = (days: number, hour = 10): string => {
  const date = new Date(now);
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date.toISOString();
};

export const sampleAthletes: AthleteProfile[] = [
  {
    id: "ath_mara",
    name: "Mara Chen",
    sex: "female",
    birthDate: "2002-04-16",
    bodyweightKg: 62.6,
    personalBests: {
      snatch: 82,
      cleanJerk: 104,
      backSquat: 142,
      frontSquat: 118,
      jerk: 108,
      clean: 106,
      snatchPull: 96,
      cleanPull: 122
    },
    baselineHrvRmssd: 72,
    baselineRestingHr: 49,
    systemState: createSystemVector(0),
    stateUpdatedAt: isoDaysAgo(18),
    meets: [
      {
        id: "meet_summer_open",
        name: "Summer Open",
        date: isoDaysAhead(18),
        competitionType: "national",
        targetBodyweightKg: 63,
        openerSnatchKg: 76,
        openerCleanJerkKg: 96
      }
    ]
  },
  {
    id: "ath_eli",
    name: "Eli Rodriguez",
    sex: "male",
    birthDate: "1999-09-03",
    bodyweightKg: 88.1,
    personalBests: {
      snatch: 126,
      cleanJerk: 158,
      backSquat: 220,
      frontSquat: 182,
      jerk: 164,
      clean: 162,
      snatchPull: 145,
      cleanPull: 180
    },
    baselineHrvRmssd: 58,
    baselineRestingHr: 53,
    systemState: createSystemVector(0),
    stateUpdatedAt: isoDaysAgo(18),
    meets: [
      {
        id: "meet_trials",
        name: "Regional Trials",
        date: isoDaysAhead(35),
        competitionType: "international",
        targetBodyweightKg: 88,
        openerSnatchKg: 116,
        openerCleanJerkKg: 148
      }
    ]
  }
];

export const sampleSessions: WeightliftingSession[] = [
  {
    id: "sess_mara_1",
    athleteId: "ath_mara",
    title: "Heavy classic singles",
    date: isoDaysAgo(7),
    mode: "actual",
    durationMinutes: 105,
    wellness: {
      sleepQuality: 0.68,
      hrvRmssd: 65,
      restingHr: 52,
      stress: 0.42,
      soreness: 0.32,
      subjectiveReadiness: 0.7,
      bodyweightKg: 62.7
    },
    painRatings: { knee: 2, low_back: 1, shoulder: 2 },
    entries: [
      {
        id: "ex_mara_snatch_1",
        exerciseId: "snatch",
        name: "Snatch",
        category: "snatch",
        sets: [
          { id: "s1", reps: 1, loadKg: 68, percentOfMax: 83, rpe: 7.5, made: true, technicalQuality: 8 },
          { id: "s2", reps: 1, loadKg: 72, percentOfMax: 88, rpe: 8.5, made: true, technicalQuality: 7.5 },
          { id: "s3", reps: 1, loadKg: 76, percentOfMax: 93, rpe: 9, made: false, technicalQuality: 6.5 }
        ]
      },
      {
        id: "ex_mara_cj_1",
        exerciseId: "clean-jerk",
        name: "Clean & jerk",
        category: "clean_jerk",
        sets: [
          { id: "s4", reps: 1, loadKg: 88, percentOfMax: 85, rpe: 8, made: true, technicalQuality: 8 },
          { id: "s5", reps: 1, loadKg: 93, percentOfMax: 89, rpe: 8.5, made: true, technicalQuality: 7.5 }
        ]
      }
    ]
  },
  {
    id: "sess_mara_2",
    athleteId: "ath_mara",
    title: "Squat and pull volume",
    date: isoDaysAgo(4),
    mode: "actual",
    durationMinutes: 95,
    wellness: {
      sleepQuality: 0.61,
      hrvRmssd: 60,
      restingHr: 55,
      stress: 0.55,
      soreness: 0.58,
      subjectiveReadiness: 0.58,
      bodyweightKg: 62.9
    },
    painRatings: { knee: 4, low_back: 3 },
    entries: [
      {
        id: "ex_mara_fs_1",
        exerciseId: "front-squat",
        name: "Front squat",
        category: "squat",
        sets: [
          { id: "s6", reps: 3, loadKg: 96, percentOfMax: 81, rpe: 8, made: true, technicalQuality: 8 },
          { id: "s7", reps: 3, loadKg: 100, percentOfMax: 85, rpe: 8.5, made: true, technicalQuality: 7.5, painRegions: ["knee"] },
          { id: "s8", reps: 3, loadKg: 100, percentOfMax: 85, rpe: 9, made: true, technicalQuality: 7, painRegions: ["knee"] }
        ]
      },
      {
        id: "ex_mara_pull_1",
        exerciseId: "clean-pull",
        name: "Clean pull",
        category: "pull",
        sets: [
          { id: "s9", reps: 3, loadKg: 108, percentOfMax: 88, rpe: 8, made: true, technicalQuality: 8 },
          { id: "s10", reps: 3, loadKg: 112, percentOfMax: 92, rpe: 8.5, made: true, technicalQuality: 7.5 }
        ]
      }
    ]
  },
  {
    id: "sess_mara_3",
    athleteId: "ath_mara",
    title: "Technique reset",
    date: isoDaysAgo(1),
    mode: "actual",
    durationMinutes: 70,
    wellness: {
      sleepQuality: 0.78,
      hrvRmssd: 70,
      restingHr: 50,
      stress: 0.35,
      soreness: 0.32,
      subjectiveReadiness: 0.74,
      bodyweightKg: 62.6
    },
    painRatings: { knee: 3, low_back: 2, wrist: 1 },
    entries: [
      {
        id: "ex_mara_tech_1",
        exerciseId: "snatch-complex",
        name: "Power snatch + overhead squat",
        category: "complex",
        sets: [
          { id: "s11", reps: 2, loadKg: 52, percentOfMax: 63, rpe: 6.5, made: true, technicalQuality: 9 },
          { id: "s12", reps: 2, loadKg: 55, percentOfMax: 67, rpe: 7, made: true, technicalQuality: 8.5 },
          { id: "s13", reps: 2, loadKg: 55, percentOfMax: 67, rpe: 7, made: true, technicalQuality: 8.5 }
        ]
      }
    ]
  },
  {
    id: "sess_eli_1",
    athleteId: "ath_eli",
    title: "Clean & jerk max exposure",
    date: isoDaysAgo(5),
    mode: "actual",
    durationMinutes: 120,
    wellness: {
      sleepQuality: 0.57,
      hrvRmssd: 49,
      restingHr: 58,
      stress: 0.62,
      soreness: 0.5,
      subjectiveReadiness: 0.55,
      bodyweightKg: 88.4
    },
    painRatings: { shoulder: 4, wrist: 2, low_back: 2 },
    entries: [
      {
        id: "ex_eli_cj_1",
        exerciseId: "clean-jerk",
        name: "Clean & jerk",
        category: "clean_jerk",
        sets: [
          { id: "e1", reps: 1, loadKg: 134, percentOfMax: 85, rpe: 8, made: true, technicalQuality: 8 },
          { id: "e2", reps: 1, loadKg: 142, percentOfMax: 90, rpe: 8.5, made: true, technicalQuality: 7.5 },
          { id: "e3", reps: 1, loadKg: 148, percentOfMax: 94, rpe: 9.5, made: false, technicalQuality: 6, painRegions: ["shoulder"] }
        ]
      }
    ]
  },
  {
    id: "sess_eli_2",
    athleteId: "ath_eli",
    title: "Back squat",
    date: isoDaysAgo(2),
    mode: "actual",
    durationMinutes: 90,
    wellness: {
      sleepQuality: 0.73,
      hrvRmssd: 55,
      restingHr: 54,
      stress: 0.4,
      soreness: 0.44,
      subjectiveReadiness: 0.68,
      bodyweightKg: 88.1
    },
    painRatings: { low_back: 3 },
    entries: [
      {
        id: "ex_eli_bs_1",
        exerciseId: "back-squat",
        name: "Back squat",
        category: "squat",
        sets: [
          { id: "e4", reps: 2, loadKg: 178, percentOfMax: 81, rpe: 8, made: true, technicalQuality: 8 },
          { id: "e5", reps: 2, loadKg: 188, percentOfMax: 85, rpe: 8.5, made: true, technicalQuality: 7.5 },
          { id: "e6", reps: 2, loadKg: 188, percentOfMax: 85, rpe: 9, made: true, technicalQuality: 7 }
        ]
      }
    ]
  }
];

export const samplePlannedSessions: WeightliftingSession[] = [
  {
    id: "plan_mara_next",
    athleteId: "ath_mara",
    title: "Planned heavy snatch + front squat",
    date: isoDaysAhead(1, 16),
    mode: "planned",
    durationMinutes: 100,
    wellness: {},
    painRatings: {},
    entries: [
      {
        id: "plan_mara_sn",
        exerciseId: "snatch",
        name: "Snatch",
        category: "snatch",
        sets: [
          { id: "p1", reps: 1, loadKg: 68, percentOfMax: 83, rpe: 8, made: true, technicalQuality: 8 },
          { id: "p2", reps: 1, loadKg: 72, percentOfMax: 88, rpe: 8.5, made: true, technicalQuality: 8 },
          { id: "p3", reps: 1, loadKg: 74, percentOfMax: 90, rpe: 9, made: true, technicalQuality: 8 }
        ]
      },
      {
        id: "plan_mara_fs",
        exerciseId: "front-squat",
        name: "Front squat",
        category: "squat",
        sets: [
          { id: "p4", reps: 2, loadKg: 96, percentOfMax: 81, rpe: 8, made: true, technicalQuality: 8 },
          { id: "p5", reps: 2, loadKg: 100, percentOfMax: 85, rpe: 8.5, made: true, technicalQuality: 8 }
        ]
      }
    ]
  },
  {
    id: "plan_eli_next",
    athleteId: "ath_eli",
    title: "Planned taper exposure",
    date: isoDaysAhead(1, 15),
    mode: "planned",
    durationMinutes: 75,
    taperFlag: true,
    wellness: {},
    painRatings: {},
    entries: [
      {
        id: "plan_eli_cj",
        exerciseId: "clean-jerk",
        name: "Clean & jerk",
        category: "clean_jerk",
        sets: [
          { id: "ep1", reps: 1, loadKg: 126, percentOfMax: 80, rpe: 7.5, made: true, technicalQuality: 8 },
          { id: "ep2", reps: 1, loadKg: 134, percentOfMax: 85, rpe: 8, made: true, technicalQuality: 8 }
        ]
      }
    ]
  }
];

export const initialDataSet: OlyStateDataSet = {
  athletes: sampleAthletes,
  sessions: sampleSessions,
  plannedSessions: samplePlannedSessions,
  observations: []
};
