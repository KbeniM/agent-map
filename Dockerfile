FROM oven/bun:1.4.4 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --ignore-scripts
COPY apps apps
COPY packages packages
RUN VITE_BRIDGE_URL= bun run --filter '@agent-map/web' build

FROM oven/bun:1.4.4
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 BRIDGE_PORT=4000 DATA_DIR=/data STATIC_DIR=/app/apps/web/dist
COPY package.json bun.lock bunfig.toml tsconfig.base.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN bun install --frozen-lockfile --production --ignore-scripts
COPY apps/api apps/api
COPY packages/shared packages/shared
COPY --from=build /app/apps/web/dist apps/web/dist
RUN mkdir -p /data && chown bun:bun /data
USER bun
VOLUME /data
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=3s CMD bun -e "fetch('http://127.0.0.1:4000/v1/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"
CMD ["bun", "apps/api/src/index.ts"]
