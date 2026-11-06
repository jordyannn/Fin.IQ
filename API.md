# 📖 Fin.IQ REST API Documentation

Dokumentasi resmi seluruh REST API endpoint untuk **Fin.IQ Microservices** (`core-api` & `ai-service`).

---

## 📌 Informasi Dasar

### Base URL
| Lingkungan | Core API Service | AI Service | Melalui Nginx (Produksi) |
| :--- | :--- | :--- | :--- |
| **Lokal (Dev)** | `http://localhost:4000` | `http://localhost:5000` | - |
| **K3s Cluster (Internal)** | `http://core-api:4000` | `http://ai-service:5000` | - |
| **Produksi (Public)** | `https://fin-iq.my.id/api/v1` | `https://fin-iq.my.id/api/ai` | `https://fin-iq.my.id` |

### Format Standar Header Request
```http
Authorization: Bearer <TOKEN_JWT_SESI>
Content-Type: application/json
Accept: application/json
```

### Rate Limiting Headers
Semua endpoint dilindungi oleh Redis Rate Limiter dan mengembalikan header berikut pada respon:
- `X-RateLimit-Limit`: Jumlah kuota request per jendela waktu (contoh: `60` atau `120`).
- `X-RateLimit-Remaining`: Sisa kuota request yang masih dapat dikirim.
- `Retry-After`: Jumlah detik yang harus ditunggu jika kuota habis (HTTP `429 Too Many Requests`).

---

## 🔐 1. Otentikasi & Sesi (Core API)

### 1.1 Login Pengguna
Memverifikasi kredensial, mencatat percobaan login di Redis, dan menerbitkan token JWT sesi.

- **URL**: `/auth/login`
- **Method**: `POST`
- **Auth**: Tidak perlu
- **Rate Limit**: 20 request/menit per IP

#### Request Body
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "e2a1b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "email": "user@example.com",
    "displayName": "User Fin.IQ",
    "primaryCurrency": "IDR",
    "isAdmin": false
  }
}
```

#### Respon Gagal (`401 Unauthorized`)
```json
{
  "success": false,
  "error": "Unauthorized",
  "message": "Email atau kata sandi tidak sesuai."
}
```

---

### 1.2 Registrasi Pengguna Baru
Mendaftarkan akun baru, membuat profil, buku kas utama default, rekening kas tunai, dan 19 kategori awal.

- **URL**: `/auth/register`
- **Method**: `POST`
- **Auth**: Tidak perlu

#### Request Body
```json
{
  "email": "newuser@example.com",
  "password": "securePassword123",
  "displayName": "Budi Santoso",
  "primaryCurrency": "IDR"
}
```

#### Respon Sukses (`201 Created`)
```json
{
  "success": true,
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "f3b2c1a0-9e8d-7c6b-5a4f-3e2d1c0b9a8f",
    "email": "newuser@example.com",
    "displayName": "Budi Santoso",
    "primaryCurrency": "IDR",
    "isAdmin": false
  }
}
```

---

### 1.3 Ambil Data Sesi Saat Ini
Mengambil profil akun yang sedang login (didukung Redis session caching instan).

- **URL**: `/auth/me`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "user": {
    "id": "e2a1b3c4-d5e6-7f8a-9b0c-1d2e3f4a5b6c",
    "email": "user@example.com",
    "displayName": "Budi Santoso",
    "avatarUrl": null,
    "primaryCurrency": "IDR",
    "themePrimaryColor": "#00B569",
    "isAdmin": false,
    "totpEnabled": false
  }
}
```

---

### 1.4 Logout Pengguna (Automasi Hapus Sesi Redis)
Menghapus sesi login dari Redis secara realtime dan memasukkan token ke daftar blacklist revocations.

