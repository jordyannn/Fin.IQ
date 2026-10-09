# Fin.IQ — Dataset NLP Sintetis Bahasa Indonesia (pencatatan transaksi)

Dataset sintetis untuk melatih model yang membaca kalimat bebas pengguna lalu menentukan
**intent**, **kategori + subkategori**, **jenis (expense/income)**, dan **nominal**.
Seluruh label mengikuti taksonomi di `seed-beecount-categories` (12 kategori induk, 79 subkategori;
sudah dicek sama persis dengan nama di seed).

## Isi

| File | Jumlah | Keterangan |
|---|---|---|
| `transactions_train/val/test.jsonl` | 44.240 / 5.530 / 5.530 | Transaksi tunggal, split 80/10/10 stratifikasi per subkategori |
| `transactions_all.jsonl` / `.csv` | 55.300 | Gabungan (CSV utf-8-sig, bisa dibuka di Excel) |
| `multi_transactions.jsonl` | 5.000 | Satu kalimat berisi 2-4 transaksi, label berupa daftar |
| `intents_non_transaction.jsonl` | 4.950 | 11 intent bukan-pencatatan (450 per intent) |
| `intent_all.jsonl` | 65.250 | Semua kalimat + label intent saja (untuk intent classifier) |
| `taxonomy.json` | 12 induk / 79 sub | Taksonomi yang dipakai |

Tepat 700 kalimat unik per subkategori. Tidak ada duplikat teks di seluruh dataset.

## Skema

Transaksi tunggal:
```json
{"id":"tx-000123","text":"tadi pagi beli es kopi susu di Kopi Kenangan 18rb","lang":"id",
 "intent":"catat_pengeluaran","kind":"expense","category":"Makanan & Minuman",
 "subcategory":"Kopi & Minuman","amount":18000,"noisy":false,"split":"train"}
```
Multi-transaksi: `transactions` = daftar `{kind, category, subcategory, amount}`.

Intent: `catat_pengeluaran`, `catat_pemasukan`, `catat_transaksi_multi`, `cek_saldo`,
`riwayat_transaksi`, `ringkasan_pengeluaran`, `atur_budget`, `edit_transaksi`, `hapus_transaksi`,
`transfer_antar_akun`, `pengingat_tagihan`, `bantuan`, `sapaan`, `di_luar_topik`.

## Variasi yang dicakup

- Format nominal: `25rb`, `25k`, `25 ribu`, `Rp25.000`, `Rp 25.000`, `25000`, `1,5jt`, `1,5 juta`,
  `sejuta`, terbilang ("dua puluh lima ribu"), dan slang (`goceng`, `ceban`, `goban`, `cepek`, `seceng`, `gopek`).
- Gaya bahasa: formal, santai (gue/aku/saya), imperatif ("catat dong ..."), nama bot ("Fin, ..."),
  waktu ("tadi pagi", "kemarin", "tgl 5", "pas gajian").
- Noise (~28% bertanda `noisy:true`): singkatan (yg, utk, udh, byr, tf), huruf kecil semua, typo, sufiks ("wkwk", "makasih").
- Merchant/brand Indonesia (Indomaret, Gojek, Shopee, KRL, PLN, BCA, dst) dan istilah lokal (zakat, THR, arisan, angpao, kos).

## Cara membuat lebih banyak

```bash
python3 generate.py 2000 20000 1000   # 2000/subkategori, 20000 multi, 1000/intent
```
Seed acak tetap (42) agar hasil bisa direproduksi. Tambah item/merchant di `taxonomy_data.py`
untuk memperkaya kosakata (jumlah kombinasi unik ikut naik).

## Keterbatasan (penting)

1. **Sintetis, bukan data pengguna asli.** Gunakan untuk pretraining/bootstrapping; wajib evaluasi dan
   fine-tune dengan data nyata (log aplikasi, hasil koreksi pengguna) sebelum produksi.
2. **Nominal hanya dikaitkan longgar dengan item.** Setiap item punya tingkat harga tetap, tapi tidak semuanya
   realistis (mis. "jersey bola" bisa jutaan). Gunakan `amount` sebagai target ekstraksi slot, bukan sebagai
   fitur klasifikasi kategori.
3. **Batas antar-kategori memang ambigu** di taksonomi sumber, misalnya: Listrik & Elektronik vs Tagihan Listrik & Air,
   Mall & Pusat Belanja vs Pakaian & Busana, Supermarket vs Toko Kelontong, Pulsa & Paket Data ada di
   Pendidikan & Karir. Label di sini mengikuti item yang dipilih generator; sebagian kalimat akan ambigu bagi manusia.
4. **Satu bahasa saja (Indonesia).** Tidak ada data Jawa/Sunda/Inggris campur kecuali istilah serapan.
5. Kategori Pengeluaran Lainnya dan Pendapatan Lain-lain berisi kalimat "tong sampah" yang wajar tumpang-tindih
   dengan kategori lain.
