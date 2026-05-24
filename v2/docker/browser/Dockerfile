# Browser appliance — Chromium only, exposes CDP. No scenario code.
FROM mcr.microsoft.com/playwright:v1.59.1-noble

USER root
RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && rm -rf /var/lib/apt/lists/*
USER pwuser

WORKDIR /browser
COPY v2/docker/browser/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV BROWSER_CDP_PORT=9222
ENV BROWSER_HEADLESS=1

EXPOSE 9222

HEALTHCHECK --interval=2s --timeout=3s --retries=30 --start-period=3s \
  CMD curl -sf "http://127.0.0.1:${BROWSER_CDP_PORT}/json/version" || exit 1

ENTRYPOINT ["./entrypoint.sh"]
