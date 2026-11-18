# Fin.IQ Deployment & Infrastructure Runbook

This document outlines the cloud infrastructure topology, VPC networking model, container orchestration (K3s), Nginx reverse proxy setup, and operational procedures for deploying **Fin.IQ**.

> **Security Note:** All production IP addresses, cloud resource IDs, and credentials in this public runbook are intentionally replaced with placeholders (`<...>`). Inject real values exclusively via GitHub Actions Secrets, Kubernetes Secrets (`finiq-secrets`), or local `.env.local` files on the target host.

---

## 1. Compute & Cloud Infrastructure Profile

| Parameter | Configuration | Description |
| :--- | :--- | :--- |
| **Cloud Provider** | Tencent Cloud (or any Linux VPS) | Cloud Infrastructure |
| **Compute Tier** | Lightweight VPS (~2 vCPU / ~2 GB RAM) | Single-Node K3s Host |
| **Hostname** | `<VPS_HOSTNAME>` | Server Hostname |
| **Instance ID** | `<CLOUD_INSTANCE_ID>` | Cloud Resource Identifier |
| **Operating System** | Ubuntu Linux (LTS) | Host OS |
| **Public IP (IPv4)** | `<VPS_PUBLIC_IP>` | Public Ingress Endpoint |
| **Region** | Asia-Pacific (Multi-AZ VPC) | Data Center Region |

---

## 2. VPC & Network Architecture

The production deployment uses a segmented Virtual Private Cloud (VPC) pattern:

| Resource | Name / Placeholder ID | CIDR Block | Role |
| :--- | :--- | :--- | :--- |
| **VPC** | `VPC-Finiq-Prod` (`<VPC_ID>`) | `10.0.0.0/16` | Isolated cloud network |
| **Public Subnet** | `Public-Finiq-Subnet-Prod` (`<PUBLIC_SUBNET_ID>`) | `10.0.0.0/24` | Public ingress & Nginx TLS termination |
| **Private Subnet** | `Private-Finiq-Subnet-Prod` (`<PRIVATE_SUBNET_ID>`) | `10.0.1.0/24` | Internal services / private backend tier |
| **Route Table** | `<ROUTE_TABLE_ID>` | Default Route | Internet gateway & internal routing |

---

## 3. Firewall & Inbound Security Rules

Recommended firewall policy for production hardening:

| Service | Protocol | Port | Recommended Source | Policy | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Web HTTP** | TCP | `80` | `0.0.0.0/0` | **ALLOW** | ACME Certbot challenge & HTTP → HTTPS redirect |
| **Web HTTPS** | TCP | `443` | `0.0.0.0/0` | **ALLOW** | Encrypted production traffic via Nginx (TLS 1.2/1.3) |
| **SSH Admin** | TCP | `22` | `<ADMIN_IP>/32` or Bastion/VPN | **RESTRICTED** | Key-only remote administration (disable password auth) |
| **Internal NodePorts** | TCP | `30040`, `30050`, `30080` | `127.0.0.1` only | **DENY PUBLIC** | Exposed strictly to local Nginx reverse proxy |

---

## 4. Production Runtime Stack

- **Application**: Fin.IQ (AI-Powered Personal Finance & Cashflow Platform)
- **Architecture**: 4-Service Microservices Monorepo (`frontend`, `core-api`, `ai-service`, `redis`)
- **Orchestration**: K3s (Lightweight Kubernetes) with `HorizontalPodAutoscaler` (HPA) on `core-api` (1–3 replicas @ 70% CPU)
- **Reverse Proxy & TLS**: Nginx + Let's Encrypt Certbot + IP Rate Limiting Zones (`60r/m` Core API, `30r/m` AI API)
- **Primary Database**: Managed Cloud MySQL (Aiven MySQL over TLS) via Drizzle ORM
- **Cache & Session Layer**: Redis 7 Alpine (`64MB`, `allkeys-lru`) for JWT session caching, instant logout revocation, and sliding-window rate limiting
- **CI/CD**: GitHub Actions (`.github/workflows/ci-cd.yml`) → GHCR → SSH stream to K3s `containerd` → Atomic `kubectl apply` rolling updates (`maxUnavailable: 0`)