- **URL**: `/auth/logout`
- **Method**: `POST`
- **Auth**: `Bearer <token>` (atau kirim `{ "token": "..." }` di body)

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "message": "Berhasil keluar dari akun. Sesi Redis telah dihapus."
}
```

---

## 👤 2. Profil & Pengaturan Pengguna (Core API)

### 2.1 Ambil Detail Profil & Statistik
- **URL**: `/users/profile`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": {
    "id": "e2a1b3c4-...",
    "email": "user@example.com",
    "displayName": "Budi Santoso",
    "avatarUrl": null,
    "primaryCurrency": "IDR",
    "themePrimaryColor": "#00B569",
    "totpEnabled": false,
    "createdAt": "2026-01-15T08:00:00.000Z",
    "accountCount": 3,
    "transactionCount": 142,
    "totalBalance": 15450000,
    "geminiApiKeyMasked": "AIzaSy••••A1b2",
    "hasGeminiKey": true,
    "isPersonalKey": true
  }
}
```

---

### 2.2 Perbarui Profil
- **URL**: `/users/profile`
- **Method**: `PATCH`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "displayName": "Budi Santoso S.E.",
  "primaryCurrency": "IDR",
  "themePrimaryColor": "#3b82f6"
}
```

---

### 2.3 Ubah Kata Sandi
- **URL**: `/users/change-password`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "currentPassword": "oldPassword123",
  "newPassword": "newSecretPassword456"
}
```

---

## 💳 3. Manajemen Akun / Rekening (Core API)

### 3.1 Daftar Rekening
- **URL**: `/accounts`
- **Query Params**:
  - `includeHidden`: `true` | `false` (default: `false`)
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "accounts": [
    {
      "id": "acc-1",
      "name": "Kas Tunai",
      "group": "Cash",
      "currency": "IDR",
      "initialBalance": 500000,
      "balance": 450000,
      "note": "Dompet fisik",
      "isHidden": false,
      "sortOrder": 0
    },
    {
      "id": "acc-2",
      "name": "BCA Utama",
      "group": "Bank card",
      "currency": "IDR",
      "initialBalance": 5000000,
      "balance": 15000000,
      "note": "Payroll",
      "isHidden": false,
      "sortOrder": 1
    }
  ],
  "totalBalance": 15450000
}
```

---

### 3.2 Tambah Rekening Baru
- **URL**: `/accounts`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "name": "GoPay",
  "group": "E-wallet",
  "currency": "IDR",
  "initialBalance": 200000,
  "note": "Belanja harian & ojol"
}
```

---

### 3.3 Penyesuaian Saldo Rekening
- **URL**: `/accounts/:id/adjust-balance`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "newBalance": 350000,
  "note": "Rekonsiliasi fisik saldo"
}
```

---

## 💸 4. Transaksi Keuangan (Core API)

### 4.1 Daftar Transaksi (Filter & Paginasi)
- **URL**: `/transactions`
- **Method**: `GET`
- **Auth**: `Bearer <token>`
- **Query Parameters**:
  - `ledgerId`: string (ID buku kas)
  - `accountId`: string (Filter per rekening)
  - `categoryId`: string (Filter kategori, atau `"uncategorized"`)
  - `txType`: `"expense"` | `"income"` | `"transfer"`
  - `dateFrom`: ISO Date (contoh: `"2026-03-01"`)
  - `dateTo`: ISO Date (contoh: `"2026-03-31"`)
  - `search`: string (Pencarian catatan/merchant)
  - `limit`: number (default: `50`, max: `500`)
  - `offset`: number (default: `0`)

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "items": [
    {
      "id": "tx-12345",
      "txType": "expense",
      "amount": 45000,
      "currency": "IDR",
      "happenedAt": "2026-03-25T12:30:00.000Z",
      "note": "Makan siang ayam geprek",
      "accountId": "acc-1",
      "toAccountId": null,
      "categoryId": "cat-dining",
      "tagsJson": ["makan", "kantor"],
      "accountName": "Kas Tunai",
      "categoryName": "Dining"
    }
  ],
  "hasMore": false,
  "summary": {
    "totalCount": 1,
    "income": 0,
    "expense": 45000,
    "net": -45000,
    "statsIncome": 0,
    "statsExpense": 45000,
    "statsNet": -45000
  }
}
```

