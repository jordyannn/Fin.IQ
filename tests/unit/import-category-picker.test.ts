import { describe, it, expect } from "vitest";
import {
  buildHierarchicalCategories,
  resolveDefaultCategoryForType,
  ImportCategoryOption,
} from "../../src/components/import/category-picker-utils";

const SAMPLE_CATEGORIES: ImportCategoryOption[] = [
  { id: "p-food", name: "Makanan & Minuman", kind: "expense", parentId: null },
  { id: "c-coffee", name: "Kopi & Minuman", kind: "expense", parentId: "p-food" },
  { id: "c-daily", name: "Makan Harian", kind: "expense", parentId: "p-food" },
  { id: "p-trans", name: "Transportasi", kind: "expense", parentId: null },
  { id: "c-park", name: "Parkir & Tol", kind: "expense", parentId: "p-trans" },
  { id: "p-salary", name: "Gaji & Tunjangan", kind: "income", parentId: null },
  { id: "c-bonus", name: "Bonus Tahunan", kind: "income", parentId: "p-salary" },
  { id: "p-side", name: "Part time", kind: "income", parentId: null },
];

describe("ImportCategoryPicker Hierarchy & Filtering Helpers", () => {
  it("hanya menampilkan kategori pemasukan beserta sub-kategorinya saat txType = income", () => {
    const incomeTree = buildHierarchicalCategories(SAMPLE_CATEGORIES, "income");

    const topLevelNames = incomeTree.map((n) => n.parent.name);
    expect(topLevelNames).toEqual(["Gaji & Tunjangan", "Part time"]);

    // Pastikan kategori pengeluaran tidak bocor ke daftar pemasukan
    expect(topLevelNames).not.toContain("Makanan & Minuman");
    expect(topLevelNames).not.toContain("Kopi & Minuman");
    expect(topLevelNames).not.toContain("Parkir & Tol");

    // Sub-kategori berada di dalam parent-nya, bukan di level atas
    expect(incomeTree[0].children.map((c) => c.name)).toEqual(["Bonus Tahunan"]);
    expect(incomeTree[1].children).toEqual([]);
  });

  it("hanya menampilkan kategori besar pengeluaran di level atas dan menaruh sub-kategori di dalamnya", () => {
    const expenseTree = buildHierarchicalCategories(SAMPLE_CATEGORIES, "expense");

    const topLevelNames = expenseTree.map((n) => n.parent.name);
    expect(topLevelNames).toEqual(["Makanan & Minuman", "Transportasi"]);

    // Sub-kategori tidak muncul sejajar di top-level, tapi terisi di dalam children
    expect(topLevelNames).not.toContain("Kopi & Minuman");
    expect(topLevelNames).not.toContain("Makan Harian");
    expect(topLevelNames).not.toContain("Gaji & Tunjangan");

    expect(expenseTree[0].children.map((c) => c.name)).toEqual([
      "Kopi & Minuman",
      "Makan Harian",
    ]);
    expect(expenseTree[1].children.map((c) => c.name)).toEqual(["Parkir & Tol"]);
  });

  it("melindungi orphan sub-category yang parent-nya hilang agar tetap dapat dipilih", () => {
    const categoriesWithOrphan: ImportCategoryOption[] = [
      { id: "c-orphan", name: "Sub Tanpa Induk", kind: "income", parentId: "missing-parent" },
    ];
    const tree = buildHierarchicalCategories(categoriesWithOrphan, "income");
    expect(tree).toHaveLength(1);
    expect(tree[0].parent.name).toBe("Sub Tanpa Induk");
    expect(tree[0].children).toEqual([]);
  });

  it("menggunakan fallback kategori standar sesuai kind jika user belum punya kategori di DB", () => {
    const emptyIncomeTree = buildHierarchicalCategories([], "income");
    expect(emptyIncomeTree.some((g) => g.parent.name === "Gaji & Pendapatan")).toBe(true);
    expect(emptyIncomeTree.some((g) => g.parent.name === "Makanan & Minuman")).toBe(false);
  });

  it("otomatis menyesuaikan kategori ketika jenis transaksi diganti antara expense, income, dan transfer", () => {
    // Sub-kategori pengeluaran -> pindah ke Pemasukan => pindah ke parent pemasukan pertama
    expect(resolveDefaultCategoryForType(SAMPLE_CATEGORIES, "income", "Kopi & Minuman")).toBe(
      "Gaji & Tunjangan"
    );

    // Kategori pemasukan -> pindah ke Pengeluaran => pindah ke parent pengeluaran pertama
    expect(resolveDefaultCategoryForType(SAMPLE_CATEGORIES, "expense", "Bonus Tahunan")).toBe(
      "Makanan & Minuman"
    );

    // Pindah ke Transfer
    expect(resolveDefaultCategoryForType(SAMPLE_CATEGORIES, "transfer", "Kopi & Minuman")).toBe(
      "Transfer Saldo"
    );

    // Nama kustom yang tidak terdaftar di DB tetap dipertahankan saat berganti jenis
    expect(resolveDefaultCategoryForType(SAMPLE_CATEGORIES, "income", "Proyek Khusus 2026")).toBe(
      "Proyek Khusus 2026"
    );
  });
});
