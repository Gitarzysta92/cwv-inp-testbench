# Runtime — mock app target + runtime driver API (v2/src/runtime).
# Browser appliance is a separate service; runtime driver connects over CDP.
FROM node:20-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-bookworm-slim
WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl \
  && npm install -g serve@14.2.6 \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm install playwright@1.59.1 tsx@4.22.3

COPY --from=build /app/dist/web/browser ./dist/web/browser
COPY v2 ./v2
COPY tsconfig.json ./
COPY v2/docker/runtime/entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

ENV PORT=4200
ENV RUNTIME_STATIC_ROOT=dist/web/browser
ENV RUNTIME_DRIVER_PORT=8090
ENV BROWSER_CDP_URL=http://browser:9222
ENV BROWSER_APP_BASE_URL=http://runtime:4200
ENV HOST_BROWSER_CDP_URL=http://127.0.0.1:9222

EXPOSE 4200 8090

HEALTHCHECK --interval=2s --timeout=3s --retries=15 --start-period=5s \
  CMD curl -sf "http://127.0.0.1:${PORT}/" \
  && curl -sf "http://127.0.0.1:${RUNTIME_DRIVER_PORT}/health" || exit 1

ENTRYPOINT ["./entrypoint.sh"]
