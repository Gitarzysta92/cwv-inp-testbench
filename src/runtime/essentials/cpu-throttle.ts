export function browserCpuThrottleEnv(...specificEnvNames: string[]): Record<string, string> {
  for (const name of [...specificEnvNames, 'BENCH_BROWSER_CPU_THROTTLE_RATE']) {
    const value = process.env[name]?.trim();
    if (value) {
      return { BENCH_BROWSER_CPU_THROTTLE_RATE: value };
    }
  }

  return {};
}

export function applyProcessEnv(env: Record<string, string>): () => void {
  const previous = new Map<string, string | undefined>();

  for (const [name, value] of Object.entries(env)) {
    previous.set(name, process.env[name]);
    process.env[name] = value;
  }

  return () => {
    for (const [name, value] of previous) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  };
}
