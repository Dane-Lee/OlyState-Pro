# OlyState Pro

OlyState Pro is a coach-facing Olympic weightlifting readiness dashboard. The first version is manual-first, but the data model is built around normalized observations so bar velocity, force plates, video, IMUs, HR straps, wearables, scales, and recovery devices can be added later without replacing the calculation engine.

The current model is research-provisional coaching decision support. Its
numeric readiness and attempt-confidence values are deterministic heuristic
outputs, not externally validated probabilities, injury predictions, or
medical advice. Every readiness snapshot carries a model version and evidence
maturity stamp.

## Run

```bash
npm install
npm run dev
```

The browser remains fully standalone with localStorage. To enable durable SQLite
persistence and the ecosystem Control Center, copy `.env.example` to `.env`, set
the server-only AthleteOS credentials, then run the local API and web app in
separate terminals:

```bash
npm run server:dev
npm run dev
```

`VITE_OLYSTATE_API_URL` is only the local API URL. Keep
`ATHLETEOS_SERVICE_KEY` server-side and never rename it with a `VITE_` prefix.
Control Center writes are accepted from loopback origins by default. If the web
app is hosted elsewhere, set `OLYSTATE_ALLOWED_ORIGIN` to that exact origin.

## Verify

```bash
npm run verify
```

## Model Notes

- Hidden state uses `systemState` from `-6` to `+4`.
- `-6` means suppressed/depleted, `0` is baseline, and `+4` is potentiated.
- Training load pushes systems down; recovery, taper, and priming restore or potentiate.
- The four tracked systems are `neural`, `muscular`, `connective`, and `autonomic`.
- Technical readiness and attempt confidence are separate from physiological readiness.
- Pain-region guardrails constrain recommendations without diagnosing injury.

The detailed calculation framework lives in [docs/olystate-framework.md](docs/olystate-framework.md).
