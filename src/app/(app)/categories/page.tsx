"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Plus,
  Trash2,
  Search,
  Tag,
  Utensils,
  Coffee,
  Cookie,
  Car,
  ShoppingBag,
  ShoppingCart,
  Zap,
  PiggyBank,
  Heart,
  Activity,
  GraduationCap,
  Gamepad2,
  TrendingUp,
  CreditCard,
  Banknote,
  Briefcase,
  Wallet,
  Layers,
} from "lucide-react";
import { GeometricIcon } from "@/components/ui/GeometricIcon";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConfirm } from "@/store/confirm.store";
import { CategoryIcon } from "@/components/categories/CategoryIcon";

export default function CategoriesPage() {
  const utils = trpc.useUtils();
  const confirm = useConfirm();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");

  const { data: categoriesList, isLoading } = trpc.categories.list.useQuery({ kind });

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: async () => {
      await utils.categories.invalidate();
      await utils.categories.list.refetch({ kind });
      setNewName("");
      setSelectedParentId("");
      setIsAdding(false);
    },
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: async () => {
      await utils.categories.invalidate();
      await utils.categories.list.refetch({ kind });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    createMutation.mutate({
      name: newName.trim(),
      kind,
      parentId: selectedParentId || undefined,
    });
  };

  // Group categories into parent groups and their subcategories
  const { parentGroups, standaloneCategories } = useMemo(() => {
    if (!categoriesList) return { parentGroups: [], standaloneCategories: [] };

    const parents = categoriesList.filter((c) => !c.parentId);
    const subMap = new Map<string, typeof categoriesList>();

    for (const c of categoriesList) {
      if (c.parentId) {
        const list = subMap.get(c.parentId) || [];
        list.push(c);
        subMap.set(c.parentId, list);
      }
    }

    const q = searchQuery.toLowerCase().trim();

    const groups = parents.map((p) => {
      const subs = subMap.get(p.id) || [];
      const filteredSubs = q
        ? subs.filter((s) => s.name.toLowerCase().includes(q))
        : subs;
      const matchesParent = !q || p.name.toLowerCase().includes(q);

      return {
        parent: p,
        subcategories: q && !matchesParent ? filteredSubs : subs,
        visible: matchesParent || filteredSubs.length > 0,
      };
    }).filter((g) => g.visible);

    const orphans = categoriesList.filter(
      (c) => c.parentId && !parents.some((p) => p.id === c.parentId)
    );

    return {
      parentGroups: groups,
      standaloneCategories: orphans,
    };
  }, [categoriesList, searchQuery]);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-md bg-[#A7F3D0]/40 flex items-center justify-center text-[#064E3B] shrink-0">
              <GeometricIcon name="categories" className="h-4 w-4" />
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Pos & Kategori Arus Kas</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Daftar {categoriesList?.length || 0} kategori aktif untuk pelaporan dan pagu anggaran kas Anda.
          </p>
        </div>

        <Button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-[#059669] hover:bg-[#047857] text-white gap-2 shadow-level-1 text-xs rounded-md font-semibold h-8 sm:h-9 px-3.5"
        >
          <GeometricIcon name="plus" className="h-3.5 w-3.5" />
          Kategori Baru
        </Button>
      </div>

      {/* Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex rounded-md bg-slate-100 dark:bg-slate-800/60 p-1 text-xs border border-border/60 w-full sm:w-auto">
          <button
            onClick={() => setKind("expense")}
            className={`px-3.5 py-1.5 rounded-sm font-semibold transition-all ${
              kind === "expense"
                ? "bg-white dark:bg-slate-900 text-[#BA1A1A] shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pengeluaran ({categoriesList?.filter((c) => c.kind === "expense").length || 0})
          </button>
          <button
            onClick={() => setKind("income")}
            className={`px-3.5 py-1.5 rounded-sm font-semibold transition-all ${
              kind === "income"
                ? "bg-[#059669] text-white shadow-sm font-bold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pemasukan ({categoriesList?.filter((c) => c.kind === "income").length || 0})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <div className="absolute left-3 top-2.5 text-muted-foreground">
            <GeometricIcon name="search" className="h-3.5 w-3.5" />
          </div>
          <Input
            type="text"
            placeholder="Cari kategori atau subkategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs rounded-md"
          />
        </div>
      </div>

      {/* Form Add Category */}
      {isAdding && (
        <Card className="p-4 sm:p-5 bg-card border border-[#059669]/30 rounded-md shadow-level-2 animate-in fade-in">
          <h2 className="text-sm font-bold text-foreground mb-3">Buat Kategori Baru</h2>
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 items-end text-xs">
            <div className="flex-1 w-full">
              <label className="font-semibold text-foreground mb-1 block">Nama Kategori</label>
              <Input
                type="text"
                placeholder="Contoh: Belanja Bulanan, Transportasi, Gaji Pokok"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9 rounded-md"
                autoFocus
                required
              />
            </div>

            <div className="w-full sm:w-60">
              <label className="font-semibold text-foreground mb-1 block">Grup Induk (Opsional)</label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-border bg-card pl-3 pr-8 py-1.5 text-xs font-medium text-foreground shadow-2xs transition-all hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Kategori Utama (Level 1)</option>
                {parentGroups.map((g) => (
                  <option key={g.parent.id} value={g.parent.id}>
                    {g.parent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="submit" size="sm" className="bg-[#059669] hover:bg-[#047857] text-white h-9 px-4 rounded-md font-semibold shadow-level-1">
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="h-9 rounded-md"
              >
                Batal
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Hierarchical Group Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {parentGroups.map(({ parent, subcategories }) => (
          <Card
            key={parent.id}
            className="overflow-hidden rounded-md border border-border/80 bg-card hover:border-[#059669]/40 transition-all shadow-level-1"
          >
            <CardHeader className="py-2.5 px-3.5 sm:px-4 bg-slate-50/50 dark:bg-slate-900/50 border-b border-border/60 flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-sm text-xs font-bold ${
                    kind === "expense"
                      ? "bg-[#BA1A1A]/10 text-[#BA1A1A]"
                      : "bg-[#A7F3D0]/40 text-[#064E3B]"
                  }`}
                >
                  <CategoryIcon icon={parent.icon} name={parent.name} className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    {parent.name}
                  </CardTitle>
                  <span className="text-[10px] text-muted-foreground">
                    {subcategories.length > 0
                      ? `${subcategories.length} subkategori`
                      : `Kategori ${kind === "expense" ? "Pengeluaran" : "Pemasukan"}`}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setSelectedParentId(parent.id);
                    setIsAdding(true);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-[#059669] rounded-sm transition-colors"
                  title="Tambah subkategori di sini"
                >
                  <GeometricIcon name="plus" className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={async () => {
                    const ok = await confirm({
                      title: `Hapus Kategori "${parent.name}"?`,
                      description: `Kategori "${parent.name}" dan semua subkategori di dalamnya akan dihapus. Tindakan ini tidak dapat dibatalkan.`,
                      confirmText: "Hapus Kategori",
                      variant: "destructive",
                      icon: "trash",
                    });
                    if (ok) {
                      deleteMutation.mutate({ id: parent.id });
                    }
                  }}
                  className="p-1.5 text-muted-foreground hover:text-[#BA1A1A] rounded-sm transition-colors"
                  title="Hapus grup kategori"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-3 sm:p-3.5">
              {subcategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {subcategories.map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-sm bg-slate-100/70 dark:bg-slate-800/70 border border-border/50 text-xs text-foreground transition-all hover:bg-slate-200/60 dark:hover:bg-slate-800"
                    >
                      <CategoryIcon icon={sub.icon} name={sub.name} className="h-3 w-3 text-muted-foreground" />
                      <span>{sub.name}</span>
                      <button
                        onClick={async () => {
                          const ok = await confirm({
                            title: `Hapus Subkategori "${sub.name}"?`,
                            description: `Subkategori "${sub.name}" akan dihapus dari kategori "${parent.name}".`,
                            confirmText: "Hapus Subkategori",
                            variant: "destructive",
                            icon: "trash",
                          });
                          if (ok) {
                            deleteMutation.mutate({ id: sub.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-[#BA1A1A] transition-opacity"
                        title="Hapus"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                  <Badge variant="outline" className="text-[10px] font-normal px-2 py-0.5 border-dashed">
                    Kategori Utama
                  </Badge>
                  <span className="text-[11px] text-muted-foreground/80">Aktif & terhubung dengan buku kas</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        {parentGroups.length === 0 && (
          <div className="col-span-full p-8 sm:p-12 text-center text-xs text-muted-foreground border rounded-md border-dashed border-border/80 bg-card/40">
            {isLoading
              ? "Memuat daftar kategori..."
              : `Tidak ada kategori ${kind} yang sesuai dengan filter pencarian.`}
          </div>
        )}
      </div>
    </div>
  );
}

