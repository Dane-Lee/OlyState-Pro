# OlyState Pro — Program CLAUDE.md
*Ecosystem role: Tier 2 — Sport-Specific (Olympic Weightlifting Readiness)*
*Master Mind: `C:\Users\dlee5\OneDrive\Desktop\Personal Coding Projects\Athlete Ecosystem\MasterMind\CLAUDE.md`*

---

## What This Program Is

OlyState Pro applies the Swim State Pro readiness concept to Olympic weightlifting. It modifies a coach's training plan — it does not replace the coach. It tracks 4 physiological systems plus technical readiness and attempt confidence.

Biological role: **Autonomic Nervous System (lifting)** — same function as Swim State Pro, adapted for barbell sport.

Framework document: `docs/olystate-framework.md`

---

## Stack

- React + TypeScript + Vite

---

## Current State: Early Build

Framework document is complete. Observation contract is defined. Minimal application code exists.

---

## 4 Tracked Systems (vs 3 in Swim State)

| System | What It Tracks |
|---|---|
| neural | CNS speed, timing, arousal, coordination, heavy classic-lift readiness |
| muscular | Contractile fatigue, tonnage cost, squat/pull/accessory accumulation, soreness |
| connective | Joint, tendon, back, wrist, knee, shoulder, hand/finger, hip, ankle, tissue tolerance |
| autonomic | Sleep, HRV, resting HR, stress, density tolerance, travel/weight-cut strain |

OlyState has a **connective tissue system** that Swim State does not. This is the most important structural difference — injury risk in weightlifting is heavily load-on-joint rather than load-on-cardiovascular.

---

## Fatigue Scale and Engine

Uses the same engine substrate as Swim State Pro:
- Scale: −6 (deeply suppressed) to +4 (potentiated), 0 = baseline
- Decay half-lives: neural=36h, muscular=72h, connective=longer (implement from framework spec), autonomic=similar to cardiovascular
- EngineConfigStarter values are starting priors — see Master Mind CLAUDE.md for full config

For all engine mathematics (Modules 1–10, EngineConfigStarter), see the Master Mind CLAUDE.md.

---

## Technical Readiness (Unique to OlyState)

Technical readiness is computed separately from physiological readiness:
- Make/miss rate (especially heavy misses)
- Technical quality scores
- Jerk reliability and overhead stability
- Catch confidence and receiving-position consistency
- Region pain affecting receiving or lockout

**Attempt confidence** = system readiness + technical readiness + recent heavy make rate + pain guardrails + meet/taper context. Computed separately for snatch and clean & jerk.

---

## Meet Context Module

Competition structure: snatch (3 attempts) → 10-minute break → clean & jerk (3 attempts)

Track:
- Bodyweight category by date (IWF date-aware — categories changed 2025, more changes 2026/2028)
- Weigh-in timing
- Opener confidence
- Total projection

IWF bodyweight categories are date-sensitive. Do not hardcode them — look up the date-aware classification.

---

## Observation Contract

Every input is represented as an `Observation`:
```typescript
interface Observation {
  timestamp: string;       // ISO-8601
  source: string;
  sourceType: string;
  metric: string;
  value: number;
  unit: string;
  confidence: number;
  bodyRegion?: string;
  exerciseId?: string;
  sessionId?: string;
  setId?: string;
  repId?: string;
}
```

Manual logs are the first source. Future: VBT, force plate, FormLab/video, IMU, HR strap, wearable sleep, scale, recovery device.

---

## Load Classification

Work is classified by component, not whole-session label:
- Snatch, clean & jerk, pulls, squats, presses, accessories, complexes, recovery, meet simulation
- Each contributes weighted stress to the 4 systems
- Relative intensity, RPE/RIR, misses, technical quality, total relative volume shape each set's load

---

## Recommendations Produced

- Cap snatch or clean & jerk intensity
- Reduce squat or pull volume
- Shift heavy singles 24–48 hours
- Bias technique or power-speed work
- Protect a painful region
- Preserve intensity but cut volume during taper
- Adjust openers when attempt confidence is low

---

## Integration Responsibilities

- → **AthleteOS**: push readiness snapshots and session data
- → **SentiOS**: emit heartbeat + operational events (module key: `OlyState`)
- ↔ **Recovery Programming AI**: optional (no dependency)

### SentiOS Events Required
| Event | Category | Required |
|---|---|---|
| session_imported | operational | yes |
| readiness_updated | operational | yes |
| attempt_confidence_updated | operational | no |
| technical_readiness_updated | operational | no |
| meet_context_set | operational | no |
| athlete_os_push_success | sync | yes |
| athlete_os_push_fail | sync | yes |
| olystate_heartbeat | heartbeat | yes |

---

## Ecosystem Rules (Local)

- Pain-region guardrails constrain recommendations but do not diagnose injuries. OlyState is coaching decision support only.
- Technical readiness and physiological readiness must remain separate computations. Do not combine them into a single score without keeping both components visible.
- IWF bodyweight categories are date-aware. Implement with date-sensitive lookup, not hardcoded values.
- Observation contract schema is locked — all inputs, regardless of source, must be normalized into `Observation` before entering the engine.
- Do not start a full attempt-confidence implementation until the 4-system engine is stable and returning plausible outputs.
