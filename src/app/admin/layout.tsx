import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin Monitor & Analytics | Fin.IQ",
  description: "Website traffic, user analytics, and platform telemetry monitor for Fin.IQ administrators.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-foreground transition-colors duration-200">
      {children}
    </div>
  );
}

