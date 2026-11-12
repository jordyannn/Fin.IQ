export interface ImportCategoryOption {
  id: string;
  name: string;
  kind?: string | null;
  parentId?: string | null;
  icon?: string | null;
}

export interface GroupedCategoryNode {
  parent: ImportCategoryOption;
  children: ImportCategoryOption[];
}

export const EXPENSE_STANDARD_GROUPS: Array<{ parent: string; children: string[] }> = [
  { parent: "Makanan & Minuman", children: ["Kopi & Minuman", "Restoran & Kuliner"] },
  { parent: "Transportasi", children: ["Bahan Bakar & SPBU"] },
  { parent: "Belanja", children: ["Supermarket & Minimarket"] },
  { parent: "Tagihan & Utilitas", children: ["Pulsa & Paket Data"] },
  { parent: "Kebutuhan Rumah", children: [] },
  { parent: "Kesehatan & Medis", children: [] },
  { parent: "Hiburan & Rekreasi", children: [] },
  { parent: "Pendidikan & Karir", children: [] },
  { parent: "Umum", children: [] },
];

export const INCOME_STANDARD_GROUPS: Array<{ parent: string; children: string[] }> = [
  { parent: "Gaji & Pendapatan", children: [] },
  { parent: "Bonus & THR", children: [] },
  { parent: "Hasil Bisnis & Dagang", children: [] },
  { parent: "Pekerjaan Sampingan / Freelance", children: [] },
  { parent: "Hadiah & Rezeki", children: [] },
  { parent: "Investasi & Dividen", children: [] },
  { parent: "Pemasukan Lainnya", children: [] },
];

export function buildFallbackOptions(kind: "expense" | "income"): ImportCategoryOption[] {
  const groups = kind === "income" ? INCOME_STANDARD_GROUPS : EXPENSE_STANDARD_GROUPS;
  const result: ImportCategoryOption[] = [];
  for (const grp of groups) {
    const parentId = `std-${kind}-${grp.parent}`;
    result.push({ id: parentId, name: grp.parent, kind, parentId: null });
    for (const child of grp.children) {
      result.push({
        id: `std-${kind}-${grp.parent}-${child}`,
        name: child,
        kind,
        parentId,
      });
    }
  }
  return result;
}

/**
 * Mengelompokkan kategori berdasarkan jenis transaksi (Pemasukan vs Pengeluaran),
 * hanya menampilkan kategori utama (parent) di level atas beserta sub-kategorinya di dalam.
 */
export function buildHierarchicalCategories(
  categories: ImportCategoryOption[],
  kind: "expense" | "income"
): GroupedCategoryNode[] {
  const userForKind = categories.filter((c) =>
    kind === "income" ? c.kind === "income" : !c.kind || c.kind === "expense"
  );

  const source = userForKind.length > 0 ? userForKind : buildFallbackOptions(kind);
  const validIds = new Set(source.map((c) => c.id));

  const parents = source.filter((c) => !c.parentId || !validIds.has(c.parentId));
  const childrenMap = new Map<string, ImportCategoryOption[]>();

  for (const cat of source) {
    if (cat.parentId && validIds.has(cat.parentId)) {
      const existing = childrenMap.get(cat.parentId) || [];
      existing.push(cat);
      childrenMap.set(cat.parentId, existing);
    }
  }

  return parents.map((parent) => ({
    parent,
    children: childrenMap.get(parent.id) || [],
  }));
}

/**
 * Saat user mengganti jenis transaksi (Pengeluaran <-> Pemasukan <-> Transfer),
 * pastikan kategori terpilih otomatis menyesuaikan jenisnya jika sebelumnya berasal dari jenis yang berlawanan.
 */
export function resolveDefaultCategoryForType(
  categories: ImportCategoryOption[],
  targetType: "expense" | "income" | "transfer",
  currentCategoryName: string
): string {
  if (targetType === "transfer") {
    return "Transfer Saldo";
  }

  const trimmed = (currentCategoryName || "").trim();
  const trimmedLower = trimmed.toLowerCase();

  const expenseGroups = buildHierarchicalCategories(categories, "expense");
  const incomeGroups = buildHierarchicalCategories(categories, "income");
  const targetGroups = targetType === "income" ? incomeGroups : expenseGroups;
  const oppositeGroups = targetType === "income" ? expenseGroups : incomeGroups;

  const matchesIn = (groups: GroupedCategoryNode[], nameLower: string) =>
    groups.some(
      (g) =>
        g.parent.name.toLowerCase() === nameLower ||
        g.children.some((ch) => ch.name.toLowerCase() === nameLower)
    );

  if (
    !trimmed ||
    trimmedLower === "transfer saldo" ||
    (!matchesIn(targetGroups, trimmedLower) && matchesIn(oppositeGroups, trimmedLower))
  ) {
    return targetGroups[0]?.parent.name || (targetType === "income" ? "Gaji & Pendapatan" : "Umum");
  }

  return trimmed;
}

