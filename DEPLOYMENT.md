# Dokumentasi Konteks Deployment Fin.IQ

Dokumen ini mencatat seluruh arsitektur infrastruktur, data server cloud, konfigurasi jaringan VPC, dan panduan operasional deployment aplikasi **Fin.IQ** di **Tencent Cloud**.

---

## 1. Data Spesifikasi Server & Cloud Provider

| Parameter | Nilai Konfigurasi | Keterangan |
| :--- | :--- | :--- |
| **Cloud Provider** | Tencent Cloud | Layanan Cloud Hosting |
| **Produk Instance** | Tencent Cloud Lighthouse (VPS) | Compute Instance |
| **Nama Instance** | `Ubuntu-A5J1` | Hostname Server |
| **Instance ID** | `lhins-fki22xfp` | ID Resource Tencent Cloud |
| **Sistem Operasi** | Ubuntu Linux (LTS) | OS Server |
| **Public IP (IPv4)** | `43.163.5.111` | Akses Publik / Internet |
| **Region / Wilayah** | Guangzhou (Region ID: `rid=9`) | Lokasi Data Center |
| **Availability Zone** | Guangzhou Zone 2 & Zone 3 | Zona Ketersediaan |

---

## 2. Arsitektur Jaringan VPC & Subnet

Aplikasi terhubung ke Virtual Private Cloud (VPC) dedicated:

| Resource | Nama / ID | CIDR Block | Lokasi Zone | Keterangan |
| :--- | :--- | :--- | :--- | :--- |
| **VPC Utama** | `VPC-Finiq-Prod`<br>(`vpc-1lx11xvt`) | `10.0.0.0/16` | Guangzhou | Jaringan privat terisolasi Fin.IQ |
| **Public Subnet** | `Public-Finiq-Subnet-Prod`<br>(`subnet-heim3244`) | `10.0.0.0/24` | Guangzhou Zone 2 | Subnet untuk Server Web & Akses Publik (253 IP) |
| **Private Subnet** | `Private-Finiq-Subnet-Prod`<br>(`subnet-d1ft7d8a`) | `10.0.1.0/24` | Guangzhou Zone 3 | Subnet untuk Database / Internal Service (253 IP) |
| **Route Table** | `rtb-mi8i78ue` | Default Route | - | Tabel rute gateway internet & lokal |

---

## 3. Konfigurasi Firewall & Inbound Rules (Lighthouse)

Aturan firewall (*Inbound Rules*) yang aktif pada instance `Ubuntu-A5J1`:

