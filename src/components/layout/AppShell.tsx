"use client";

import React from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { MobileBottomNav } from "./MobileBottomNav";
import { QuickAddModal } from "@/components/transactions/QuickAddModal";
import { CommandPalette } from "@/components/cmdk/CommandPalette";
import { useUIStore } from "@/store/ui.store";
import { X } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { isSidebarOpen, setSidebarOpen } = useUIStore();

  return (
    <div className="flex min-h-screen bg-background text-foreground antialiased selection:bg-primary/20 selection:text-primary">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Mobile Drawer Sidebar */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          />
          <div className="relative z-10 flex w-72 flex-col bg-card p-4 shadow-2xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <span className="font-extrabold text-base tracking-tight text-foreground">Fin.IQ</span>
                <p className="text-[10px] text-muted-foreground">Navigasi Seluler</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted"
                aria-label="Tutup Menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mt-3 flex-1 overflow-y-auto">
              <Sidebar isMobile onItemClick={() => setSidebarOpen(false)} />
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-3.5 sm:p-5 md:p-8 pb-24 lg:pb-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>

      {/* Mobile Bottom Navigation for Smartphones */}
      <MobileBottomNav />

      {/* Global Interactive Overlays */}
      <QuickAddModal />
      <CommandPalette />
    </div>
  );
}
