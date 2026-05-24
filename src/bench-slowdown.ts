/**
 * Lab-only targeted main-thread busy-waits on specific interactions (by data-testid).
 * Use from Playwright: assign maps before navigation / action.
 * Optional URL: ?benchSlowClick=id:ms,id2:ms  &  ?benchSlowKeydown=id:ms
 */

declare global {
  interface Window {
    /** data-testid → ms to spin on click (capture; applies when click resolves to that test id). */
    __CWV_BENCH_SLOW_CLICK_BY_TESTID__?: Record<string, number>;
    /** data-testid → ms per keydown when the event target is inside that element. */
    __CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__?: Record<string, number>;
  }
}

function spin(ms: number): void {
  if (ms <= 0) return;
  const end = performance.now() + ms;
  while (performance.now() < end) {
    /* busy */
  }
}

function findNearestTestId(el: EventTarget | null): string | null {
  if (!(el instanceof Element)) return null;
  const node = el.closest('[data-testid]');
  return node?.getAttribute('data-testid') ?? null;
}

/** "a:1,b:2" or "a:1,b:2" with spaces */
function parseTestIdMsMap(param: string | null): Record<string, number> | undefined {
  if (param == null || param.trim() === '') return undefined;
  const out: Record<string, number> = {};
  for (const part of param.split(',')) {
    const seg = part.trim();
    if (!seg) continue;
    const colon = seg.indexOf(':');
    if (colon <= 0) continue;
    const id = seg.slice(0, colon).trim();
    const ms = Number(seg.slice(colon + 1).trim());
    if (!id || !Number.isFinite(ms) || ms < 0) continue;
    out[id] = ms;
  }
  return Object.keys(out).length ? out : undefined;
}

function mergeQueryMaps(): void {
  try {
    const q = new URLSearchParams(window.location.search);
    const click = parseTestIdMsMap(q.get('benchSlowClick'));
    const keydown = parseTestIdMsMap(q.get('benchSlowKeydown'));
    if (click) {
      window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__ = {
        ...window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__,
        ...click,
      };
    }
    if (keydown) {
      window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__ = {
        ...window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__,
        ...keydown,
      };
    }
  } catch {
    /* ignore */
  }
}

function installTargetedSlowdown(): void {
  document.addEventListener(
    'click',
    (ev) => {
      const map = window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__;
      if (!map || Object.keys(map).length === 0) return;
      const id = findNearestTestId(ev.target);
      if (!id) return;
      const ms = map[id];
      if (ms == null || ms <= 0) return;
      spin(ms);
    },
    true,
  );

  document.addEventListener(
    'keydown',
    (ev) => {
      const map = window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__;
      if (!map || Object.keys(map).length === 0) return;
      if (ev.repeat) return;
      const id = findNearestTestId(ev.target);
      if (!id) return;
      const ms = map[id];
      if (ms == null || ms <= 0) return;
      spin(ms);
    },
    true,
  );
}

mergeQueryMaps();
installTargetedSlowdown();

export {};
