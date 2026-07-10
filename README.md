# OlyState Pro

OlyState Pro is a coach-facing Olympic weightlifting readiness dashboard. The first version is manual-first, but the data model is built around normalized observations so bar velocity, force plates, video, IMUs, HR straps, wearables, scales, and recovery devices can be added later without replacing the calculation engine.

## Run

```bash
npm install
npm run dev
```

## Verify

```bash
npm test
npm run build
```

## Model Notes

- Hidden state uses `systemState` from `-6` to `+4`.
- `-6` means suppressed/depleted, `0` is baseline, and `+4` is potentiated.
- Training load pushes systems down; recovery, taper, and priming restore or potentiate.
- The four tracked systems are `neural`, `muscular`, `connective`, and `autonomic`.
- Technical readiness and attempt confidence are separate from physiological readiness.
- Pain-region guardrails constrain recommendations without diagnosing injury.

The detailed calculation framework lives in [docs/olystate-framework.md](docs/olystate-framework.md).
