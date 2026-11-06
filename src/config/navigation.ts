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
    description: "Arus kas, tren belanja, dan saldo kas utama",
    keywords: ["ringkasan", "overview", "dashboard", "saldo", "arus kas", "cuan", "boncos", "dompet"],
  },
  {
    label: "Transaksi",
    href: "/transactions",
    iconName: "transactions",
    description: "Riwayat mutasi pengeluaran, pemasukan, dan transfer dana",
    keywords: ["transaksi", "transactions", "mutasi", "riwayat", "belanja", "transfer", "duit"],
  },
  {
    label: "Asisten AI",
    href: "/ai",
    iconName: "ai",
    isAI: true,
    description: "Konsultasi dan analisis rencana keuangan bareng Bang Peci",
    keywords: ["bang peci", "ai", "advisor", "asisten", "tanya", "konsultasi", "gemini", "rekomendasi", "audit"],
  },
  {
    label: "Impor",
    href: "/import",
    iconName: "import",
    description: "Impor mutasi bank CSV, Excel, dan PDF secara otomatis",
    keywords: ["impor", "import", "csv", "excel", "pdf", "statement", "rekening", "mutasi bank", "struk"],
  },
  {
    label: "Analisis",
    href: "/analytics",
    iconName: "analytics",
    description: "Grafik pos pengeluaran dan rasio keuangan",
    keywords: ["analisis", "analytics", "grafik", "chart", "laporan", "statistik", "tren", "pos"],
  },
  {
    label: "Kalender",
    href: "/calendar",
    iconName: "calendar",
    description: "Aktivitas dan frekuensi transaksi harian",
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
    description: "Kategori pos pengeluaran dan pemasukan keuangan",
    keywords: ["kategori", "categories", "pos", "kebutuhan", "makan", "transport", "hiburan", "jajan"],
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
    keywords: ["buku kas", "ledgers", "ledger", "pembukuan", "bisnis", "usaha", "keluarga", "kantong"],
  },
  {
    label: "Laporan Tahunan",
    href: "/annual-report",
    iconName: "annual-report",
    description: "Rekapitulasi tahunan dan evaluasi performa menyeluruh",
    keywords: ["laporan", "laporan tahunan", "annual-report", "tahunan", "rekap", "audit", "laba rugi"],
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
];

export const ALL_NAVIGATION_ITEMS: NavItem[] = [
  ...MAIN_NAVIGATION_ITEMS,
  ...SECONDARY_NAVIGATION_ITEMS,
];
