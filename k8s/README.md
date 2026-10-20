# Fin.IQ — manifest k3s

Cara pakai: `kubectl apply -f k8s/`

## Yang TIDAK ada di folder ini (sengaja)

Dua resource dibuat manual di cluster, tidak di-commit ke git:

### 1. `finiq-secrets` — env produksi

Diambil dari `/var/www/fin-iq/.env.local` di server (file itu di-gitignore).

```bash
kubectl -n finiq create secret generic finiq-secrets \
  --from-literal=DATABASE_URL="..." \
  --from-literal=GEMINI_API_KEY="..." \
  --from-literal=NEXTAUTH_URL="..." \
  --from-literal=NEXTAUTH_SECRET="..." \
  --from-literal=NEXT_PUBLIC_DEFAULT_CURRENCY="IDR" \
  --from-literal=DEMO_USER_ID="default-user-uuid-1" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 2. `ghcr-secret` — credential untuk pull image privat dari ghcr.io

```bash
kubectl -n finiq create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=jordyannn \
  --docker-password="<PAT dengan scope read:packages>"
```

PAT dibuat di https://github.com/settings/tokens (classic, scope `read:packages`).

## Alur deploy

GitHub Actions build image → push ke `ghcr.io/jordyannn/fin-iq:<sha>`
→ SSH ke server → `kubectl apply -f k8s/` → `kubectl set image` → rollout.

## Topologi traffic

```
Internet → Nginx (VM, :80/:443, TLS certbot) → 127.0.0.1:30080 (NodePort) → Service finiq → Pod
```

## Catatan resource

Node cuma ~1.9 GB RAM. k3s ~400 MB, Hermes ~420 MB, sisanya ~1 GB untuk pod.
Next.js ~120–150 MB per replika, jadi `maxReplicas: 3` itu batas aman.
Kalau perlu lebih, tambah node atau naikkan spek VPS.
