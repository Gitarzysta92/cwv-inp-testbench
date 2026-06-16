# Runtime experiments

Validate runtime and CDP behaviour, either with focused smoke tests or runtime-scoped lab runs.

## Files in each experiment

| File | Role |
|------|------|
| `experiment.ts` | Start stack (`--docker` / `--local`), run checks, print pass/fail |
| `run.ts` | CDP logic: capture responses, enable offline replay, assert network isolation |

## Flow

1. Start Docker or local runtime stack.
2. `RuntimeTestClient.prepareStep()` with a live profile.
3. Navigate online → record cacheable GET responses.
4. Navigate with replay enabled → verify cache hits stay local, misses are blocked.
5. Exit non-zero if any check fails.

## Experiments

### Euro menu runtime comparison

Full Euro hamburger-menu methodology lab on explicit runtime variants:

```bash
npm run bench:runtime:euro:menu:docker-headful-xvfb
npm run bench:runtime:euro:menu:docker-headful-xvfb:no-replay
npm run bench:runtime:euro:menu:local-headful
```

Each run uses the same Euro menu profiles and reports, but changes the runtime
host class:

| Runtime | Folder | Browser |
| --- | --- | --- |
| Docker + Xvfb | `src/runtime/docker-headful-xvfb` | headful Chromium in Xvfb |
| Docker + Xvfb, no replay | `src/runtime/docker-headful-xvfb-no-replay` | headful Chromium in Xvfb, no runtime replay cache |
| Local headful | `src/runtime/local-headful` | normal headful Chromium outside Docker |

Local headful disables the runtime-managed replay cache so it behaves like a
normal browser run instead of a CDP replay proxy run.

Use `BENCH_REPLICATES=1` for smoke checks or the default `10` for the current
methodology run.

### `euro-offline-replay`

Euro.com.pl offline replay smoke test.

```bash
npx tsx src/experiments/runtime/euro-offline-replay/experiment.ts --docker
npx tsx src/experiments/runtime/euro-offline-replay/experiment.ts --local
```

Uses profiles from `lab/euro-cwv-lab/profiles.ts`.

### `google-offline-replay`

Same checks for Google homepage.

```bash
npx tsx src/experiments/runtime/google-offline-replay/experiment.ts --docker
npx tsx src/experiments/runtime/google-offline-replay/experiment.ts --local
```

Uses profiles from `lab/google-web-vitals-probe/profiles.ts`.

## When to use

- After changing CDP response cache, network policy, or runtime API.
- Before trusting lab results that depend on offline replay or script blocking.

Lab experiments assume runtime works; these experiments prove it.

## Related code

- Runtime stack: `src/runtime/tests/stack.ts`
- Runtime API client: `src/runtime/tests/runtime-client.ts`
- Response cache: `src/runtime/driver/cdp/response-cache.ts`
