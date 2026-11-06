# Fin.IQ — manifest k3s

Cara pakai: `kubectl apply -f k8s/`

## Yang TIDAK ada di folder ini (sengaja)

Dua resource dibuat manual di cluster, tidak di-commit ke git:

### 1. `finiq-secrets` — env produksi

Diambil dari `/var/www/fin-iq/.env.local` di server (file itu di-gitignore).

```bash
kubectl -n finiq create secret generic finiq-secrets \
  --from-literal=DATABASE_URL="..." \
  --from-literal=OPENROUTER_API_KEY="..." \
  --from-literal=GEMINI_API_KEY="" \
  --from-literal=NEXTAUTH_URL="..." \
  --from-literal=NEXTAUTH_SECRET="..." \
  --from-literal=NEXT_PUBLIC_DEFAULT_CURRENCY="IDR" \
  --from-literal=DEMO_USER_ID="default-user-uuid-1" \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 2. `ghcr-secret` — fallback pull dari ghcr.io (opsional)

Normalnya TIDAK dipakai: workflow mentransfer image ke server lalu
meng-import-nya ke containerd lokal (lihat "Alur deploy"). Secret ini
cuma cadangan kalau nanti mau pull langsung dari ghcr.

```bash
kubectl -n finiq create secret docker-registry ghcr-secret \
  --docker-server=ghcr.io \
  --docker-username=jordyannn \
  --docker-password="<PAT>"
```

## Alur deploy

GitHub Actions build 3 microservices image → push ke `ghcr.io/jordyannn/finiq-*:<sha>` dan `:latest`
→ runner pull image → `docker save` kedua tag (sha & latest) → stream terkompresi `gzip` via SSH ke server
→ `k3s ctr images import -` → verifikasi ketersediaan image di containerd
→ templating tag sha ke manifest `k8s/*/deployment.yaml` → `kubectl apply -R -f k8s/` → rollout.

Image di-import dengan kedua tag (`:<sha>` dan `:latest`), dan `imagePullPolicy: IfNotPresent`,
jadi k3s langsung memakai image lokal tanpa pull ulang dari GHCR (server tidak butuh registry secret).
Templating tag SHA langsung ke manifest sebelum apply mencegah double rollout dan race condition `set image`.

## Topologi traffic

```
Internet → Nginx (VM, :80/:443, TLS certbot) → 127.0.0.1:30080 (NodePort) → Service finiq → Pod
```

## Catatan resource

Node cuma ~1.9 GB RAM. k3s ~400 MB, Hermes ~420 MB, sisanya ~1 GB untuk pod.
Next.js ~120–150 MB per replika, jadi `maxReplicas: 3` itu batas aman.
Kalau perlu lebih, tambah node atau naikkan spek VPS.
