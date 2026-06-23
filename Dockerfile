# Cluster runner for the CWV test bench.
FROM mcr.microsoft.com/playwright:v1.59.1-noble

USER root
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY src ./src

RUN mkdir -p /app/bench-results \
  && chown -R pwuser:pwuser /app/bench-results

USER pwuser

ENV BROWSER_HEADLESS=1
ENV BENCH_PROFILE_IDS=baseline,euro-menu-baseline-scripts-blocked
ENV BENCH_REPLICATES=3

CMD ["npm", "run", "bench:runtime:euro:menu:local-headless"]
