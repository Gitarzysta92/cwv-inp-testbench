# Runtime Replay Cache Isolation

## Problem

The current runtime replay flow records cacheable responses and then measures in the same browser/runtime container. For `cold` profiles, runtime clears browser state after capture so the measured browser is cold, but this is still a compromise: capture and measurement share one container lifecycle.

## Target Design

Use separate runtime containers for capture and measurement:

1. Start a capture runtime container.
2. Navigate online and build the runtime response replay cache.
3. Stop the capture container.
4. Start a fresh measurement runtime container.
5. Seed it with the captured replay cache.
6. Run the scenario with replay enabled and assert:
   - cached requests are fulfilled locally,
   - cache misses are blocked locally,
   - no request is continued to the network,
   - fulfill failures are zero.

## Why

This makes `cold` profile semantics cleaner. Browser cache, storage, service workers, cookies, and process state come from a fresh measurement container instead of from clearing state after capture.

## Notes

- The orchestrator scheduler already supports one runtime container per instruction.
- The missing piece is a portable replay-cache artifact passed from capture runtime to measurement runtime.
- Lab should continue to consume raw network stats from observations; methodology should not own this setup logic.
