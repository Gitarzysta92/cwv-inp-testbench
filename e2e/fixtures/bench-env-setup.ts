import type { Page } from '@playwright/test';

declare global {
  interface Window {
    __CWV_BENCH_SLOW_CLICK_BY_TESTID__?: Record<string, number>;
    __CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__?: Record<string, number>;
  }
}

function parseJsonRecord(name: string): Record<string, number> | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(o)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return Object.keys(out).length ? out : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Injects per-testid slowdown maps before first navigation (reads bench orchestrator env).
 * See `BENCH_SLOW_CLICK_JSON`, `BENCH_SLOW_KEYDOWN_JSON` in bench-matrix JSON.
 */
export async function installSlowdownFromBenchEnv(page: Page): Promise<void> {
  const click = parseJsonRecord('BENCH_SLOW_CLICK_JSON');
  const keydown = parseJsonRecord('BENCH_SLOW_KEYDOWN_JSON');
  if (!click && !keydown) return;

  await page.addInitScript(
    (payload: {
      click?: Record<string, number>;
      keydown?: Record<string, number>;
    }) => {
      if (payload.click && Object.keys(payload.click).length) {
        window.__CWV_BENCH_SLOW_CLICK_BY_TESTID__ = { ...payload.click };
      }
      if (payload.keydown && Object.keys(payload.keydown).length) {
        window.__CWV_BENCH_SLOW_KEYDOWN_BY_TESTID__ = { ...payload.keydown };
      }
    },
    { click, keydown },
  );
}

export function benchmarkSlowdownMeta(): {
  slowdownClickEnv: 'set' | 'none';
  slowdownKeydownEnv: 'set' | 'none';
} {
  return {
    slowdownClickEnv: process.env.BENCH_SLOW_CLICK_JSON?.trim() ? 'set' : 'none',
    slowdownKeydownEnv: process.env.BENCH_SLOW_KEYDOWN_JSON?.trim() ? 'set' : 'none',
  };
}