---

### 4.2 Tambah Transaksi Baru
Otomatis memperbarui saldo akun pengirim (dan akun penerima jika transfer).

- **URL**: `/transactions`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body (Expense / Pengeluaran)
```json
{
  "ledgerId": "ledger-main",
  "txType": "expense",
  "amount": 75000,
  "currency": "IDR",
  "happenedAt": "2026-03-26T14:00:00.000Z",
  "note": "Beli kopi & pastry",
  "accountId": "acc-1",
  "categoryId": "cat-beverage",
  "tags": ["ngopi"]
}
```

#### Request Body (Transfer Antar Rekening)
```json
{
  "ledgerId": "ledger-main",
  "txType": "transfer",
  "amount": 500000,
  "accountId": "acc-bca",
  "toAccountId": "acc-gopay",
  "note": "Top up GoPay dari BCA"
}
```

---

### 4.3 Ubah Transaksi
Otomatis mengembalikan efek saldo akun sebelumnya dan menerapkan nominal/rekening baru.

- **URL**: `/transactions/:id`
- **Method**: `PATCH`
- **Auth**: `Bearer <token>`

---

### 4.4 Hapus Transaksi
Otomatis mengembalikan saldo rekening yang terdampak mutasi.

- **URL**: `/transactions/:id`
- **Method**: `DELETE`
- **Auth**: `Bearer <token>`

---

## 🏷️ 5. Kategori, Anggaran, & Buku Kas (Core API)

### 5.1 Daftar Kategori
- **URL**: `/categories`
- **Method**: `GET`
- **Auth**: `Bearer <token>`
- **Query Params**:
  - `kind`: `"expense"` | `"income"` (opsional, filter jenis kategori)

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": [
    {
      "id": "cat-dining",
      "userId": "usr-123",
      "name": "Dining",
      "kind": "expense",
      "icon": "Utensils",
      "parentId": null,
      "sortOrder": 0
    }
  ]
}
```

---

### 5.2 Tambah Kategori Baru
- **URL**: `/categories`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "name": "Investasi Saham",
  "kind": "expense",
  "icon": "TrendingUp",
  "parentId": null
}
```

---

### 5.3 Hapus Kategori
- **URL**: `/categories/:id`
- **Method**: `DELETE`
- **Auth**: `Bearer <token>`

---

### 5.4 Monitoring Anggaran Bulanan
- **URL**: `/budgets`
- **Method**: `GET`
- **Auth**: `Bearer <token>`
- **Query Params**:
  - `ledgerId`: string (**Wajib**, ID buku kas)
  - `month`: string (Format `YYYY-MM`, default bulan berjalan)

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "items": [
    {
      "id": "b-1",
      "categoryId": "cat-dining",
      "categoryName": "Dining",
      "categoryIcon": "Utensils",
      "budgetAmount": 2000000,
      "actualSpent": 1250000,
      "remaining": 750000,
      "percent": 63
    }
  ],
  "totalBudget": 2000000,
  "totalSpent": 1250000,
  "totalRemaining": 750000
}
```

---

### 5.5 Atur / Ubah Batas Anggaran Kategori
Menetapkan atau memperbarui nominal alokasi pagu anggaran suatu kategori untuk bulan tertentu.

- **URL**: `/budgets`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "ledgerId": "ledger-main",
  "categoryId": "cat-dining",
  "month": "2026-04",
  "amount": 2500000
}
```

---

### 5.6 Manajemen Buku Kas (Ledgers)

#### Ambil Semua Buku Kas
- **URL**: `/ledgers`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Buat Buku Kas Baru
- **URL**: `/ledgers`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

```json
{
  "name": "Buku Kas Bisnis",
  "currency": "IDR",
  "monthStartDay": 1
}
```

#### Buat Kode Undangan Kolaborasi (Invite)
- **URL**: `/ledgers/invite`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

