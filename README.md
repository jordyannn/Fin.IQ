<div align="center">

# Fin.IQ — AI-Powered Personal Finance & Cloud Microservices Platform

**Full-Stack Next.js 15 + 4-Service K3s Microservices + Redis Session Security + Multi-Provider AI Engine**

[![CI/CD Pipeline](https://img.shields.io/badge/CI%2FCD-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)](.github/workflows/ci-cd.yml)
[![Kubernetes](https://img.shields.io/badge/Orchestration-K3s%20%2B%20HPA-326CE5?logo=kubernetes&logoColor=white)](k8s/)
[![Next.js](https://img.shields.io/badge/Frontend-Next.js%2015%20%2B%20React%2019-000000?logo=nextdotjs&logoColor=white)](src/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript%205.7-3178C6?logo=typescript&logoColor=white)](tsconfig.json)
[![Tests](https://img.shields.io/badge/QA-Vitest%20%2B%20Playwright-6E9F18?logo=vitest&logoColor=white)](tests/)
[![License: MIT](https://img.shields.io/badge/License-MIT-10B981.svg)](LICENSE)
[![Live Demo](https://img.shields.io/badge/Live-fin--iq.my.id-059669?logo=vercel&logoColor=white)](https://fin-iq.my.id)

</div>

---

## Overview

**Fin.IQ** is an end-to-end personal finance, cashflow analytics, and AI financial advisor platform engineered to demonstrate both **modern full-stack product development** and **production-grade DevOps / cloud-native infrastructure** running efficiently inside a resource-constrained **~2 GB RAM VPS**.

### Documentation Index
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — Microservices topology, monorepo layout, Redis session lifecycle, and Nginx routing
- **[API.md](API.md)** — REST API specification for `core-api` and `ai-service`
- **[DEPLOYMENT.md](DEPLOYMENT.md)** — Cloud VPC model, K3s deployment runbook, secrets management, and operations

---

## System Architecture

```mermaid
graph TB
    User["User (Web / Mobile PWA)"]

    subgraph VPS["Linux VPS (~2 GB RAM)"]
        Nginx["Nginx Reverse Proxy (:80/:443 TLS)<br/>IP Rate Limiting + Gzip + SSE"]

        subgraph K3s["K3s Cluster (Namespace: finiq)"]
            FE["frontend (Next.js 15 SSR)<br/>:3000 | NodePort :30080"]
            API["core-api (Express 5)<br/>:4000 | NodePort :30040<br/>HPA: 1-3 Replicas (CPU 70%)"]
            AI["ai-service (Express 5)<br/>:5000 | NodePort :30050"]
            Redis["redis (Redis 7 Alpine)<br/>ClusterIP :6379 | 64MB LRU"]
        end
    end

    subgraph Cloud["Managed External Services"]
        MySQL["Managed Cloud MySQL (TLS)"]
        Gemini["Google Gemini API"]
        OpenRouter["OpenRouter Free-Tier Models"]
    end

    User -->|HTTPS :443| Nginx
    Nginx -->|/*| FE
    Nginx -->|/api/v1/*| API
    Nginx -->|/api/ai/*| AI

    FE --> API
    FE --> AI
    API --> Redis
    AI --> Redis
    API -->|Drizzle ORM Pool| MySQL
    AI -->|Drizzle ORM Pool| MySQL
    AI --> Gemini
    AI --> OpenRouter
```

---

## Key Highlights

### Full-Stack Development
- **Monorepo Workspaces**: Clean npm workspaces separating `@finiq/shared` (Drizzle schema, JWT/scrypt auth, Redis helpers, DTOs), `@finiq/core-api`, `@finiq/ai-service`, and the Next.js 15 App Router frontend.
- **Complete Cashflow Engine**: Multi-account management, income/expense/transfer ledger with automatic balance reconciliation, hierarchical categories, monthly budgets & milestone goals, interactive cashflow calendar, and 12-month annual heatmaps.
- **AI Financial Advisor & Smart Import**:
  - Natural-language Indonesian/English transaction entry & voice dictation.
  - Multimodal OCR receipt scanning and bank e-statement (CSV / Excel / PDF) batch import with intelligent category mapping.
  - Strict 2-tier **Financial Guardrail** (blocks non-financial prompts), **20 prompts/24h fair-share quota**, and automatic multi-provider fallback across **Google Gemini** and **OpenRouter**.
- **Collaborative Multi-Ledgers & PWA**: Invite collaborators via 6-digit codes, real-time sync via Server-Sent Events (SSE), responsive mobile-first PWA navigation, bilingual UI (EN/ID), and Dark/Light themes.

### DevOps, Infrastructure & Security
- **4-Service K3s Orchestration**: Dedicated manifests (`k8s/`) with `RollingUpdate` (`maxUnavailable: 0`, `maxSurge: 1`), HTTP readiness/liveness probes, strict CPU/memory budgets fit for a 2 GB node, and **HorizontalPodAutoscaler (HPA)** scaling `core-api` from 1 to 3 replicas at 70% CPU.
- **Automated Zero-Downtime CI/CD**:
  - **Pull Requests**: Automated TypeScript checks across all packages, Vitest unit/security/integration test suite, and Next.js production build verification.
  - **Main Branch**: Multi-stage Docker Buildx builds with GitHub Actions layer caching (`type=gha`), immutable commit-SHA publishing to **GHCR**, direct SSH streaming into K3s `containerd`, automated secret sync, and verified `kubectl rollout status`.
- **Defense-in-Depth Security**:
  - Dual-layer rate limiting (Nginx `limit_req_zone` + Redis atomic sliding-window IP limiter).
  - Scrypt password hashing with random per-user salts, AES-256-GCM encryption for stored personal AI keys, JWT sessions cached in Redis, and **instant logout token revocation**.
- **Automated Quality Assurance**: 77 Vitest unit/security/integration tests (Supertest) + 14 Playwright E2E and mobile responsiveness specs.

---

## Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript 5.7, Tailwind CSS, Radix UI, Recharts, Zustand, TanStack Query |
| **Backend & API** | Express 5 (`core-api`, `ai-service`), tRPC v11, Zod, Drizzle ORM, Server-Sent Events (SSE) |
| **Data & Caching** | MySQL (Managed Cloud TLS), Redis 7 Alpine (`ioredis`) |
| **AI & Parsing** | Google Gemini (`@google/genai`), OpenRouter API, PapaParse, SheetJS (`xlsx`) |
| **DevOps & Cloud** | Docker (Multi-stage builds), Kubernetes (K3s + HPA), Nginx, Let's Encrypt Certbot, GitHub Actions, GHCR |
| **Testing & QA** | Vitest, Supertest, Playwright (Desktop + Mobile E2E) |

---

## Project Structure

```text
Fin.IQ/
├── .github/workflows/ci-cd.yml   # PR verification + Multi-service K3s CI/CD pipeline
├── k8s/                          # K3s namespace, deployments, services, HPA, Nginx config
├── packages/
│   ├── shared/                   # @finiq/shared: Drizzle schema, auth/crypto, Redis, shared types
│   ├── core-api/                 # @finiq/core-api: REST financial ledger, auth & analytics service
│   └── ai-service/               # @finiq/ai-service: Financial advisor, guardrails, NLP & OCR service
├── src/
│   ├── app/                      # Next.js 15 App Router pages & API routes
│   ├── components/               # Reusable UI components & charts
│   ├── lib/                      # Client helpers, i18n, taxonomy dictionary
│   └── server/                   # tRPC routers, server utilities & AI orchestration
├── tests/
│   ├── unit/                     # Financial logic, crypto/security, guardrail & PDF fallback tests
│   ├── integration/              # Core API & AI service Supertest suites
│   └── e2e/                      # Playwright desktop & mobile PWA end-to-end specs
├── Dockerfile                    # Multi-stage standalone Next.js production container
└── docker-compose.yml            # Local full-stack & Redis orchestration
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- MySQL 8+ (local Docker or Managed Cloud MySQL)
- Optional: Redis 7+ (falls back gracefully for local dev)

### 2. Install & Configure
```bash
git clone https://github.com/jordyannn/Fin.IQ.git
cd Fin.IQ
npm install
cp .env.example .env.local
```

Update `.env.local` with your database connection and secrets:
```env
DATABASE_URL="mysql://user:password@127.0.0.1:3306/defaultdb"
NEXTAUTH_SECRET="replace-with-random-32-plus-char-secret"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_DEFAULT_CURRENCY="IDR"
# Optional AI keys (or configure per-user inside Settings)
OPENROUTER_API_KEY=""
GEMINI_API_KEY=""
```

### 3. Push Schema & Run
```bash
# Sync Drizzle schema to MySQL
npm run db:push

# Run frontend development server
npm run dev

# Or run all microservice workspaces (core-api :4000, ai-service :5000)
npm run dev:all
```

Open [http://localhost:3000](http://localhost:3000) and click **Sign In Demo Account (Owner)** to explore immediately.

---

## Testing & Verification

```bash
# Run all 77 unit, security & API integration tests
npm test

# Run Playwright E2E suite (desktop + mobile)
npm run test:e2e

# Verify TypeScript across all workspaces
cd packages/shared && npx tsc --noEmit
cd packages/core-api && npx tsc --noEmit
cd packages/ai-service && npx tsc --noEmit
npm run build
```

---

## Docker & K3s Deployment

```bash
# Local containerized run with Redis
docker compose up -d --build
```

For full production K3s setup, secrets provisioning, and Nginx TLS configuration, see **[DEPLOYMENT.md](DEPLOYMENT.md)** and **[k8s/README.md](k8s/README.md)**.

---

## Security Practices

- Secrets are never committed to version control; production keys live exclusively in GitHub Actions Secrets and K3s `finiq-secrets`.
- User passwords are hashed with Node.js `crypto.scrypt` and unique random salts.
- Personal AI API keys are encrypted at rest (`AES-256-GCM`) and masked in API responses.
- Logout immediately evicts the active session from Redis and registers the JWT in a revocation blacklist.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

Built by [jordyannn](https://github.com/jordyannn) — feel free to explore, fork, or reach out for collaboration on Full-Stack & DevOps engineering opportunities.
