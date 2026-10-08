"use client";

import React, { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc/client";
import {
  Tags,
  Plus,
  Trash2,
  FolderPlus,
  Search,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  X,
  Tag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function CategoriesPage() {
  const utils = trpc.useUtils();
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const [searchQuery, setSearchQuery] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedParentId, setSelectedParentId] = useState<string>("");

  const { data: categoriesList, isLoading } = trpc.categories.list.useQuery({ kind });

  const createMutation = trpc.categories.create.useMutation({
    onSuccess: () => {
      utils.categories.invalidate();
      setNewName("");
      setSelectedParentId("");
      setIsAdding(false);
    },
  });

  const deleteMutation = trpc.categories.delete.useMutation({
    onSuccess: () => utils.categories.invalidate(),
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

    // Standalone or orphans
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
          <h1 className="text-2xl font-bold tracking-tight">Kategori Transaksi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Kelola {categoriesList?.length || 0} kategori lengkap standar BeeCount-Cloud untuk pelaporan dan budgeting cerdas.
          </p>
        </div>

        <Button
          onClick={() => setIsAdding(!isAdding)}
          className="bg-primary hover:bg-primary/90 text-white gap-2 shadow-sm text-xs"
        >
          <Plus className="h-4 w-4" />
          Tambah Kategori Baru
        </Button>
      </div>

      {/* Switcher & Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex rounded-xl bg-muted/60 p-1 text-xs border w-full sm:w-auto">
          <button
            onClick={() => setKind("expense")}
            className={`px-5 py-1.5 rounded-lg font-semibold transition-all ${
              kind === "expense"
                ? "bg-rose-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pengeluaran ({categoriesList?.filter((c) => c.kind === "expense").length || 0})
          </button>
          <button
            onClick={() => setKind("income")}
            className={`px-5 py-1.5 rounded-lg font-semibold transition-all ${
              kind === "income"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Pemasukan ({categoriesList?.filter((c) => c.kind === "income").length || 0})
          </button>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Cari kategori atau subkategori..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* Modal / Form Add Category */}
      {isAdding && (
        <Card className="p-4 bg-card border border-primary/30 shadow-md animate-in fade-in">
          <form onSubmit={handleCreate} className="flex flex-col sm:flex-row gap-3 items-end text-xs">
            <div className="flex-1 w-full">
              <label className="font-semibold text-foreground mb-1 block">Nama Kategori</label>
              <Input
                type="text"
                placeholder={`Contoh: Kopi Kekinian, Gym, Gaji Pokok...`}
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="h-9"
                autoFocus
                required
              />
            </div>

            <div className="w-full sm:w-60">
              <label className="font-semibold text-foreground mb-1 block">Grup Induk (Opsional)</label>
              <select
                value={selectedParentId}
                onChange={(e) => setSelectedParentId(e.target.value)}
                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-xs focus:outline-none"
              >
                <option value="">-- Kategori Utama (Level 1) --</option>
                {parentGroups.map((g) => (
                  <option key={g.parent.id} value={g.parent.id}>
                    {g.parent.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2 w-full sm:w-auto">
              <Button type="submit" size="sm" className="bg-primary text-white h-9 px-4">
                Simpan
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="h-9"
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
            className="overflow-hidden border hover:border-primary/40 transition-all shadow-sm"
          >
            <CardHeader className="py-3 px-4 bg-muted/20 border-b flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                    kind === "expense"
                      ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                      : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  <Tag className="h-4 w-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-bold text-foreground">
                    {parent.name}
                  </CardTitle>
                  <span className="text-[10px] text-muted-foreground">
                    {subcategories.length} subkategori
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => {
                    setSelectedParentId(parent.id);
                    setIsAdding(true);
                  }}
                  className="p-1.5 text-muted-foreground hover:text-primary rounded-lg transition-colors"
                  title="Tambah subkategori di sini"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Hapus grup kategori '${parent.name}' beserta seluruh subkategorinya?`
                      )
                    ) {
                      deleteMutation.mutate({ id: parent.id });
                    }
                  }}
                  className="p-1.5 text-muted-foreground hover:text-rose-600 rounded-lg transition-colors"
                  title="Hapus grup kategori"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </CardHeader>

            <CardContent className="p-3">
              {subcategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {subcategories.map((sub) => (
                    <div
                      key={sub.id}
                      className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-muted/50 border text-xs text-foreground transition-all hover:bg-muted"
                    >
                      <span>{sub.name}</span>
                      <button
                        onClick={() => {
                          if (confirm(`Hapus subkategori '${sub.name}'?`)) {
                            deleteMutation.mutate({ id: sub.id });
                          }
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-rose-600 transition-opacity"
                        title="Hapus"
                      >
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-muted-foreground italic py-1">
                  Belum ada subkategori khusus dalam grup ini.
                </p>
              )}
            </CardContent>
          </Card>
        ))}

        {parentGroups.length === 0 && (
          <div className="col-span-full p-12 text-center text-xs text-muted-foreground border rounded-2xl border-dashed">
            {isLoading
              ? "Memuat daftar kategori..."
              : `Tidak ada kategori ${kind} yang sesuai dengan pencarian.`}
          </div>
        )}
      </div>
    </div>
  );
}