```json
{
  "ledgerId": "ledger-main",
  "role": "editor"
}
```

#### Bergabung ke Buku Kas via Kode Undangan (Join)
- **URL**: `/ledgers/join`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

```json
{
  "code": "X7K9LP"
}
```

---

### 5.7 Batch Import Transaksi (CSV / JSON)
Mengimpor banyak transaksi sekaligus dengan deduplikasi otomatis, pencocokan nama rekening dan kategori otomatis.

- **URL**: `/import/batch`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "targetLedgerId": "ledger-main",
  "dedupStrategy": "skip_duplicates",
  "autoTag": "import-csv",
  "items": [
    {
      "txType": "expense",
      "amount": 45000,
      "happenedAt": "2026-03-25T12:00:00.000Z",
      "categoryName": "Dining",
      "accountName": "BCA Utama",
      "note": "Lunch meeting"
    }
  ]
}
```

---

## 📊 6. Analitik Keuangan (Core API)

| Endpoint | Method | Keterangan |
| :--- | :--- | :--- |
| `/analytics/hero-summary?scope=this_month` | `GET` | Ringkasan saldo, rata-rata belanja harian, jumlah transaksi per hari, dan kurva saldo sparkline |
| `/analytics/asset-composition` | `GET` | Proporsi persentase saldo antar rekening |
| `/analytics/category-ranks?kind=expense` | `GET` | Urutan kategori pengeluaran terbanyak beserta total dan persentase |
| `/analytics/year-heatmap?year=2026` | `GET` | Matriks arus kas bulanan selama 12 bulan |
| `/analytics/top-stats` | `GET` | Top 5 akun teraktif dan daftar tag paling sering digunakan |

---

## 🤖 7. Layanan AI & Financial Advisor (AI Service)

### 7.1 Konsultasi AI Financial Advisor (Chat)
Mengirim pertanyaan keuangan pribadi ke AI dengan konteks telemetri keuangan user riil, proteksi guardrail finansial, dan kuota harian.

- **URL**: `/ai/chat`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "question": "Bagaimana evaluasi arus kas saya bulan ini dan apa pos yang perlu dihemat?",
  "sessionId": "optional-uuid-sesi",
  "model": "google/gemma-4-26b-a4b-it:free",
  "lang": "id"
}
```

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": {
    "answer": "Berdasarkan data keuangan Anda:\n1. Total pengeluaran Anda bulan ini mencapai Rp 3.250.000...\n2. Pos pengeluaran terbesar adalah 'Dining' (42%). Rekomendasi...",
    "modelUsed": "google/gemma-4-26b-a4b-it:free",
    "quota": {
      "limit": 20,
      "used": 4,
      "remaining": 16,
      "allowed": true,
      "resetHours": 18
    },
    "guardrailBlocked": false,
    "sessionId": "d4e5f6a7-..."
  }
}
```

#### Respon Jika Pertanyaan Non-Finansial (Guardrail Blocked)
```json
{
  "success": true,
  "data": {
    "answer": "Maaf, sebagai Fin.IQ AI Financial Advisor saya hanya melayani analisis dan konsultasi terkait pengelolaan keuangan pribadi, arus kas, transaksi, dan anggaran Anda.",
    "guardrailBlocked": true,
    "modelUsed": "guardrail-prefilter"
  }
}
```

---

### 7.2 Manajemen Sesi Percakapan AI

#### Ambil Daftar Sesi Chat
- **URL**: `/ai/chat/sessions`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Buat Sesi Chat Baru
- **URL**: `/ai/chat/sessions`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

```json
{
  "title": "Analisis Pengeluaran Maret",
  "model": "google/gemma-4-26b-a4b-it:free"
}
```

#### Ambil Riwayat Pesan dalam Suatu Sesi
- **URL**: `/ai/chat/sessions/:id`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Hapus Sesi Chat
- **URL**: `/ai/chat/sessions/:id`
- **Method**: `DELETE`
- **Auth**: `Bearer <token>`

---

### 7.3 Riwayat Pertanyaan & Jawaban AI (Audit Log)
- **URL**: `/ai/chat/history?limit=30`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

---

### 7.4 Cek Sisa Kuota Harian Prompt
- **URL**: `/ai/quota`
- **Method**: `GET`
- **Auth**: `Bearer <token>`

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": {
    "limit": 20,
    "used": 5,
    "remaining": 15,
    "allowed": true,
    "resetHours": 12
  }
}
```

