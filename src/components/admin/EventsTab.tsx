"use client";

import React, { useState } from "react";
import {
  Activity,
  Filter,
  Eye,
  LogIn,
  AlertTriangle,
  UserPlus,
  MousePointer,
  ChevronDown,
  ChevronUp,
  Clock,
  Globe,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface EventItem {
  id: number;
  userId: string | null;
  userEmail: string;
  sessionId: string | null;
  eventType: string;
  eventName: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string;
  createdAt: Date | string;
}

interface EventsTabProps {
  events?: EventItem[];
  isLoading: boolean;
  filterType: string;
  setFilterType: (type: string) => void;
  limit: number;
  setLimit: (l: number) => void;
}

export function EventsTab({
  events = [],
  isLoading,
  filterType,
  setFilterType,
  limit,
  setLimit,
}: EventsTabProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const getBadgeForType = (type: string) => {
    switch (type) {
      case "page_view":
        return {
          label: "Page View",
          class: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30",
          icon: Eye,
        };
      case "login":
        return {
          label: "Login Sukses",
          class: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30",
          icon: LogIn,
        };
      case "login_failed":
        return {
          label: "Login Gagal",
          class: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30",
          icon: AlertTriangle,
        };
      case "register":
        return {
          label: "Registrasi",
          class: "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/30",
          icon: UserPlus,
        };
      case "click":
        return {
          label: "Klik",
          class: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30",
          icon: MousePointer,
        };
      case "feature_use":
        return {
          label: "Fitur",
          class: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/30",
          icon: Activity,
        };
      default:
        return {
          label: type,
          class: "bg-slate-100 dark:bg-slate-800 text-muted-foreground border-border/50",
          icon: Activity,
        };
    }
  };

  const formatDate = (val: Date | string) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return "-";
    return d.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      day: "numeric",
      month: "short",
    });
  };

  const filterOptions = [
    { id: "all", label: "Semua Event" },
    { id: "page_view", label: "Page Views" },
    { id: "login", label: "Login" },
    { id: "login_failed", label: "Login Gagal" },
    { id: "register", label: "Registrasi" },
    { id: "click", label: "Clicks" },
    { id: "feature_use", label: "Fitur" },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* Controls Bar */}
      <Card className="p-4 border-border/80 bg-card">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <span className="text-muted-foreground mr-1 text-[11px] font-medium uppercase tracking-wider flex items-center gap-1">
              <Filter className="h-3 w-3" />
              Filter:
            </span>
            {filterOptions.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setFilterType(opt.id)}
                className={`px-2.5 py-1 rounded-md transition-all text-xs font-medium ${
                  filterType === opt.id
                    ? "bg-emerald-600 text-white font-semibold shadow-xs"
                    : "bg-muted/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground self-end sm:self-auto">
            <span>Tampilkan:</span>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="bg-muted/70 border border-border/80 rounded-md px-2 py-1 text-xs text-foreground font-medium"
            >
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
              <option value={100}>100 baris</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Events Stream List */}
      <Card className="border-border/80 bg-card overflow-hidden">
        {events.length > 0 ? (
          <div className="divide-y divide-border/50 text-xs">
            {events.map((evt) => {
              const badge = getBadgeForType(evt.eventType);
              const BadgeIcon = badge.icon;
              const isExpanded = expandedId === evt.id;

              return (
                <div key={evt.id} className="p-3.5 hover:bg-muted/20 transition-colors">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    {/* Left: Badge + Event Name + User */}
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border shrink-0 ${badge.class}`}
                      >
                        <BadgeIcon className="h-3 w-3" />
                        {badge.label}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-foreground font-mono text-xs">
                          {evt.eventName}
                        </span>
                        <span className="mx-1.5 text-muted-foreground hidden sm:inline">•</span>
                        <span className="text-[11px] text-muted-foreground truncate">
                          {evt.userEmail}
                        </span>
                      </div>
                    </div>

                    {/* Right: IP + Time + Details Toggle */}
                    <div className="flex items-center gap-3 shrink-0 text-muted-foreground text-[11px]">
                      <span className="font-mono text-[10px] hidden md:inline">
                        {evt.ipAddress}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(evt.createdAt)}
                      </span>
                      {evt.metadata && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : evt.id)}
                          className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-0.5 ml-1"
                        >
                          {isExpanded ? (
                            <>
                              Tutup <ChevronUp className="h-3 w-3" />
                            </>
                          ) : (
                            <>
                              Payload <ChevronDown className="h-3 w-3" />
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Expanded Payload Inspector */}
                  {isExpanded && evt.metadata && (
                    <div className="mt-2.5 p-2.5 bg-slate-900 text-slate-100 rounded-md font-mono text-[11px] overflow-x-auto border border-border/50">
                      <pre>{JSON.stringify(evt.metadata, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center text-xs text-muted-foreground">
            {isLoading ? "Memuat riwayat event..." : "Tidak ada event yang sesuai dengan filter."}
          </div>
        )}
      </Card>
    </div>
  );
}

