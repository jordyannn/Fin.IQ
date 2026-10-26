FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core-api/package.json ./packages/core-api/
RUN npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY packages/shared ./packages/shared
COPY packages/core-api ./packages/core-api
RUN cd packages/core-api && npx tsc

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 finiq
COPY --from=builder --chown=finiq:nodejs /app/packages/core-api/dist ./dist
COPY --from=builder --chown=finiq:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=finiq:nodejs /app/packages/shared ./packages/shared
USER finiq
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s CMD wget --spider http://127.0.0.1:4000/health || exit 1
CMD ["node", "dist/index.js"]