---

### 7.5 Daftar Model AI Tersedia
Menampilkan model OpenRouter gratis yang aktif dan model default fallback.

- **URL**: `/ai/models`
- **Method**: `GET`
- **Auth**: Tidak perlu

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": {
    "defaultModel": "google/gemma-4-26b-a4b-it:free",
    "models": [
      {
        "id": "google/gemma-4-26b-a4b-it:free",
        "name": "Google Gemma 4 26B (Free)",
        "provider": "Google",
        "contextLength": 131072
      },
      {
        "id": "meta-llama/llama-3.3-70b-instruct:free",
        "name": "Llama 3.3 70B Instruct (Free)",
        "provider": "Meta",
        "contextLength": 131072
      }
    ]
  }
}
```

---

### 7.6 Smart Parsing Kalimat ke Transaksi (NLP)
Mengubah input bahasa alami pengguna menjadi objek transaksi terstruktur secara otomatis.

- **URL**: `/ai/analyze/text`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "text": "beli bensin pertamax 50rb pake bca tadi sore",
  "clientTime": "2026-03-26T17:00:00.000Z"
}
```

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": {
    "txType": "expense",
    "amount": 50000,
    "happenedAt": "2026-03-26T17:00:00",
    "categoryName": "Transportasi",
    "accountName": "BCA Utama",
    "toAccountName": null,
    "note": "Bensin pertamax"
  }
}
```

---

### 7.7 OCR Struk Belanja & Mutasi Gambar (Gemini Vision)
Mengekstrak data transaksi, nama toko/merchant, daftar produk, dan total nominal dari foto struk belanja kasir atau screenshot m-banking.

- **URL**: `/ai/analyze/vision`
- **Method**: `POST`
- **Auth**: `Bearer <token>`

#### Request Body
```json
{
  "imageBase64": "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...",
  "mimeType": "image/jpeg"
}
```

#### Respon Sukses (`200 OK`)
```json
{
  "success": true,
  "data": {
    "documentType": "receipt",
    "txType": "expense",
    "amount": 84500,
    "merchantName": "Alfamart Kemang",
    "happenedAt": "2026-03-26T10:15:00",
    "suggestedCategory": "Daily Goods",
    "paymentMethod": "BCA QRIS",
    "note": "Belanja Alfamart Kemang",
    "items": [
      { "name": "Susu UHT 1L", "qty": 1, "price": 22500 },
      { "name": "Roti Gandum", "qty": 1, "price": 18000 },
      { "name": "Minyak Goreng 2L", "qty": 1, "price": 44000 }
    ]
  }
}
```

---

## 🛠️ 8. Kode Error Standar

| HTTP Status | Error Code | Arti & Solusi |
| :--- | :--- | :--- |
| `400` | `ValidationError` | Parameter request tidak memenuhi schema Zod. Periksa field `issues`. |
| `401` | `Unauthorized` | Header `Authorization: Bearer <token>` tidak disertakan atau token salah. |
| `401` | `SessionExpired` | Sesi telah dihapus dari Redis karena pengguna telah logout. Login kembali. |
| `403` | `Forbidden` | Akun dinonaktifkan atau tidak memiliki izin akses. |
| `404` | `NotFound` | Data id transaksi, rekening, atau sesi chat tidak ditemukan. |
| `429` | `TooManyRequests` | Rate limit terlampaui. Periksa header `Retry-After`. |
| `500` | `InternalServerError` | Terjadi galat pada server internal atau penyedia upstream. |
