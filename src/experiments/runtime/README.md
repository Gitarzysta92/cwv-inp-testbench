# Runtime experiments

Validate runtime and CDP behaviour without a lab session: no `LabDefinition`, no scenarios, no percentiles or gate.

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
