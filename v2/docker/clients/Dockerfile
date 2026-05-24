# Clients — orchestrator + Playwright specs, no local browser (v2/src/clients).
# Browser runs in separate browser container; attach via BROWSER_CDP_URL.
FROM node:20-bookworm

WORKDIR /app

ENV CI=1
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
ENV PLAYWRIGHT_SKIP_WEBSERVER=1

COPY package.json package-lock.json ./
RUN npm ci && npx playwright --version

COPY playwright.config.ts tsconfig.json ./
COPY e2e ./e2e
COPY v2 ./v2

COPY v2/docker/clients/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

RUN mkdir -p bench-results/v2

ENTRYPOINT ["./entrypoint.sh"]
