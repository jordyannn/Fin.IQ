import { GeometricIconName } from "@/components/ui/GeometricIcon";

export interface NavItem {
  label: string;
  href: string;
  iconName: GeometricIconName;
  description: string;
  keywords: string[];
  isAI?: boolean;
}

export const MAIN_NAVIGATION_ITEMS: NavItem[] = [
  {
    label: "Ringkasan",
    href: "/overview",
    iconName: "overview",
    description: "Dashboard arus kas, tren pemasukan, dan saldo utama",
    keywords: ["ringkasan", "overview", "dashboard", "saldo", "arus kas", "pemasukan", "pengeluaran"],
  },
  {
    label: "Transaksi",
    href: "/transactions",
    iconName: "transactions",
    description: "Daftar mutasi uang masuk, keluar, dan transfer akun",
    keywords: ["transaksi", "transactions", "mutasi", "riwayat", "belanja", "transfer"],
  },
  {
    label: "AI Advisor",
    href: "/ai",
    iconName: "ai",
    isAI: true,
    description: "Konsultan keuangan pribadi bertenaga Gemini AI",
    keywords: ["ai", "advisor", "asisten", "tanya", "konsultasi", "gemini", "rekomendasi", "audit"],
  },
  {
    label: "Impor Data",
    href: "/import",
    iconName: "import",
    description: "Impor mutasi e-statement, CSV, Excel, dan PDF rekening bank",
    keywords: ["impor", "import", "csv", "excel", "pdf", "statement", "rekening", "mutasi bank"],
  },
  {
    label: "Analisis",
    href: "/analytics",
    iconName: "analytics",
    description: "Grafik perbandingan pos, tren belanja, dan rasio keuangan",
    keywords: ["analisis", "analytics", "grafik", "chart", "laporan", "statistik", "tren", "pos"],
  },
  {
    label: "Kalender",
    href: "/calendar",
    iconName: "calendar",
    description: "Kalender aktivitas dan peta frekuensi transaksi harian",
    keywords: ["kalender", "calendar", "jadwal", "tanggal", "harian", "aktivitas"],
  },
  {
    label: "Akun",
    href: "/accounts",
    iconName: "accounts",
    description: "Kelola rekening bank, e-wallet, dan dompet kas tunai",
    keywords: ["akun", "accounts", "bank", "rekening", "e-wallet", "dompet", "kas", "tunai", "saldo"],
  },
  {
    label: "Kategori",
    href: "/categories",
    iconName: "categories",
    description: "Pos kategori pengeluaran dan pemasukan keuangan",
    keywords: ["kategori", "categories", "pos", "kebutuhan", "makan", "transport", "hiburan"],
  },
  {
    label: "Anggaran",
    href: "/budgets",
    iconName: "budgets",
    description: "Batas anggaran pengeluaran bulanan per pos belanja",
    keywords: ["anggaran", "budgets", "budget", "limit", "target", "hemat", "pos belanja"],
  },
  {
    label: "Buku Kas",
    href: "/ledgers",
    iconName: "ledgers",
    description: "Kelola pembukuan buku kas terpisah (pribadi, usaha, keluarga)",
    keywords: ["buku kas", "ledgers", "ledger", "pembukuan", "bisnis", "usaha", "keluarga"],
  },
  {
    label: "Laporan Tahunan",
    href: "/annual-report",
    iconName: "annual-report",
    description: "Rekapitulasi tahunan dan evaluasi performa menyeluruh",
    keywords: ["laporan", "annual-report", "tahunan", "rekap", "audit", "laba rugi"],
  },
];

export const SECONDARY_NAVIGATION_ITEMS: NavItem[] = [
  {
    label: "Pengaturan",
    href: "/settings",
    iconName: "settings",
    description: "Pengaturan profil, token Google Gemini, dan preferensi akun",
    keywords: ["pengaturan", "settings", "profil", "token", "gemini", "api key", "preferensi"],
  },
  {
    label: "Kesehatan Data",
    href: "/integrity",
    iconName: "integrity",
    description: "Verifikasi keutuhan saldo kas dan audit integritas database",
    keywords: ["kesehatan data", "integrity", "audit", "validasi", "database", "verifikasi saldo"],
  },
];

export const ALL_NAVIGATION_ITEMS: NavItem[] = [
  ...MAIN_NAVIGATION_ITEMS,
  ...SECONDARY_NAVIGATION_ITEMS,
];
