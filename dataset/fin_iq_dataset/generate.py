# -*- coding: utf-8 -*-
"""Generator dataset sintetis Fin.IQ (Bahasa Indonesia)."""
import csv
import json
import math
import os
import random
import re
import sys
import zlib

from taxonomy_data import ROWS

N_PER_SUB = int(sys.argv[1]) if len(sys.argv) > 1 else 700
N_MULTI = int(sys.argv[2]) if len(sys.argv) > 2 else 5000
N_PER_INTENT = int(sys.argv[3]) if len(sys.argv) > 3 else 450
OUT = "fin_iq_dataset"
random.seed(42)
os.makedirs(OUT, exist_ok=True)

# ------------------------------------------------------------------ nominal
SATUAN = ["", "satu", "dua", "tiga", "empat", "lima", "enam", "tujuh",
          "delapan", "sembilan", "sepuluh", "sebelas"]


def terbilang(n):
    if n < 12:
        return SATUAN[n]
    if n < 20:
        return terbilang(n - 10) + " belas"
    if n < 100:
        return terbilang(n // 10) + " puluh" + (" " + terbilang(n % 10) if n % 10 else "")
    if n < 200:
        return "seratus" + (" " + terbilang(n - 100) if n > 100 else "")
    if n < 1000:
        return terbilang(n // 100) + " ratus" + (" " + terbilang(n % 100) if n % 100 else "")
    if n < 2000:
        return "seribu" + (" " + terbilang(n - 1000) if n > 1000 else "")
    if n < 1_000_000:
        return terbilang(n // 1000) + " ribu" + (" " + terbilang(n % 1000) if n % 1000 else "")
    if n < 1_000_000_000:
        return terbilang(n // 1_000_000) + " juta" + (" " + terbilang(n % 1_000_000) if n % 1_000_000 else "")
    return terbilang(n // 1_000_000_000) + " miliar" + (" " + terbilang(n % 1_000_000_000) if n % 1_000_000_000 else "")


def dot(n):
    return f"{n:,}".replace(",", ".")


SLANG = {500: "gopek", 1000: "seceng", 5000: "goceng", 10000: "ceban",
         50000: "goban", 100000: "cepek"}


def nice(lo, hi, v=None):
    if v is None:
        v = math.exp(random.uniform(math.log(lo), math.log(hi)))
    if v < 10_000:
        step = 500
    elif v < 50_000:
        step = 1000
    elif v < 200_000:
        step = 5000
    elif v < 1_000_000:
        step = 10_000
    elif v < 5_000_000:
        step = 50_000
    elif v < 20_000_000:
        step = 100_000
    else:
        step = 500_000
    if random.random() < 0.12:  # nominal "tidak bulat"
        step = max(500, step // 2)
    n = int(round(v / step) * step)
    return max(lo if lo >= 500 else 500, min(hi, max(n, step)))


def fmt_amount(n):
    """Kembalikan teks nominal acak."""
    if n in SLANG and random.random() < 0.12:
        return SLANG[n]
    forms = []
    if n >= 1_000_000:
        m = n / 1_000_000
        if n % 1_000_000 == 0:
            ms = str(int(m))
            forms += [f"{ms}jt"] * 5 + [f"{ms} juta"] * 5 + [f"{ms}jt".upper()] + \
                     [f"Rp{dot(n)}"] * 3 + [f"Rp {dot(n)}"] * 2 + [dot(n)] * 2 + [str(n)] * 2 + \
                     [f"{ms} juta rupiah", terbilang(n) + " rupiah", f"{n // 1000}rb"]
            if m == 1:
                forms += ["sejuta"] * 2
        else:
            dec = f"{m:.3f}".rstrip("0").rstrip(".").replace(".", ",")
            forms += [f"{dec}jt"] * 5 + [f"{dec} juta"] * 4 + [f"Rp{dot(n)}"] * 3 + \
                     [f"Rp {dot(n)}"] * 2 + [dot(n)] * 2 + [str(n)] * 2 + [f"{n // 1000}rb"] * 2 + \
                     [terbilang(n)]
    elif n >= 1000:
        if n % 1000 == 0:
            k = n // 1000
            forms += [f"{k}rb"] * 7 + [f"{k}k"] * 4 + [f"{k}K"] + [f"{k} ribu"] * 4 + \
                     [f"{k} rb"] + [f"Rp{dot(n)}"] * 4 + [f"Rp {dot(n)}"] * 2 + [dot(n)] * 2 + \
                     [str(n)] * 2 + [f"Rp{k}rb", f"{k} ribu rupiah", terbilang(n)]
            if k == 1:
                forms += ["seribu"] * 2
        elif n % 100 == 0:
            dec = f"{n / 1000:.1f}".replace(".", ",")
            forms += [f"{dec}rb"] * 3 + [f"{dec}k"] * 2 + [f"{dec} ribu"] * 2 + \
                     [f"Rp{dot(n)}"] * 3 + [dot(n)] * 2 + [str(n)] * 2 + [terbilang(n)]
        else:
            forms += [f"Rp{dot(n)}"] * 3 + [dot(n)] * 2 + [str(n)] * 2
    else:
        forms += [str(n)] * 3 + [f"Rp{n}"] * 2 + [f"{n} perak"]
    return random.choice(forms)


def pick_amount(row, item=None):
    """Harga dikaitkan ke item: tiap item punya 'tingkat harga' tetap (hash),
    ditambah sedikit variasi, supaya item murah tidak tiba-tiba jutaan."""
    if row["typ"] and random.random() < 0.55:
        return random.choice(row["typ"])
    lo, hi = row["lo"], row["hi"]
    if item is not None and hi > lo * 3:
        f = (zlib.crc32(item.encode("utf-8")) % 1000) / 1000.0
        f = f ** 1.5
        f = min(1.0, max(0.0, random.gauss(f, 0.09)))
        return nice(lo, hi, lo * (hi / lo) ** f)
    return nice(lo, hi)


# ------------------------------------------------------------------ waktu & template
TIMES = ["", "", "", "", "", "tadi", "tadi pagi", "tadi siang", "tadi sore", "tadi malam",
         "semalam", "kemarin", "kemarin sore", "barusan", "hari ini", "pagi ini",
         "malam ini", "minggu lalu", "senin kemarin", "sabtu kemarin", "tgl 5",
         "tanggal 12 kemarin", "2 hari lalu", "barusan banget", "siang tadi", "subuh tadi",
         "tadi sore pas pulang", "lusa kemarin", "akhir pekan kemarin", "pas gajian"]

EXP_PLAIN = [
    "{t} {v} {i} {a}", "{t} {i} {a}", "{i} {a}", "{a} {i}", "{t} habis {a} buat {i}",
    "{t} keluar {a} untuk {i}", "{v} {i} seharga {a}", "{t} {v} {i} habis {a}",
    "catat {i} {a}", "catat dong {t} {v} {i} {a}", "tolong catat pengeluaran {i} {a}",
    "{i} = {a}", "{i}: {a}", "{t} ngeluarin {a} buat {i}", "{t} abis {a} buat {i}",
    "{t} {v} {i} {a} ya", "nambah pengeluaran {i} {a}", "input pengeluaran {t} {i} {a}",
    "{t} aku {v} {i} {a}", "{t} gue {v} {i} {a}", "saya {t} {v} {i} sebesar {a}",
    "pengeluaran {i} sebesar {a}", "{t} total {i} {a}", "{t} {v} {i} {a}",
    "{t} {v} {i} total {a}", "{v} {i} {a}", "{v} {i} {a}", "{t} duit {a} kepake buat {i}",
    "{t} kepotong {a} buat {i}", "catetin {t} {v} {i} {a}", "{i} {a} {t}",
    "pengeluaran: {i} - {a}", "{t} bayar {a} untuk {i}", "{t} spend {a} buat {i}",
]
EXP_MERCH = [
    "{t} {v} {i} di {m} {a}", "{i} di {m} {a}", "{t} {i} {m} {a}", "{m} {i} {a}",
    "{t} {v} {i} dari {m} {a}", "{t} di {m} {v} {i} {a}", "{t} {a} di {m} buat {i}",
    "catat {i} di {m} {a}", "{t} abis {a} di {m} buat {i}",
]
EXP_ONLINE = ["{v} {i} lewat {m} {a}", "{v} {i} pake {m} {a}", "{t} {v} {i} via {m} {a}",
              "{t} {v} {i} di {m} pakai {m2} {a}"]
ONLINE_SUBS = {"Belanja Online", "Game & Voucher", "Pulsa & Paket Data", "Tagihan Listrik & Air",
               "Internet & Wifi", "Tiket Pesawat", "Kereta Api Jarak Jauh", "Taksi & Ojek Online",
               "Komputer & Perangkat", "Film & Bioskop", "Musik & Konser"}
PAYWITH = ["GoPay", "OVO", "DANA", "ShopeePay", "QRIS", "kartu kredit", "transfer BCA", "m-banking",
           "debit BRI", "LinkAja", "Jenius", "paylater"]

INC_PLAIN = [
    "{t} {v} {i} {a}", "{t} {v} {i} sebesar {a}", "{t} {i} {a}", "{i} masuk {a}",
    "{t} {i} masuk {a}", "{i} cair {a}", "{t} {i} udah cair {a}", "{a} dari {i}",
    "{t} {v} {i} {a} ya", "catat pemasukan {i} {a}", "tolong catat {i} {a}",
    "catat dong {t} {v} {i} {a}", "pemasukan {i} sebesar {a}", "{i} = {a}", "{i}: {a}",
    "alhamdulillah {t} {v} {i} {a}", "{t} aku {v} {i} {a}", "{t} ditransfer {i} {a}",
    "{t} {i} ditransfer {a}", "input pemasukan {i} {a}", "nambah pemasukan {i} {a}",
    "{t} {i} {a} udah masuk rekening", "{t} {v} {i} {a}", "{v} {i} {a}",
    "pemasukan: {i} + {a}", "{t} rezeki {i} {a}",
]
INC_VERB_ONLY = ["{t} {v} {i} {a}", "{t} {v} {i} sebesar {a}", "{t} {v} {i} {a} ya",
                 "catat dong {t} {v} {i} {a}", "alhamdulillah {t} {v} {i} {a}",
                 "{t} aku {v} {i} {a}", "{v} {i} {a}", "catat pemasukan: {v} {i} {a}",
                 "{t} {v} {i} total {a}"]
INC_MERCH = ["{t} {v} {i} dari {m} {a}", "{i} dari {m} {a}", "{m} transfer {i} {a}",
             "{t} {i} dari {m} masuk {a}", "catat {i} dari {m} {a}"]

PREFIX = ["", "", "", "", "", "", "", "", "", "oiya ", "btw ", "eh ", "oh iya ", "jangan lupa ",
          "tolong ", "mohon ", "halo, ", "hai Fin, ", "kak ", "min ", "bot, ", "Fin, ",
          "bro ", "bang ", "mas ", "mbak ", "dong catat ", "catet ", "note: "]
SUFFIX = ["", "", "", "", "", "", "", "", "", "", " ya", " dong", " yaa", " makasih", " thanks",
          " ok", " tolong dicatat", " ya kak", " 🙏", " wkwk", " nih", " deh", " gan"]

NOISE_MAP = {"yang": "yg", "untuk": "utk", "sudah": "udh", "tadi": "td", "sama": "sm",
             "dengan": "dgn", "kemarin": "kmrn", "tidak": "gak", "bayar": "byr",
             "beli": "bli", "sebesar": "sbsr", "tolong": "tlg", "catat": "ctt",
             "karena": "krn", "habis": "abis", "juga": "jg", "banget": "bgt",
             "pengeluaran": "pengeluaran", "pemasukan": "pemasukan", "barusan": "brsn",
             "semalam": "smlm", "minggu": "mgg", "tanggal": "tgl", "bulan": "bln",
             "dari": "dr", "kepada": "ke", "makasih": "mksh", "terima": "trima",
             "transfer": "tf", "tagihan": "tgihan", "belanja": "blnj", "kasih": "ksh"}


def add_noise(text):
    words = text.split(" ")
    out = []
    for w in words:
        wl = w.lower()
        if any(ch.isdigit() for ch in w):
            out.append(w)
            continue
        if wl in NOISE_MAP and random.random() < 0.5:
            out.append(NOISE_MAP[wl])
            continue
        if len(wl) > 4 and random.random() < 0.08 and wl.isalpha():
            j = random.randrange(1, len(wl) - 2)
            op = random.random()
            if op < 0.5:
                wl = wl[:j] + wl[j + 1] + wl[j] + wl[j + 2:]
            elif op < 0.8:
                wl = wl[:j] + wl[j] + wl[j:]
            else:
                wl = wl[:j] + wl[j + 1:]
        out.append(wl)
    t = " ".join(out).lower()
    return t


def tidy(s):
    s = re.sub(r"\s+", " ", s).strip()
    s = re.sub(r"\s+([,.!?])", r"\1", s)
    return s


def finalize(s):
    """Prefix/suffix/noise/kapitalisasi -> (text, noisy_flag)."""
    s = tidy(s)
    if random.random() < 0.22:
        s = PREFIX[random.randrange(len(PREFIX))] + s
    s = tidy(s)
    if random.random() < 0.30:
        s = s + SUFFIX[random.randrange(len(SUFFIX))]
    noisy = False
    if random.random() < 0.28:
        s = add_noise(s)
        noisy = True
    elif random.random() < 0.15:
        s = s.lower()
    elif random.random() < 0.55:
        s = s[:1].upper() + s[1:]
    if random.random() < 0.08:
        s += random.choice([".", "!", "!!", "."])
    return tidy(s), noisy


def build_sentence(row):
    kind = row["kind"]
    item = random.choice(row["items"])
    amount = pick_amount(row, item)
    merch = random.choice(row["merch"]) if row["merch"] else ""
    custom_verbs = bool(row["verbs"])
    if kind == "expense":
        verbs = row["verbs"] or ["beli", "bayar"]
        v = random.choice(verbs)
        if merch and random.random() < 0.30:
            pool = list(EXP_MERCH)
            if row["sub"] in ONLINE_SUBS:
                pool += EXP_ONLINE * 2
            tpl = random.choice(pool)
        else:
            tpl = random.choice(EXP_PLAIN)
    else:
        verbs = row["verbs"] or ["terima", "dapat", "dapet", "nerima"]
        v = random.choice(verbs)
        if merch and random.random() < 0.30:
            tpl = random.choice(INC_MERCH)
        elif custom_verbs:
            tpl = random.choice(INC_VERB_ONLY)
        else:
            tpl = random.choice(INC_PLAIN)
    t = random.choice(TIMES)
    if "{m2}" in tpl and not merch:
        tpl = random.choice(EXP_PLAIN)
    s = tpl.format(t=t, v=v, i=item, a=fmt_amount(amount), m=merch,
                   m2=random.choice(PAYWITH))
    return s, item, merch, v, amount


# ------------------------------------------------------------------ transaksi tunggal
records = []
seen = set()
rid = 0
by_sub = {}
for row in ROWS:
    n_ok, tries = 0, 0
    while n_ok < N_PER_SUB and tries < N_PER_SUB * 40:
        tries += 1
        raw, item, merch, v, amount = build_sentence(row)
        text, noisy = finalize(raw)
        key = text.lower()
        if key in seen or len(text) < 5:
            continue
        seen.add(key)
        rid += 1
        records.append({
            "id": f"tx-{rid:06d}",
            "text": text,
            "lang": "id",
            "intent": "catat_pengeluaran" if row["kind"] == "expense" else "catat_pemasukan",
            "kind": row["kind"],
            "category": row["parent"],
            "subcategory": row["sub"],
            "amount": amount,
            "noisy": noisy,
        })
        n_ok += 1
    by_sub[row["sub"]] = n_ok

# ------------------------------------------------------------------ multi transaksi
JOIN = [", ", " sama ", " terus ", " dan ", " + ", ", lalu ", " plus ", "; ", ", abis itu ", " trus "]
exp_rows = [r for r in ROWS if r["kind"] == "expense"]
inc_rows = [r for r in ROWS if r["kind"] == "income"]
multi = []
mt = 0
while len(multi) < N_MULTI and mt < N_MULTI * 30:
    mt += 1
    mixed = random.random() < 0.10
    k = random.choice([2, 2, 2, 3, 3, 4])
    if mixed:
        chosen = random.sample(exp_rows, k - 1) + random.sample(inc_rows, 1)
        random.shuffle(chosen)
    else:
        chosen = random.sample(exp_rows, k)
    # hindari sub-kategori sama
    if len({c["sub"] for c in chosen}) < len(chosen):
        continue
    parts, labels = [], []
    for r in chosen:
        item = random.choice(r["items"])
        amt = pick_amount(r, item)
        if r["kind"] == "expense":
            v = random.choice(r["verbs"] or ["beli", "bayar"])
            seg = random.choice(["{v} {i} {a}", "{i} {a}", "{v} {i} {a}", "{i} {a}", "{a} buat {i}"]
                                ).format(v=v, i=item, a=fmt_amount(amt))
        else:
            v = random.choice(r["verbs"] or ["terima", "dapat", "dapet"])
            seg = random.choice(["{v} {i} {a}", "{i} masuk {a}", "{v} {i} {a}"]
                                ).format(v=v, i=item, a=fmt_amount(amt))
        parts.append(seg)
        labels.append({"kind": r["kind"], "category": r["parent"],
                       "subcategory": r["sub"], "amount": amt})
    sep = random.choice(JOIN)
    body = sep.join(parts)
    t = random.choice(TIMES)
    raw = (t + " " + body) if random.random() < 0.6 else body
    text, noisy = finalize(raw)
    key = text.lower()
    if key in seen:
        continue
    seen.add(key)
    multi.append({
        "id": f"mt-{len(multi) + 1:06d}",
        "text": text, "lang": "id", "intent": "catat_transaksi_multi",
        "transactions": labels, "noisy": noisy,
    })

# ------------------------------------------------------------------ intent non-transaksi
ACC = ["BCA", "Mandiri", "BRI", "BNI", "GoPay", "OVO", "DANA", "ShopeePay", "LinkAja",
       "Jenius", "SeaBank", "Bank Jago", "dompet", "tabungan", "rekening utama", "kas",
       "e-wallet", "uang tunai", "rekening gaji", "dompet digital"]
PER = ["hari ini", "kemarin", "minggu ini", "minggu lalu", "bulan ini", "bulan lalu",
       "bulan Oktober", "bulan September", "tahun ini", "3 bulan terakhir", "sebulan terakhir",
       "seminggu terakhir", "akhir pekan kemarin", "sepanjang 2026", "kuartal ini",
       "tanggal 1 sampai 15", "dari awal bulan"]
CATS = sorted({r["parent"] for r in ROWS} | {r["sub"] for r in ROWS}) + [
    "makan", "jajan", "bensin", "ngopi", "belanja", "hiburan", "tagihan", "transport",
    "gaji", "kesehatan", "pendidikan", "kebutuhan rumah", "makanan", "transportasi"]
ITEMS = ["listrik", "PLN", "wifi", "IndiHome", "kos", "kontrakan", "cicilan motor", "cicilan KPR",
         "kartu kredit", "BPJS", "asuransi", "pulsa", "PDAM", "arisan", "SPP anak", "pajak motor",
         "Netflix", "Spotify", "cicilan HP", "paylater", "kopi tadi", "makan siang", "bensin",
         "parkir", "belanja bulanan", "token listrik", "gojek", "laundry"]

INTENTS = {
    "cek_saldo": [
        "saldo {acc} berapa?", "cek saldo {acc}", "sisa saldo {acc} tinggal berapa ya",
        "berapa sisa uang di {acc}", "saldo aku sekarang berapa", "uangku sisa berapa",
        "lihat total saldo semua akun", "saldo {acc} sama {acc2} berapa", "tolong cek saldo {acc} dong",
        "duit di {acc} masih ada berapa", "sisa uang kas berapa", "total aset aku berapa",
        "saldo terakhir {acc}", "kira-kira saldo {acc} masih cukup nggak?", "info saldo {acc}",
        "saldo gabungan semua rekening", "berapa uang yang aku punya sekarang",
        "cek sisa dompet digital", "masih ada berapa di {acc} nih", "saldo {acc} {per}",
        "sisa duit {acc} berapa sih", "balance {acc}", "saldo?", "cek saldo", "saldo semua akun"],
    "riwayat_transaksi": [
        "lihat transaksi {per}", "transaksi {cat} {per} apa aja", "riwayat pengeluaran {per}",
        "tampilkan transaksi terakhir", "10 transaksi terakhir dong", "daftar pemasukan {per}",
        "mutasi {acc} {per}", "tadi aku beli apa aja ya", "cari transaksi {i}",
        "cari catatan {cat} di atas {a}", "transaksi {acc} {per}", "history {cat} {per}",
        "list pengeluaran {cat} {per}", "tunjukin catatan {per}", "semua transaksi {acc} {per}",
        "kapan terakhir aku bayar {i}", "transaksi terbesar {per}", "pengeluaran di atas {a} {per}",
        "coba tampilkan pemasukan {per}", "filter transaksi {cat} {per}", "riwayat {i}"],
    "ringkasan_pengeluaran": [
        "total pengeluaran {per} berapa", "berapa habis buat {cat} {per}",
        "pengeluaran terbesar {per} apa", "rangkuman keuangan {per}", "laporan keuangan {per}",
        "bandingkan pengeluaran {per} dengan bulan lalu", "kategori apa yang paling boros {per}",
        "berapa pemasukan {per}", "sisa uang {per} berapa setelah pengeluaran",
        "persentase pengeluaran {cat} {per}", "rata-rata pengeluaran harian {per}",
        "grafik pengeluaran {per}", "total {cat} {per}", "aku boros nggak {per}",
        "ringkasan cashflow {per}", "selisih pemasukan dan pengeluaran {per}",
        "top 5 pengeluaran {per}", "berapa total jajan {per}",
        "sudah berapa banyak aku habiskan buat {cat} {per}", "analisis pengeluaran {per}"],
    "atur_budget": [
        "set budget {cat} {a} per bulan", "batasi pengeluaran {cat} maksimal {a}",
        "budget {cat} {per} {a}", "ubah budget {cat} jadi {a}", "bikin anggaran {cat} {a} sebulan",
        "tolong atur batas {cat} {a}", "kasih limit {cat} {a} per minggu",
        "naikin budget {cat} jadi {a}", "turunin anggaran {cat} jadi {a}", "hapus budget {cat}",
        "budget {cat} sisa berapa", "ingetin kalau {cat} udah lewat {a}",
        "anggaran bulanan aku {a}", "atur anggaran total {a} per bulan", "budget {cat} masih aman nggak",
        "limit harian {a}", "target hemat {a} per bulan", "alokasi {cat} {a}",
        "tetapkan plafon {cat} {a}", "kasih notifikasi kalau {cat} hampir habis"],
    "edit_transaksi": [
        "ubah transaksi terakhir jadi {a}", "salah catat, harusnya {a}", "ganti nominal {i} jadi {a}",
        "pindahin {i} ke kategori {cat}", "salah kategori, harusnya {cat}", "edit catatan {i} tadi",
        "ubah tanggal transaksi {i} jadi kemarin", "koreksi catatan terakhir",
        "transaksi barusan salah, ganti ke {a}", "ganti akun transaksi terakhir ke {acc}",
        "tolong benerin kategori {i} jadi {cat}", "revisi nominal {i} {a}", "update catatan {i} {a}",
        "tambahin catatan di transaksi terakhir", "itu harusnya masuk {cat} bukan {cat2}",
        "ubah deskripsi {i}", "ganti kategori transaksi terakhir ke {cat}",
        "nominal {i} keliru, yang bener {a}", "edit transaksi {per}", "pindahkan transaksi {i} ke {acc}"],
    "hapus_transaksi": [
        "hapus transaksi terakhir", "batalin catatan {i} tadi", "hapus catatan {i}",
        "delete transaksi {i} {a}", "hapus semua transaksi {per}", "salah input, hapus aja",
        "undo transaksi barusan", "hapus pengeluaran {cat} {per}", "catatan {i} dobel, hapus satu",
        "hapus transaksi {acc} {per}", "tolong hapus catatan terakhir", "batalkan pencatatan tadi",
        "buang transaksi {i}", "hapus entri {i} {a}", "itu nggak jadi, hapus ya",
        "hapus yang kemarin", "clear transaksi {per}", "hilangkan catatan {i}",
        "cancel transaksi terakhir", "hapus duplikat transaksi"],
    "transfer_antar_akun": [
        "pindahin {a} dari {acc} ke {acc2}", "transfer {a} {acc} ke {acc2}",
        "top up {acc2} {a} dari {acc}", "tarik tunai {a} dari {acc}", "setor tunai {a} ke {acc}",
        "isi saldo {acc2} {a} pakai {acc}", "mutasi {a} {acc} ke {acc2}", "pindah dana {a} ke {acc2}",
        "pindahin duit {acc} ke {acc2} {a}", "top up {acc2} {a}", "tarik {a} di ATM {acc}",
        "nabung {a} dari {acc} ke tabungan", "masukin {a} ke tabungan",
        "transfer ke rekening sendiri {a}", "geser saldo {acc} ke {acc2} {a}",
        "kirim {a} dari {acc} ke {acc2}", "isi {acc2} {a}", "setor {a} ke celengan",
        "saldo {acc} dipindah {a} ke {acc2}"],
    "pengingat_tagihan": [
        "ingetin bayar {i} tiap tanggal {n}", "buat pengingat tagihan {i}", "reminder bayar {i} {per}",
        "ingatkan aku bayar {i} besok", "jangan lupa bayar {i} tanggal {n}",
        "set pengingat cicilan tiap bulan", "ingetin tagihan wifi tanggal {n}", "alarm tagihan listrik",
        "notifikasi jatuh tempo {i}", "pengingat bayar {i} sebelum tanggal {n}",
        "tagihan apa aja yang jatuh tempo {per}", "tagihan mendekati jatuh tempo",
        "kapan jatuh tempo {i}", "jadwalkan pembayaran {i} tanggal {n}",
        "tolong ingetin {i} {a} tiap bulan", "tambah tagihan rutin {i} {a}",
        "tagihan rutin bulan ini apa aja", "bikin tagihan berulang {i} {a}",
        "ingetin bayar kos tanggal {n}", "pengingat arisan tanggal {n}"],
    "bantuan": [
        "cara catat transaksi gimana", "kamu bisa apa aja", "help", "tolong jelasin fitur",
        "gimana cara set budget", "tutorial dong", "apa aja yang bisa dilakuin", "fitur apa saja",
        "panduan penggunaan", "cara tambah kategori", "gimana cara pakai ini", "bantuan",
        "cara ubah kategori transaksi", "bisa catat pake suara nggak", "cara lihat laporan bulanan",
        "contoh perintah yang bisa dipakai apa", "bot ini fungsinya apa", "cara catat banyak transaksi sekaligus",
        "bisa nggak ngelacak utang", "cara export data"],
    "sapaan": [
        "halo", "hai", "hai Fin", "selamat pagi", "selamat siang", "selamat sore", "selamat malam",
        "assalamualaikum", "makasih ya", "terima kasih banyak", "thanks", "oke sip", "mantap", "siap",
        "nuhun", "oke makasih", "ok deh", "pagi", "halo kak", "p", "test", "hello", "hi", "woi",
        "mantul", "sip sip", "wah keren", "good job", "makasih banyak ya Fin", "oke paham",
        "siap laksanakan", "halo min", "permisi", "salam kenal", "met pagi", "met malam"],
    "di_luar_topik": [
        "cuaca besok gimana", "ceritain jokes dong", "siapa presiden pertama Indonesia",
        "resep nasi goreng", "rekomendasi film bagus", "terjemahin kalimat ini ke Inggris",
        "berapa hasil 25 dikali 12", "bikinin puisi tentang hujan", "jadwal sholat hari ini",
        "skor bola semalam", "tips diet sehat", "cara masak rendang", "apa itu black hole",
        "kapan lebaran tahun depan", "kasih quotes motivasi", "cara bikin website",
        "ibukota Jepang apa", "lagu yang lagi hits apa", "tebak-tebakan dong", "kamu suka musik apa",
        "bantu kerjain PR matematika", "info lowongan kerja", "cara mengatasi insomnia",
        "rekomendasi tempat wisata di Bali", "gimana cara hamil cepat", "apa kabar dunia",
        "ceritain sejarah Majapahit", "tolong tulis email ke dosen", "cara install Windows",
        "siapa pemenang piala dunia 2022"],
}
EXTRA_P = ["", "", "", "eh ", "btw ", "kak ", "min ", "Fin, ", "tolong ", "coba ", "bisa tolong ", "dong "]
EXTRA_S = ["", "", "", " dong", " ya", " nih", " deh", " please", " sekarang", " cepetan", " ya kak", "?"]


def fill_intent(tpl):
    a = random.randint(1, 600) * 5000 if random.random() < 0.5 else nice(10_000, 20_000_000)
    return tpl.format(
        acc=random.choice(ACC), acc2=random.choice([x for x in ACC]),
        per=random.choice(PER), cat=random.choice(CATS), cat2=random.choice(CATS),
        i=random.choice(ITEMS), a=fmt_amount(a), n=random.randint(1, 28))


intents_out = []
for name, tpls in INTENTS.items():
    got, tries = 0, 0
    target = N_PER_INTENT
    while got < target and tries < target * 60:
        tries += 1
        s = fill_intent(random.choice(tpls))
        if "{" in s:
            continue
        if name in ("sapaan", "di_luar_topik"):
            s = random.choice(EXTRA_P) + s + random.choice(EXTRA_S)
        else:
            if random.random() < 0.3:
                s = random.choice(EXTRA_P) + s
            if random.random() < 0.3:
                s = s + random.choice(EXTRA_S)
        text, noisy = finalize(s)
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        intents_out.append({
            "id": f"in-{len(intents_out) + 1:06d}", "text": text, "lang": "id",
            "intent": name, "noisy": noisy})
        got += 1

# ------------------------------------------------------------------ split (stratified)
random.shuffle(records)
groups = {}
for r in records:
    groups.setdefault(r["subcategory"], []).append(r)
train, val, test = [], [], []
for sub, lst in groups.items():
    n = len(lst)
    a, b = int(n * 0.8), int(n * 0.9)
    for r in lst[:a]:
        r["split"] = "train"; train.append(r)
    for r in lst[a:b]:
        r["split"] = "val"; val.append(r)
    for r in lst[b:]:
        r["split"] = "test"; test.append(r)


def dump_jsonl(path, rows):
    with open(os.path.join(OUT, path), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")


random.shuffle(train)
dump_jsonl("transactions_train.jsonl", train)
dump_jsonl("transactions_val.jsonl", val)
dump_jsonl("transactions_test.jsonl", test)
dump_jsonl("transactions_all.jsonl", train + val + test)
dump_jsonl("multi_transactions.jsonl", multi)
dump_jsonl("intents_non_transaction.jsonl", intents_out)

with open(os.path.join(OUT, "transactions_all.csv"), "w", encoding="utf-8-sig", newline="") as f:
    w = csv.writer(f)
    w.writerow(["id", "text", "intent", "kind", "category", "subcategory", "amount", "noisy", "split"])
    for r in train + val + test:
        w.writerow([r["id"], r["text"], r["intent"], r["kind"], r["category"],
                    r["subcategory"], r["amount"], int(r["noisy"]), r["split"]])

# gabungan siap-latih untuk intent classifier (semua intent, 1 file)
with open(os.path.join(OUT, "intent_all.jsonl"), "w", encoding="utf-8") as f:
    for r in train + val + test:
        f.write(json.dumps({"id": r["id"], "text": r["text"], "intent": r["intent"]}, ensure_ascii=False) + "\n")
    for r in multi:
        f.write(json.dumps({"id": r["id"], "text": r["text"], "intent": r["intent"]}, ensure_ascii=False) + "\n")
    for r in intents_out:
        f.write(json.dumps({"id": r["id"], "text": r["text"], "intent": r["intent"]}, ensure_ascii=False) + "\n")

tax = {}
for r in ROWS:
    tax.setdefault(r["parent"], {"kind": r["kind"], "subcategories": []})["subcategories"].append(r["sub"])
with open(os.path.join(OUT, "taxonomy.json"), "w", encoding="utf-8") as f:
    json.dump(tax, f, ensure_ascii=False, indent=2)

print("transaksi tunggal :", len(records), "(train/val/test = %d/%d/%d)" % (len(train), len(val), len(test)))
print("multi transaksi   :", len(multi))
print("intent lain       :", len(intents_out))
short = {k: v for k, v in by_sub.items() if v < N_PER_SUB}
print("subkategori < target:", short)