| Tipe / Layanan | Protokol | Port | Source | Status / Kebijakan | Fungsi |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Linux Login (SSH)** | TCP | `22` | `0.0.0.0/0` | **ALLOW** | Akses remote administrasi terminal server |
| **Web HTTP** | TCP | `80` | `0.0.0.0/0` | **ALLOW** | Akses web browser (Nginx Reverse Proxy) |
| **Web HTTPS** | TCP | `443` | `0.0.0.0/0` | **ALLOW** | Akses web aman berenkripsi SSL (Let's Encrypt) |
| **Custom App Port** | TCP | `3000` | `0.0.0.0/0` | **ALLOW** | Port internal aplikasi Next.js (bisa untuk tes langsung) |
| **Ping** | ICMP | `ALL` | `0.0.0.0/0` | **ALLOW** | Diagnostic latensi jaringan |

---

## 4. Stack Aplikasi & Lingkungan Runtime

- **Aplikasi**: Fin.IQ (Personal Finance & Expense Engine)
- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + Radix UI + Hallmark Design System (`tokens.css`)
- **Runtime**: Node.js 20 LTS
- **Process Manager**: PM2 Cluster Mode (`ecosystem.config.js`)
- **Web Server / Reverse Proxy**: Nginx
- **Database ORM**: Drizzle ORM (MySQL dialect)
- **AI Engine**: Google Gemini API (`@google/genai`)
- **Direktori Server**: `/var/www/fin-iq`
- **Git Repository**: `https://github.com/jordyannn/Fin.IQ.git` (Branch: `main`)

---

## 5. Ringkasan File Environment Produksi (`.env.local`)

Lokasi file di server: `/var/www/fin-iq/.env.local`

```env
# Koneksi Database MySQL (Aiven / RDS / Cloud MySQL)
DATABASE_URL="mysql://avnadmin:PASSWORD@HOST_MYSQL:PORT/defaultdb"

# NextAuth Authentication
NEXTAUTH_SECRET="koderandom32karakteruntukkeamanansession"
NEXTAUTH_URL="http://43.163.5.111"

# Google Gemini API
GEMINI_API_KEY="AIzaSy..."

# Konfigurasi Finansial Fin.IQ
NEXT_PUBLIC_DEFAULT_CURRENCY="IDR"
DEMO_USER_ID="default-user-uuid-1"
NODE_ENV="production"
PORT=3000
```

---

## 6. Prosedur Operasional Deployment & Maintenance

### A. Membuka Terminal Server
- **Opsi Web (Termudah)**: Buka dashboard Tencent Cloud Lighthouse, pada instance `Ubuntu-A5J1` klik tombol biru **`Log in`**.
- **Opsi SSH Laptop**:
  ```bash
  ssh ubuntu@43.163.5.111
  ```

---

### B. Setup Awal Server (One-Time Setup)
### B. Metode 1: Deploy Menggunakan Docker Compose (Direkomendasikan & Sangat Ringan)

Fin.IQ menggunakan arsitektur container ringan yang terhubung langsung ke **Aiven Cloud MySQL** (total konsumsi RAM hanya **~120MB**).

```bash
# 1. Install Docker & Docker Compose di Ubuntu jika belum ada:
sudo apt update && sudo apt install -y docker.io docker-compose-v2
sudo systemctl enable --now docker
sudo usermod -aG docker $USER

# 2. Clone repository ke server:
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/jordyannn/Fin.IQ.git fin-iq
sudo chown -R $USER:$USER /var/www/fin-iq
cd /var/www/fin-iq

# 3. Jalankan Fin.IQ App dengan 1 perintah:
docker compose up -d --build

# 4. Cek status container yang berjalan:
docker compose ps
docker compose logs -f finiq-app
```
> Aplikasi langsung terhubung ke database cloud Aiven MySQL dengan SSL aman!

---

### C. Metode 2: Deploy Native Node.js 20 + PM2 (Alternatif Tanpa Docker)
```bash
# 1. Update sistem dan install Node 20, Git, Nginx, PM2
sudo apt update && sudo apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git nginx build-essential
sudo npm install -g pm2

# 2. Clone repository ke /var/www/fin-iq
sudo mkdir -p /var/www
cd /var/www
sudo git clone https://github.com/jordyannn/Fin.IQ.git fin-iq
sudo chown -R $USER:$USER /var/www/fin-iq
cd /var/www/fin-iq

# 3. Setup file .env.local
nano .env.local
# (Paste isian environment, simpan dengan Ctrl+O, Enter, Ctrl+X)

# 4. Install dependensi, sinkronkan skema database, & build Next.js
npm install
npm run db:push
npm run build

# 5. Jalankan aplikasi dengan PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

---

### D. Konfigurasi Nginx (Reverse Proxy Port 80 -> 3000)
File konfigurasi: `/etc/nginx/sites-available/fin-iq`

```nginx
server {
    listen 80;
    server_name fin-iq.my.id www.fin-iq.my.id;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Aktifkan site Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/fin-iq /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Pasang SSL Gratis (HTTPS) Certbot:
```bash
sudo certbot --nginx -d fin-iq.my.id -d www.fin-iq.my.id
```

---

### E. Alur Pembaruan Kode (Deploy Update Rutin)
Setiap kali Anda selesai melakukan *push* update kode baru dari laptop ke GitHub:

**Jika menggunakan Docker:**
```bash
cd /var/www/fin-iq
git pull origin main
docker compose up -d --build
```

**Jika menggunakan PM2:**
```bash
cd /var/www/fin-iq
git pull origin main
npm install
npm run build
pm2 reload fin-iq
```

---

### F. Perintah Cek Status & Debugging
- Cek container Docker: `docker compose ps`
- Cek log Docker: `docker compose logs -f`
- Cek PM2 (jika pakai PM2): `pm2 status`
- Cek status web server Nginx: `sudo systemctl status nginx`
- Cek log error Nginx: `sudo tail -f /var/log/nginx/error.log`
