# Panduan Desain Fin.IQ (Fintech Mobile-First Style)

Dokumen ini menjadi acuan visual Fin.IQ yang terinspirasi dari antarmuka aplikasi fintech modern Indonesia (**Bibit**). Fokus utama desain adalah kesederhanaan, keterbacaan data finansial yang tinggi, tata letak ramah layar ponsel (*mobile-first*), dan bahasa yang ringkas tanpa istilah kaku.

---

## 1. Filosofi & Karakter Visual

| Aspek | Panduan | Referensi Inspirasi |
| :--- | :--- | :--- |
| **Karakter** | Bersih, tepercaya, ramah pengguna, modern | Aplikasi Bibit (Investasi & Tabungan) |
| **Warna Utama** | Hijau Zamrud (*Emerald Green*) segar | Simbol pertumbuhan aset & stabilitas keuangan |
| **Bentuk (*Shapes*)** | Sudut membulat lembut (*rounded-2xl* sampai *rounded-full*) | Kartu portofolio, tombol pil, dan chip alokasi |
| **Hierarki Informasi** | Angka saldo tegas dan besar, label pendukung tenang | Kartu ringkasan saldo portofolio |
| **Interaksi Ponsel** | Bilah navigasi bawah (*Bottom Nav*), tombol tambah melayang | Mudah dijangkau satu jempol tangan |

---

## 2. Palet Warna (*Color Palette*)

### Mode Terang (*Light Mode*)
- **Primary / Brand**: `#00B569` (HSL: `156 100% 35%`) — Hijau khas fintech, segar dan kontras.
- **Primary Foreground**: `#FFFFFF` — Putih bersih untuk teks di atas tombol hijau.
- **Background Utama**: `#F9FBFA` atau `#FFFFFF` — Latar belakang lapang yang tidak melelahkan mata.
- **Card Surface**: `#FFFFFF` dengan garis tepi halus (`#E5E7EB` / `border-border/60`).
- **Surface Accent (Mint)**: `#ECFDF5` (`emerald-50`) — Latar lencana (*badge*) dan chip status positif.
- **Teks Utama**: `#0F172A` (`slate-900`) — Kontras tinggi dan tajam.
- **Teks Sekunder**: `#64748B` (`slate-500`) — Keterangan tanggal, jenis akun, dan catatan.
- **Pemasukan**: `#00B569` / `#10B981` (Hijau zamrud)
- **Pengeluaran**: `#EF4444` (Merah koral)
- **Transfer**: `#3B82F6` (Biru laut)

### Mode Gelap (*Dark Mode*)
- **Primary**: `#10B981` (HSL: `155 85% 45%`) — Hijau zamrud bercahaya lembut.
- **Background**: `#090D10` / `#0B1117` — Hitam arang elegan.
- **Card Surface**: `#131B22` dengan batas halus `#1E293B`.
- **Teks Utama**: `#F8FAFC`.
- **Teks Sekunder**: `#94A3B8`.

---

## 3. Tipografi & Hierarki Angka

- **Font Keluarga**: Sans-serif sistem berkecepatan tinggi (`Inter`, `system-ui`).
- **Nominal Utama (Saldo Bersih)**: `text-2xl sm:text-3xl font-extrabold tracking-tight`. Menggunakan pemformatan Rupiah rapi (contoh: `Rp 3.673.400`).
- **Judul Bagian (*Section Title*)**: `text-base font-bold text-foreground`.
- **Label Pendukung**: `text-xs font-medium text-muted-foreground`.
- **Chip & Lencana**: `text-[11px] font-semibold tracking-wide px-2 py-0.5 rounded-full`.

---

## 4. Pola Komponen Utama (*Component Patterns*)

### A. Kartu Ringkasan Portofolio (*Portfolio Hero Card*)
Terinspirasi dari kartu utama Bibit:
- Menampilkan total saldo bersih dengan opsi sakelar periode (*Bulan Ini*, *Tahun Ini*, *Semua*).
- Menampilkan baris aksi cepat berbentuk pil tombol:
  - **Catat Transaksi** (Aksen hijau utama)
  - **Impor CSV / Excel** (Aksen netral)
  - **Pindah Saldo** (Aksen sekunder)
- Indikator selisih arus kas (*Net Cash Flow*) dengan badge persentase hijau/merah.

### B. Kartu Alokasi & Rekening (*Asset Allocation Breakdown*)
Mirip tampilan alokasi reksa dana (Pasar Uang, Obligasi, Saham):
- Mengelompokkan akun ke kategori: **Kas Tunai**, **Bank Digital**, **E-Wallet**, dan **Investasi**.
- Setiap baris memiliki:
  - Ikon bulat dengan warna latar lembut.
  - Nama akun / kategori dan persentase porsi terhadap total aset.
  - Garis kemajuan (*progress bar*) hijau zamrud tipis.
  - Nilai nominal saldo dan tombol panah arah (`ChevronRight`).

### C. Bilah Navigasi Bawah Ponsel (*Mobile Bottom Nav*)
- Ditempatkan tetap di bagian bawah layar ponsel (`fixed bottom-0 z-40`).
- Terdiri atas 5 elemen:
  1. **Home / Ringkasan**
  2. **Transaksi**
  3. **Tombol Melayang Tambah Transaksi** (ikon `+` bulat di tengah)
  4. **Akun Finansial**
  5. **Menu Lengkap** (Membuka laci menu untuk fitur Impor, Anggaran, Kalender, dsb.)
- Memiliki ruang aman bawah (*safe area padding* `pb-24`) di halaman utama agar konten tidak tertutup bilah navigasi.

### D. Daftar Transaksi Terorganisir (*Transaction Feed*)
- Pengelompokan harian (*Day headers*) yang rapi.
- Baris transaksi dengan tap target nyaman (minimal tinggi 54px).
- Ikon kategori di sebelah kiri dengan lingkaran latar warna kategori.
- Nominal pengeluaran bertanda minus (`-Rp 25.000`) berwarna gelap/merah, nominal pemasukan bertanda plus (`+Rp 5.000.000`) berwarna hijau zamrud.

---

## 5. Kaidah Penulisan Teks (*Copywriting Standard*)

Sesuai standar `/anti-slop`:
- Hindari bahasa kaku birokratis (hindari: *"yang mana merupakan"*, *"sebagai bukti nyata"*).
- Hindari hiperbola AI klise (hindari: *"solusi revolusioner terbaik untuk masa depan finansial Anda"*).
- Gunakan bahasa Indonesia sehari-hari yang lugas, sopan, dan jelas:
  - `Tambah Transaksi` (bukan *Inisiasi Pencatatan*)
  - `Saldo Tersedia` (bukan *Likuiditas Finansial Terakumulasi*)
  - `Impor CSV atau Excel` (bukan *Integrasikan Data Spreadsheet Anda Secara Mulus*)
  - `Kategori Transaksi` (bukan *Taksonomi Pengeluaran*)
