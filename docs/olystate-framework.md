# OlyState Pro Calculation Framework

## Purpose

OlyState Pro translates the Swim State Pro readiness concept into Olympic weightlifting. It is not a direct label swap: swimming distance, stroke type, and HR zones become barbell volume, relative intensity, lift type, misses, technical stability, pain regions, recovery signals, bodyweight context, and meet timing.

The system is coaching decision support. It should adjust, constrain, and explain a planned training day; it should not diagnose injuries or replace a coach.

Evidence maturity is currently `research-provisional`. A passing software test
proves deterministic implementation of these rules; it does not validate the
rules against an external athlete cohort. Attempt-confidence scores are
heuristic indices, not calibrated probabilities of making a lift.

## State Convention

The hidden state variable is `systemState`, not raw fatigue.

- `-6`: deeply suppressed or depleted.
- `0`: neutral baseline.
- `+4`: potentiated or peaking.

Training pushes state downward. Recovery decay moves negative values back toward baseline. Tapering and priming can temporarily move a system above baseline. Positive states decay back toward baseline faster than chronic suppression clears.

## Tracked Systems

- `neural`: CNS speed, timing, arousal, coordination, and heavy classic-lift readiness.
- `muscular`: contractile fatigue, tonnage cost, squat/pull/accessory accumulation, and soreness.
- `connective`: joint, tendon, back, wrist, knee, shoulder, hand/finger, hip, ankle, and tissue tolerance signals.
- `autonomic`: sleep, HRV, resting HR, stress, density tolerance, travel/weight-cut strain, and systemic recovery.

## Load Allocation

OlyState classifies work by component instead of assigning one label to the whole session. Snatch, clean and jerk, pulls, squats, presses, accessories, complexes, recovery, and meet simulation all contribute weighted stress to the four systems. Relative intensity, RPE/RIR, misses, technical quality, and total relative volume shape each set's load.

Recovery and wearable inputs enter as observations. Poor sleep, elevated stress, depressed HRV, elevated resting HR, soreness, or region pain can add system stress even when barbell load is low.

## Technical Readiness

Technical readiness is separate from physiological readiness because Olympic lifting performance is limited by precision under load. The technical score considers:

- make/miss rate, especially heavy misses;
- technical quality scores;
- jerk reliability and overhead stability;
- catch confidence and receiving-position consistency;
- region pain that affects receiving or lockout.

Attempt confidence combines system readiness, technical readiness, recent heavy make rate, pain guardrails, and meet/taper context for snatch and clean and jerk separately.

## Sensor-Ready Observation Contract

Every input can be represented as an `Observation`:

- `timestamp`
- `source`
- `sourceType`
- `metric`
- `value`
- `unit`
- `confidence`
- optional `bodyRegion`
- optional `exerciseId`
- optional `sessionId`, `setId`, and `repId`

Manual logs are the first source. Future adapters should normalize VBT, force plate, FormLab/video, IMU, HR strap, wearable sleep, scale, and recovery-device data into the same shape.

## Recommendation Rules

Recommendations modify a coach's plan instead of replacing it. Common outputs include:

- cap snatch or clean and jerk intensity;
- reduce squat or pull volume;
- shift heavy singles 24-48 hours;
- bias technique or power-speed work;
- protect a painful region;
- preserve intensity but cut volume during taper;
- adjust openers when attempt confidence is low.

## Meet Context

The meet module must know that competition is snatch first, clean and jerk second, with three attempts in each lift. It tracks bodyweight category by date, weigh-in timing, opener confidence, total projection, and the 10-minute break after snatch. IWF bodyweight categories are date-aware because official classes change over time.

## Evidence Anchors

- Weightlifting injury risk and common regions: BMJ Open Sport & Exercise Medicine, 2024.
- Competition flow and attempt structure: IWF competition flow and 2025 Technical and Competition Rules & Regulations.
- Date-aware category handling: IWF 2025 category update and 2026/2028 category changes.
- HRV, sRPE, and total volume load: Miyoshi and Miyake, 2021.
- Strength/power taper framing: Murach and Bagley, 2015; Travis et al., 2020.
