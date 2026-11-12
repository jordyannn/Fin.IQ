# Spec: Unified Budgets & Milestones Workflow (Loop 2)

## Objective

Menggabungkan alur kerja fitur **Anggaran Bulanan (`budgets`)** dan **Target Keuangan (`milestones`)** menjadi satu pengalaman terpadu di halaman `/budgets` (**Anggaran & Target Keuangan**) dengan tombol tambah terpadu 3-mode dan paritas CRUD penuh, tanpa mengubah skema DDL MySQL produksi maupun memutus komponen ringkasan pada `/overview`.

---

## Exact Requirements

- **REQ-2.1 — Budget Delete & Consistent Update Parity** ([budgets.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/budgets.ts)):
  - Menambahkan mutasi `budgets.delete` terautentikasi yang memverifikasi kepemilikan `ctx.userId` sebelum menghapus item anggaran bulanan.
  - Memastikan `budgets.set` memakai helper bersama [`upsertVerifiedBudget`](file:///c:/Project%20Coding/Fin.IQ/src/server/financial-actions.ts) dari Loop 1 agar perilaku server konsisten antara `/budgets` dan AI Chat.

- **REQ-2.2 — Embedded Mode & Unified Action Compatibility** ([MilestoneTrackingCard.tsx](file:///c:/Project%20Coding/Fin.IQ/src/components/milestones/MilestoneTrackingCard.tsx)):
  - Menambahkan dukungan prop opsional pada `MilestoneTrackingCard` (mis. `hideHeaderAction?: boolean` atau `onRequestCreateTarget?: () => void`) agar halaman `/overview` tetap berfungsi seperti semula sementara halaman `/budgets` dapat merendernya tanpa header/tombol duplikat.
  - Memastikan batas `startDate` milestone kategori memperhitungkan zona waktu WIB (UTC+7) secara konsisten saat mengevaluasi mutasi awal hari.

- **REQ-2.3 — Unified `/budgets` Page ("Anggaran & Target")** ([budgets/page.tsx](file:///c:/Project%20Coding/Fin.IQ/src/app/%28app%29/budgets/page.tsx)):
  - Menyajikan 1 pemilih Buku Kas (`ledgers`) dan periode bulan (`YYYY-MM`) yang sinkron untuk daftar Pagu Anggaran Bulanan.
  - Menyajikan KPI ringkasan terpadu: Total Plafon Bulanan, Realisasi Belanja, Sisa Alokasi Kas, dan ringkasan Target Keuangan Aktif / Tercapai.
  - Menampilkan daftar **Target & Milestone Keuangan** (tabungan `savings_goal` & batas pengeluaran `spending_limit`) dan **Batas Anggaran Kategori Bulanan** (dilengkapi tombol hapus `budgets.delete` dengan konfirmasi) dalam satu halaman terpadu.

- **REQ-2.4 — Unified 3-Mode Creation Modal (`+ Tambah Anggaran / Target`)** ([budgets/page.tsx](file:///c:/Project%20Coding/Fin.IQ/src/app/%28app%29/budgets/page.tsx)):
  - Membuka 1 dialog tunggal dengan pemilih mode:
    1. **Pagu Anggaran Bulanan** -> menyimpan ke `budgets.set` untuk buku kas, kategori pengeluaran, dan bulan terpilih.
    2. **Batas Pengeluaran Berbatas Waktu** -> menyimpan ke `milestones.create` (`trackingDirection: "spending_limit"`).
    3. **Target Tabungan (`Savings Goal`)** -> menyimpan ke `milestones.create` (`trackingDirection: "savings_goal"`).
  - Meng-invalidate query `budgets` dan `milestones` saat submit berhasil agar `/budgets`, `/overview`, dan AI telemetry langsung tersinkronisasi.

---

## Edge Cases to Handle

1. **User Multi-Buku Kas / Tanpa Buku Kas**: Jika user punya >1 buku kas, pemilih buku kas memfilter `budgets.list`; jika baru 0 buku kas, `budgets.set` tetap aman memakai ledger default atau menampilkan empty state yang jelas.
2. **Hapus Pagu Anggaran Terakhir**: Menghapus satu-satunya pagu bulanan harus mereset KPI `Total Plafon` ke `0` dan menampilkan empty state yang rapi tanpa error UI.
3. **Nominal Target / Plafon Invalid**: Form menolak nilai `<= 0` atau tanggal deadline tidak valid sebelum memanggil mutasi tRPC.
4. **Kompatibilitas `/overview`**: Memanggil `<MilestoneTrackingCard />` tanpa prop baru di `/overview` wajib mempertahankan perilaku & tampilan existing 100%.

---

## Concrete Definition of Done (DoD)

1. Seluruh `REQ-2.1` s/d `REQ-2.4` berstatus `PASS` saat Phase 3 Review terhadap spec ini.
2. Pengujian CRUD pagu anggaran + milestone berjalan tanpa regresi pada `/overview`.
3. `npm test` dan seluruh `tsc --noEmit` check lulus dengan exit code `0`.

---

## Iteration Budget, Verification Commands & Approval Gates

- **Iteration Budget**: Maksimal **2 siklus Build → Review** untuk Loop 2.
- **Verification Commands**:
  - `npm test`
  - `npx tsc --noEmit`
  - `npx tsc -p packages/ai-service/tsconfig.json --noEmit`
  - `npx tsc -p packages/core-api/tsconfig.json --noEmit`
- **Approval Gates**:
  - Dikerjakan setelah Loop 1 (`specs/ai-chat-actions.md`) lolos Review atau berurutan dalam persetujuan rencana ini.
  - Tidak ada perubahan skema DDL DB produksi dan tidak ada `git push` otomatis tanpa konfirmasi user.

