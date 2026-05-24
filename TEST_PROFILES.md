# Test Profiles Matrix

Pełny opis labu (tabela eksperyment / metodologia / środowisko): [`CWV_LAB.md`](./CWV_LAB.md).

Run the full profile matrix with:

```bash
npm run bench:profiles
```

The matrix is defined in `bench-matrix.profiles.json` and runs the A-D lab scenarios from `e2e/scenarios-a-d.spec.ts`.

| Profile | Viewport | Warmup | Slowdown | Purpose |
| --- | --- | --- | --- | --- |
| `desktop-cold` | 1280x720 | `cold` | none | Primary desktop baseline with cleared storage. |
| `desktop-warm-assets` | 1280x720 | `warm_assets` | none | Desktop run with bundle/assets already cached. |
| `desktop-warm-session` | 1280x720 | `warm_session` | none | Desktop run with session state seeded before measurement. |
| `mobile-cold` | 390x844 | `cold` | none | Primary narrow viewport baseline with cleared storage. |
| `mobile-warm-assets` | 390x844 | `warm_assets` | none | Narrow viewport run with bundle/assets already cached. |
| `desktop-targeted-slowdown` | 1280x720 | `cold` | clicks + search keys | Desktop regression probe for intentionally slower interactions. |
| `mobile-targeted-slowdown` | 390x844 | `cold` | clicks + search keys | Narrow viewport regression probe for intentionally slower interactions. |

## Measurement Policy

The profile matrix uses 5 runs per profile, reports p50/p75/p95 plus worst sample, and trims 10% from each end before percentile calculation when enough samples exist. The exported metrics are `eventTimingMaxMs`, `wallClockMs`, `searchTypingWallMs`, and `inpMs`.

`inpMs` is the primary interaction signal. `eventTimingMaxMs` is kept as a Chromium lab probe, and `wallClockMs` / `searchTypingWallMs` are scenario-specific support metrics.
