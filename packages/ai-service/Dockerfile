FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core-api/package.json ./packages/core-api/
COPY packages/ai-service/package.json ./packages/ai-service/
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY packages/ai-service ./packages/ai-service
RUN cd packages/shared && npx tsc
RUN cd packages/ai-service && npx tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 finiq
COPY --from=builder --chown=finiq:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=finiq:nodejs /app/packages/shared ./packages/shared
COPY --from=builder --chown=finiq:nodejs /app/packages/ai-service/dist ./packages/ai-service/dist
COPY --from=builder --chown=finiq:nodejs /app/packages/ai-service/package.json ./packages/ai-service/package.json

WORKDIR /app/packages/ai-service
USER finiq
EXPOSE 5000
HEALTHCHECK --interval=30s --timeout=5s CMD wget --spider http://127.0.0.1:5000/health || exit 1
CMD ["node", "dist/index.js"]
