# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

# Stage 2: Builder
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build
RUN npm run build:mcp

# Stage 3: Runner
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV MCP_TRANSPORT=sse
ENV MCP_PORT=3001

# Copy built assets
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

# Entrypoint script to run both UI and MCP
RUN echo '#!/bin/sh\nnpm run start & npm run start:mcp' > entrypoint.sh && chmod +x entrypoint.sh

EXPOSE 3000 3001

CMD ["./entrypoint.sh"]
