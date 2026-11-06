# syntax=docker/dockerfile:1
# Multi-stage lightweight Dockerfile for Next.js 15 (Standalone)
#
# PENTING: secret TIDAK di-bake ke image. Nilai runtime (DATABASE_URL,
# GEMINI_API_KEY, dll) diinjeksikan k3s dari Secret saat container jalan.
# Yang ada di file ini hanya nilai build-time, hidup di stage `builder`
# yang dibuang, jadi tidak ikut terbawa ke image final.

# -----------------------------------------------------------------------------
# Stage 1: Base Alpine
# -----------------------------------------------------------------------------
FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache libc6-compat

# -----------------------------------------------------------------------------
# Stage 2: Dependencies Cache
# -----------------------------------------------------------------------------
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/core-api/package.json ./packages/core-api/
COPY packages/ai-service/package.json ./packages/ai-service/
RUN npm ci --prefer-offline --no-audit

# -----------------------------------------------------------------------------
# Stage 3: Builder
# -----------------------------------------------------------------------------
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time only. Next.js butuh DATABASE_URL saat `next build` (static generation).
# Diteruskan dari GitHub Actions lewat --build-arg, BUKAN ditulis di sini,
# supaya tidak kebaked ke image final.
ARG DATABASE_URL
ARG OPENROUTER
ARG GEMINI
ARG OPENROUTER_API_KEY
ARG GEMINI_API_KEY
ENV NEXT_TELEMETRY_DISABLED=1 \
    NODE_ENV=production \
    DATABASE_URL=$DATABASE_URL \
    OPENROUTER=$OPENROUTER \
    GEMINI=$GEMINI \
    OPENROUTER_API_KEY=$OPENROUTER_API_KEY \
    GEMINI_API_KEY=$GEMINI_API_KEY

RUN npm run build

# -----------------------------------------------------------------------------
# Stage 4: Production Runner (Ultra-Lightweight ~130MB)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner
WORKDIR /app

# Env runtime (DATABASE_URL, GEMINI_API_KEY, dll) diinjeksikan k3s dari Secret.
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME="0.0.0.0"

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Set correct permission for prerender and image cache
RUN mkdir -p .next/cache && chown -R nextjs:nodejs .next

# Copy static assets and standalone server
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["node", "server.js"]
