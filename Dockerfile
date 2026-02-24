# syntax=docker/dockerfile:1.7

FROM node:22.12.0-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json ./
COPY src ./src
COPY README.md LICENSE system_prompt.md birdweather_api.json ebird_api.json ./

RUN npm run build
RUN npm prune --omit=dev

FROM node:22.12.0-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    MCP_TRANSPORT=stdio \
    MCP_HTTP_HOST=0.0.0.0 \
    MCP_HTTP_PORT=3000 \
    MCP_HTTP_PATH=/mcp

LABEL org.opencontainers.image.title="mcp-server-birdstats" \
      org.opencontainers.image.description="MCP server exposing BirdWeather and eBird schema/context tools" \
      org.opencontainers.image.licenses="MIT"

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

EXPOSE 3000

ENTRYPOINT ["node", "dist/index.js"]
