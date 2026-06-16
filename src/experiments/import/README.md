# Import experiments

Backfill `bench-results/` from already-collected measurements. No browser, no orchestrator — synthetic `Observation`s that match the format produced by lab runs.

## Files in each experiment

| File | Role |
|------|------|
| `experiment.ts` | CLI: loop sessions/paths, call `seedDay` |
| `measurements.ts` | Raw rows: `profileId`, `replicate`, `inpMs`, `scenarioDurationMs`, replay counters |
| `publish.ts` | Build observations, write JSON/TSV reports, Jira/markdown exports |

Import experiments reference `lab/euro-cwv-lab/definition.ts` for cohort, methodology, and scenario IDs so aggregated reports match live lab semantics.

## Experiments

### `euro-seed-paths`

Import n=5 results for 3 user paths × 3 session days (hamburger menu, search layer, rotator banner).

```bash
npm run bench:seed-euro-paths
```

Edit `measurements.ts` (`HAMBURGER_ROWS`, `SEARCH_ROWS`, `ROTATOR_ROWS`) when adding new raw data.

Outputs:

```text
bench-results/observations/euro-paths-<date>/
bench-results/summary/euro-paths-<date>/
bench-results/euro-paths/<date>/jira-copy-paste.txt
bench-results/euro-paths/<date>/<path>.md
```

### `euro-seed-menu`

**Deprecated.** Hamburger-only import with legacy session IDs (`euro-menu-*` instead of `euro-paths-*`).

```bash
npm run bench:seed-euro-menu
```

Prefer `euro-seed-paths`.

## When to use

- Lab was run manually or on another machine and you only have spreadsheet/TSV exports.
- You need Jira-ready summaries without re-running Playwright against production.

For new measurements, prefer a **lab** experiment and a real `runLabSession`.

## Related code

- Results writer: `src/lab/results.ts`
- Storage paths: `src/lab/report.ts`
