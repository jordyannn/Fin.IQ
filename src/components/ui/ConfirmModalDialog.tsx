"use client";

import React, { useEffect } from "react";
import { useConfirmStore } from "@/store/confirm.store";
import { Button } from "./button";
import {
  Trash2,
  AlertTriangle,
  LogOut,
  Unlink,
  HelpCircle,
  Info,
  CheckCircle2,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfirmModalDialog() {
  const { isOpen, options, handleConfirm, handleCancel } = useConfirmStore();

  // Keyboard shortcut listener (ESC to cancel)
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        handleCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, handleCancel]);

  if (!isOpen) return null;

  const renderIcon = () => {
    switch (options.icon) {
      case "trash":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Trash2 className="h-5 w-5" />
          </div>
        );
      case "logout":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <LogOut className="h-5 w-5" />
          </div>
        );
      case "unlink":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Unlink className="h-5 w-5" />
          </div>
        );
      case "help":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <HelpCircle className="h-5 w-5" />
          </div>
        );
      case "success":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        );
      case "info":
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
            <Info className="h-5 w-5" />
          </div>
        );
      case "alert":
      default:
        return (
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <AlertTriangle className="h-5 w-5" />
          </div>
        );
    }
  };

  const showCancel = options.cancelText !== null && options.cancelText !== undefined && options.cancelText !== "";

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={handleCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-md bg-card border border-border/80 p-4 sm:p-5 shadow-2xl animate-in zoom-in-95 duration-150 text-card-foreground flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={handleCancel}
          className="absolute right-3.5 top-3.5 rounded-sm p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Content Header */}
        <div className="flex items-start gap-3.5 pr-6">
          {renderIcon()}
          <div className="flex flex-col gap-1 min-w-0">
            <h3 className="text-base font-bold text-foreground leading-snug">
              {options.title}
            </h3>
            {options.description && (
              <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {options.description}
              </p>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-border/60 mt-1">
          {showCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              className="h-8 sm:h-9 px-3.5 rounded-md text-xs font-semibold text-muted-foreground hover:text-foreground border-border/80"
            >
              {options.cancelText || "Batal"}
            </Button>
          )}

          <Button
            type="button"
            onClick={handleConfirm}
            className={cn(
              "h-8 sm:h-9 px-4 rounded-md text-xs font-bold text-white shadow-sm transition-all",
              options.variant === "destructive" &&
                "bg-rose-600 hover:bg-rose-700 shadow-rose-500/20",
              options.variant === "warning" &&
                "bg-amber-600 hover:bg-amber-700 shadow-amber-500/20",
              options.variant === "info" &&
                "bg-sky-600 hover:bg-sky-700 shadow-sky-500/20",
              (options.variant === "default" || !options.variant) &&
                "bg-[#059669] hover:bg-[#047857] shadow-[#059669]/20"
            )}
          >
            {options.confirmText || (showCancel ? "Ya, Lanjutkan" : "Tutup")}
          </Button>
        </div>
      </div>
    </div>
  );
}
