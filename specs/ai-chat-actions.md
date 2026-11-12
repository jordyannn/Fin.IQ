# Spec: AI Chat Action Engine & Interactive Confirmation Cards (Loop 1)

## Objective

Meng-upgrade Fin.IQ AI Advisor (`/ai` dan Drawer *Bang Peci*) agar dapat mengekstrak draf **Transaksi**, **Pagu Anggaran Bulanan (`budgets`)**, dan **Target Keuangan / Batas Pengeluaran (`milestones`)** langsung dari konteks percakapan teks (termasuk multi-aksi dan tindak lanjut saran AI sebelumnya), menampilkannya sebagai **Kartu Konfirmasi Interaktif dengan *quick-edit***, serta mengeksekusi penyimpanan ke database secara atomik tanpa migrasi DDL.

---

## Exact Requirements

- **REQ-1.1 — Shared Draft Contract & Content Persistence** (`src/lib/ai-chat-actions.ts`):
  - Menyediakan tipe `ChatActionDraft` untuk 3 jenis aksi: `transaction` (`expense | income | transfer`), `budget` (`categoryId`, `ledgerId`, `month`, `amount`), dan `milestone` (`title`, `targetAmount`, `trackingType`, `trackingId`, `trackingDirection`, `deadline`) dengan status `"pending" | "saved" | "dismissed"` dan `savedRecordId?`.
  - Menyediakan `serializeDraftsMarker(drafts)`, `extractDraftsFromContent(rawContent)` (mengembalikan `{ cleanText, drafts }`), dan `stripActionTags(text)` untuk menghapus tag `[FINIQ_ACTIONS]...[/FINIQ_ACTIONS]` maupun komentar marker `<!--FINIQ_DRAFTS:...-->`.
  - [AIMessageRenderer.tsx](file:///c:/Project%20Coding/Fin.IQ/src/components/ai/AIMessageRenderer.tsx) wajib men-strip marker/tag mentah tersebut sebelum me-render Markdown.

- **REQ-1.2 — AI Prompt Context & Entity Grounding** ([ai-telemetry.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/ai-telemetry.ts)):
  - Memasukkan daftar nama akun riil, daftar kategori (`income` & `expense`), daftar buku kas (`ledgers`), serta ringkasan anggaran & milestone aktif ke dalam prompt telemetri (tanpa memaksa LLM menghasilkan UUID 36-karakter).
  - Menginstruksikan LLM mengeluarkan 1 blok `[FINIQ_ACTIONS]{"actions":[...]}[/FINIQ_ACTIONS]` hanya ketika user meminta/mengonfirmasi pencatatan transaksi, pembuatan target, atau penerapan anggaran dari saran sebelumnya.

- **REQ-1.3 — Server Extraction & Deterministic Offline Fallback** ([ai.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/ai.ts)):
  - `askFinancialAssistant` mem-parse `[FINIQ_ACTIONS]` secara defensif, melakukan resolusi nama akun/kategori/buku kas ke ID database riil milik `ctx.userId` menggunakan `fuzzyMatchAccount` & `fuzzyMatchCategory` (dari [import.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/import.ts)), mendukung multi-item per pesan, dan menyediakan ekstraktor NLP fallback (`parseMultipleItemsAndAmounts` + deteksi kata kunci target/budget) jika Cloud AI timeout atau terkena 429.
  - Menyimpan pesan asisten beserta marker `<!--FINIQ_DRAFTS:...-->` ke `ai_chat_messages` dan mengembalikan `{ answer, actionDrafts, assistantMessageId, ... }` ke client.
  - `getChatSession` ikut mem-parse marker dari setiap pesan asisten sehingga kartu konfirmasi & statusnya terpulihkan saat sesi dibuka ulang atau halaman di-refresh.

- **REQ-1.4 — Shared Verified Financial Execution Helper** (`src/server/financial-actions.ts`):
  - Mengekstrak fungsi server bersama yang memverifikasi kepemilikan `ctx.userId`:
    - `createVerifiedTransaction(dbOrTx, userId, payload)`: insert transaksi + update saldo akun (`expense`, `income`, `transfer`).
    - `upsertVerifiedBudget(dbOrTx, userId, payload)`: upsert pagu anggaran kategori pada `(userId, ledgerId, categoryId, month)`.
    - `createVerifiedMilestone(dbOrTx, userId, payload)`: insert target milestone (`savings_goal` / `spending_limit`).
  - Memastikan [transactions.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/transactions.ts), [budgets.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/budgets.ts), dan [milestones.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/milestones.ts) tetap konsisten (atau memanggil helper bersama ini).

- **REQ-1.5 — Atomic Execution & Dismiss Endpoints** ([ai.ts](file:///c:/Project%20Coding/Fin.IQ/src/server/trpc/router/ai.ts)):
  - Menambahkan `ai.executeChatActionDraft`, `ai.executeChatActionBatch`, dan `ai.dismissChatActionDraft` pada `aiRouter`.
  - Mengecek kepemilikan `messageId`/`sessionId`, menjalankan mutasi dalam transaksi DB atomik, memverifikasi `draft.status === "pending"` agar idempotent (mencegah simpan ganda saat double-click), dan memperbarui status draf (`saved` + `savedRecordId` atau `dismissed`) di `aiChatMessages.content`.

- **REQ-1.6 — Interactive Confirmation Cards UI** (`src/components/ai/ChatActionCards.tsx`, [ai/page.tsx](file:///c:/Project%20Coding/Fin.IQ/src/app/%28app%29/ai/page.tsx), [AIAdvisorDrawer.tsx](file:///c:/Project%20Coding/Fin.IQ/src/components/ai/AIAdvisorDrawer.tsx)):
  - Merender kartu konfirmasi interaktif di bawah bubble pesan asisten pada `/ai` maupun Drawer *Bang Peci*, menampilkan badge tipe (`Transaksi` / `Anggaran Bulanan` / `Target Keuangan`), ringkasan nominal/akun/kategori/deadline, mode *quick-edit* inline (ubah nominal, tipe, akun asal/tujuan, kategori sesuai tipe, buku kas, tanggal/deadline, judul/catatan), tombol **Simpan**, **Abaikan**, dan **Simpan Semua (N)** bila terdapat `> 1` kartu pending.
  - Setelah berhasil menyimpan, me-invalidate cache tRPC `transactions`, `accounts`, `analytics`, `budgets`, dan `milestones`, serta mengubah badge kartu menjadi **Tersimpan**.

---

## Edge Cases to Handle

1. **JSON Rusak / Terpotong dari LLM**: Jika blok `[FINIQ_ACTIONS]` tidak valid JSON atau kosong, hapus blok tersebut dari teks Markdown dan lanjutkan merespon normal dengan `actionDrafts: []`.
2. **Transfer Tidak Valid**: Jika `txType === "transfer"` memiliki `accountId === toAccountId` atau `toAccountId` kosong, server menolak eksekusi (`BAD_REQUEST`) dan UI menonaktifkan tombol Simpan dengan pesan peringatan agar user memilih akun tujuan berbeda.
3. **Nominal Invalid (`<= 0`, `NaN`, atau non-finite)**: Parser mengabaikan item dengan nominal tidak valid; endpoint eksekusi memvalidasi ulang `z.number().positive().finite()`.
4. **Double-Click / Concurrent Save**: Jika status draft pada `aiChatMessages` sudah `"saved"`, kembalikan hasil idempotent tanpa menambah baris transaksi/target baru atau memotong saldo lagi.
5. **User Tanpa Akun / Kategori**: Jika user belum memiliki akun saat transaksi diekstrak, kartu menandai akun wajib dipilih dan menonaktifkan **Simpan** hingga akun tersedia/dipilih.
6. **Pertanyaan Analisis Murni**: Pertanyaan informasional (*"Bagaimana pengeluaran saya bulan ini?"*) tidak boleh menghasilkan kartu aksi palsu (`actionDrafts: []`).

---

## Concrete Definition of Done (DoD)

1. Seluruh `REQ-1.1` s/d `REQ-1.6` terpenuhi sesuai Phase 3 Review tanpa gap.
2. Unit test baru `tests/unit/ai-chat-actions.test.ts` menguji parsing marker, handling JSON rusak, fallback extraction, dan verifikasi eksekusi atomik / anti-double-save.
3. Seluruh perintah verifikasi otomatis keluar dengan exit code `0`.

---

## Iteration Budget, Verification Commands & Approval Gates

- **Iteration Budget**: Maksimal **3 siklus Build → Review** untuk Loop 1.
- **Verification Commands**:
  - `npm test`
  - `npx tsc --noEmit`
  - `npx tsc -p packages/ai-service/tsconfig.json --noEmit`
  - `npx tsc -p packages/core-api/tsconfig.json --noEmit`
- **Approval Gates**:
  - Membutuhkan persetujuan user sebelum memulai Phase 2 (Build).
  - Tidak ada perubahan DDL/migrasi database.
  - Tidak ada `git push` atau deployment produksi tanpa konfirmasi user.

