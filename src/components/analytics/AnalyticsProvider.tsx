"use client";

import { useAnalytics } from "@/hooks/useAnalytics";

export function AnalyticsProvider() {
  useAnalytics();
  return null;
}

