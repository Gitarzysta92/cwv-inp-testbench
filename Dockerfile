# Container layer: pinned Playwright image + static Angular build + Chromium.
# Default entrypoint: headless. Set BENCH_USE_XVFB=1 for headful + Xvfb (see docker-entrypoint.sh).
# Pair with a dedicated benchmark node pool at orchestration time for stable CPU/memory.

FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Must match @playwright/test major/minor in package.json for compatible browsers.
FROM mcr.microsoft.com/playwright:v1.59.1-noble
USER root
RUN apt-get update && apt-get install -y --no-install-recommends xvfb \
  && rm -rf /var/lib/apt/lists/*
USER pwuser
WORKDIR /app
ENV PLAYWRIGHT_SKIP_WEBSERVER=1
ENV PLAYWRIGHT_BASE_URL=http://127.0.0.1:4200
ENV CI=1
COPY package.json package-lock.json ./
RUN npm ci && npx playwright install --with-deps chromium
COPY playwright.config.ts ./
COPY e2e ./e2e
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh
COPY --from=build /app/dist/web/browser ./dist/web/browser
ENTRYPOINT ["./docker-entrypoint.sh"]
