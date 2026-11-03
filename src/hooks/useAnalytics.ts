"use client";

import { useEffect, useRef, useCallback } from "react";
import { usePathname } from "next/navigation";

const SESSION_KEY = "finiq_analytics_sid";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let sid = sessionStorage.getItem(SESSION_KEY);
    if (!sid) {
      sid = crypto.randomUUID ? crypto.randomUUID() : `sid_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      sessionStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  } catch {
    return "";
  }
}

interface AnalyticsEvent {
  eventType: string;
  eventName: string;
  metadata?: Record<string, unknown>;
  sessionId?: string;
}

// Global buffer for batching events
let eventBuffer: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flushEvents() {
  if (eventBuffer.length === 0) return;
  const batch = [...eventBuffer];
  eventBuffer = [];

  try {
    const payload = JSON.stringify(batch);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/analytics/track", blob);
      if (!sent) {
        await fetch("/api/analytics/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true,
        });
      }
    } else {
      await fetch("/api/analytics/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      });
    }
  } catch {
    // Analytics failures must never interrupt the application UX
  }
}

function queueEvent(event: AnalyticsEvent) {
  eventBuffer.push(event);
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(flushEvents, 2500); // Flush every 2.5 seconds
}

if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flushEvents();
    }
  });
  window.addEventListener("beforeunload", () => {
    flushEvents();
  });
}

export function useAnalytics() {
  const pathname = usePathname();
  const lastPath = useRef<string>("");

  // Automatically track page views on route changes
  useEffect(() => {
    if (pathname && pathname !== lastPath.current) {
      lastPath.current = pathname;
      queueEvent({
        eventType: "page_view",
        eventName: pathname,
        sessionId: getSessionId(),
      });
    }
  }, [pathname]);

  const trackClick = useCallback((elementName: string, meta?: Record<string, unknown>) => {
    queueEvent({
      eventType: "click",
      eventName: elementName,
      metadata: meta,
      sessionId: getSessionId(),
    });
  }, []);

  const trackFeature = useCallback((featureName: string, meta?: Record<string, unknown>) => {
    queueEvent({
      eventType: "feature_use",
      eventName: featureName,
      metadata: meta,
      sessionId: getSessionId(),
    });
  }, []);

  const trackEvent = useCallback((type: string, name: string, meta?: Record<string, unknown>) => {
    queueEvent({
      eventType: type,
      eventName: name,
      metadata: meta,
      sessionId: getSessionId(),
    });
  }, []);

  return { trackClick, trackFeature, trackEvent };
}

