import React from "react";
import { AppShell } from "@/components/layout/AppShell";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <AnalyticsProvider />
      {children}
    </AppShell>
  );
}
