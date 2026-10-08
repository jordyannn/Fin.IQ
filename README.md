# 🚀 Fin.IQ — Cloud Financial Management

> Rebuild & Modernisasi Total dari BeeCount Cloud ke Next.js 15, Drizzle ORM, tRPC, Shadcn/ui, dan Serverless PostgreSQL (Neon).

---

## 🌟 Fitur Utama

1. **Full Feature Parity**:
   - Transaksi: Pemasukan (*Income*), Pengeluaran (*Expense*), dan Pindah Buku (*Transfer*).
   - Akun: Manajemen multi-akun (**Cash**, **Blu**, **Dana**, Kartu Kredit).
   - Kategori & Sub-Kategori bertingkat dengan kustomisasi ikon.
   - Anggaran (*Budgets*): Monitoring batas belanja per kategori dengan progress bar visual.
   - Kalender Transaksi: Tinjau mutasi harian secara interaktif.
   - Laporan Analisis & Tahunan: Diagram tren arus kas bulanan dan breakdown pengeluaran.
   - Multi-buku Kas (*Ledgers*) & Kolaborasi via kode undangan 6-digit.
   - PWA (Progressive Web App): Desain responsif khusus layar smartphone (Mobile Bottom Navigation).
   - AI Smart Entry & Voice Dictation (Bahasa Indonesia).
   - Keamanan: Proteksi rute, 2FA TOTP Authenticator, dan Personal Access Token (PAT) untuk MCP Claude/Cursor.

---

## 🛠️ Stack Teknologi

- **Frontend**: Next.js 15 (App Router) + React 19 + TypeScript
- **Styling**: Tailwind CSS + Shadcn/ui (Light Mode default + Dark Mode toggle)
- **API Layer**: tRPC v11 (End-to-end type safe)
- **Database**: Serverless PostgreSQL (Neon / Vercel Postgres)
- **ORM**: Drizzle ORM
- **State Management**: Zustand
- **Realtime Sync**: Server-Sent Events (SSE)

---

## 🏁 Panduan Memulai Cepat

### 1. Masuk ke Direktori Project
```bash
cd "c:\Users\BRAVO\Documents\docker count\Fin.IQ"
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Konfigurasi Database (.env.local)
Buka file `.env.local` dan masukkan connection string database Neon Postgres Anda:
```env
DATABASE_URL="postgres://username:password@ep-sample.us-east-2.aws.neon.tech/neondb?sslmode=require"
```

### 4. Push Schema ke Database
```bash
npm run db:push
```

### 5. Jalankan Seeder Akun Eksisting (Cash, Blu, Dana)
Script ini akan langsung meng-injeksi 3 akun keuangan utama Anda dengan saldo awal:
- **`cash`** (Group: Cash) — Saldo: **Rp 158.000**
- **`blu`** (Group: Bank card) — Saldo: **Rp 3.670.000**
- **`dana`** (Group: Alipay) — Saldo: **Rp 3.400**

```bash
npm run seed:accounts
```

### 6. Import Histori Transaksi dari File CSV
Untuk mengimpor file CSV histori transaksi dan memetakannya otomatis ke 3 akun di atas:
```bash
npm run import:transactions
# atau gunakan file CSV kustom:
npm run import:transactions -- "path/ke/file-transaksi.csv"
```

### 7. Jalankan Server Development
```bash
npm run dev
```
Buka browser di [http://localhost:3000](http://localhost:3000).

---

## ☁️ Deployment ke Vercel

1. Push repository Fin.IQ ini ke GitHub.
2. Di Dashboard [Vercel](https://vercel.com):
   - Klik **Add New Project** ➔ Import repository Fin.IQ.
   - Hubungkan ke **Vercel Postgres (Neon)** dari tab *Storage*.
   - Tambahkan Environment Variable: `NEXTAUTH_SECRET` dan `DATABASE_URL`.
3. Klik **Deploy** — Aplikasi langsung live dalam hitungan detik!
