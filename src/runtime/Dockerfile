# Single runtime container: Chromium CDP + runtime driver API (live app target).
FROM mcr.microsoft.com/playwright:v1.59.1-noble

USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl socat \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
  && npm install tsx@4.22.3

COPY tsconfig.json ./
COPY src ./src
COPY src/runtime/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh && chown -R pwuser:pwuser /app

USER pwuser

ENV RUNTIME_DRIVER_PORT=8090
ENV BROWSER_CDP_PORT=9222
ENV BROWSER_CDP_PUBLIC_PORT=9223
ENV BROWSER_CDP_URL=http://127.0.0.1:9222
ENV BROWSER_APP_BASE_URL=https://www.google.com
ENV HOST_BROWSER_CDP_URL=http://127.0.0.1:9223
ENV BROWSER_HEADLESS=1

EXPOSE 8090 9223

HEALTHCHECK --interval=2s --timeout=3s --retries=20 --start-period=8s \
  CMD curl -sf "http://127.0.0.1:${RUNTIME_DRIVER_PORT}/health" \
  && curl -sf "http://127.0.0.1:${BROWSER_CDP_PORT}/json/version" || exit 1

ENTRYPOINT ["./entrypoint.sh"]