---

## 5. Production Environment Variables (`.env.local` / K8s Secret)

Never commit real secrets. Create the Kubernetes Secret (`finiq-secrets`) directly in the `finiq` namespace:

```bash
kubectl -n finiq create secret generic finiq-secrets \
  --from-literal=DATABASE_URL="mysql://<DB_USER>:<DB_PASSWORD>@<DB_HOST>:<DB_PORT>/defaultdb" \
  --from-literal=NEXTAUTH_SECRET="<RANDOM_32_PLUS_CHAR_SECRET>" \
  --from-literal=NEXTAUTH_URL="https://fin-iq.my.id" \
  --from-literal=OPENROUTER_API_KEY="<OPENROUTER_API_KEY>" \
  --from-literal=GEMINI_API_KEY="<GEMINI_API_KEY>" \
  --from-literal=NEXT_PUBLIC_DEFAULT_CURRENCY="IDR" \
  --from-literal=DEMO_USER_ID="default-user-uuid-1" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### Required GitHub Actions Secrets (`.github/workflows/ci-cd.yml`)

| Secret Name | Purpose |
| :--- | :--- |
| `DATABASE_URL` | Managed MySQL connection string (SSL enabled) |
| `NEXTAUTH_SECRET` | Session signing secret (minimum 32 random chars) |
| `SERVER_HOST` | Production VPS IP or SSH hostname |
| `SERVER_USERNAME` | SSH deploy user (e.g. `ubuntu`) |
| `SERVER_SSH_KEY` | Dedicated Ed25519 private key for CI/CD deploy |
| `SERVER_PORT` | Optional SSH port (defaults to `22`) |
| `OPENROUTER_API_KEY` | OpenRouter API key synced to K3s `finiq-secrets` |
| `GEMINI_API_KEY` | Google Gemini API key synced to K3s `finiq-secrets` |

---

## 6. Deployment Options

### Option A: Automated K3s Microservices Deployment (Production Default)

Every push to `main` triggers `.github/workflows/ci-cd.yml`:
1. Builds 3 multi-stage Docker images (`frontend`, `core-api`, `ai-service`) using Docker Buildx with GitHub Actions layer caching (`type=gha`).
2. Pushes immutable commit-SHA tags (`:<sha>`) and `:latest` to `ghcr.io`.
3. Streams images over SSH into the VPS K3s `containerd` runtime (`k3s ctr -n k8s.io images import -`) and verifies image indexing before applying manifests.
4. Templates the exact commit SHA into `k8s/*/deployment.yaml` and runs `kubectl apply -R -f k8s/`.
5. Monitors `kubectl rollout status` across all deployments with automatic pod/log diagnostics on failure.

### Option B: Local / Single-Host Docker Compose

```bash
cp .env.example .env.local
# Fill in DATABASE_URL, NEXTAUTH_SECRET, and optional AI keys
docker compose up -d --build
docker compose ps
```

### Option C: Nginx Reverse Proxy + Let's Encrypt SSL

Use the version-controlled reverse proxy template in [`k8s/nginx.conf`](k8s/nginx.conf):

```bash
sudo cp k8s/nginx.conf /etc/nginx/sites-available/fin-iq
sudo ln -sf /etc/nginx/sites-available/fin-iq /etc/nginx/sites-enabled/fin-iq
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d fin-iq.my.id -d www.fin-iq.my.id
```

---

## 7. Operational Verification & Diagnostics

```bash
# Check Kubernetes pods, services, and autoscaler
kubectl -n finiq get pods -o wide
kubectl -n finiq get svc
kubectl -n finiq get hpa

# Inspect live service logs
kubectl -n finiq logs -l component=core-api --tail=100 -f
kubectl -n finiq logs -l component=ai-service --tail=100 -f

# Verify Nginx & TLS
sudo systemctl status nginx
sudo tail -f /var/log/nginx/error.log
```
