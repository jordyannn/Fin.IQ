import React from "react";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "default" | "success" | "warning" | "danger" | "info";
  trend?: {
    value: string;
    positive?: boolean;
  };
}

export function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  badge,
  badgeVariant = "default",
  trend,
}: StatCardProps) {
  const getBadgeClass = () => {
    switch (badgeVariant) {
      case "success":
        return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30";
      case "warning":
        return "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30";
      case "danger":
        return "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30";
      case "info":
        return "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30";
      default:
        return "bg-slate-100 dark:bg-slate-800 text-muted-foreground border-border/50";
    }
  };

  return (
    <Card className="p-4 sm:p-5 bg-card/90 border-border/70 shadow-xs hover:shadow-sm transition-all duration-200">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {title}
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {typeof value === "number" ? value.toLocaleString("id-ID") : value}
            </span>
            {badge && (
              <span
                className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${getBadgeClass()}`}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 mt-0.5">
              {trend && (
                <span
                  className={`font-semibold ${
                    trend.positive ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"
                  }`}
                >
                  {trend.value}
                </span>
              )}
              {subtitle}
            </p>
          )}
        </div>
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/80 text-muted-foreground border border-border/50 shrink-0">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Card>
  );
}

