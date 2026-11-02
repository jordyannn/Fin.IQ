"use client";

import React, { useEffect } from "react";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";

interface VoiceMicButtonProps {
  onResult: (transcript: string, audioBase64?: string, mimeType?: string) => void;
  size?: "xs" | "sm" | "md";
  className?: string;
  title?: string;
}

/**
 * Tombol mic reusable untuk voice input per-field.
 * Menampilkan ikon mic dengan animasi pulse saat mendengarkan.
 */
export function VoiceMicButton({
  onResult,
  size = "xs",
  className,
  title,
}: VoiceMicButtonProps) {
  const { locale } = useTranslation();
  const isEn = locale === "en";
  const defaultTitle = isEn ? "Voice Input" : "Input suara";
  const effectiveTitle = title || defaultTitle;
  const { isListening, isProcessing, error, startListening, stopListening } = useVoiceInput(onResult);

  useEffect(() => {
    if (error) {
      console.warn("[VoiceMicButton]", error);
    }
  }, [error]);

  const sizeClasses =
    size === "xs"
      ? "h-6 w-6 rounded-md"
      : size === "sm"
      ? "h-7 w-7 rounded-lg"
      : "h-8 w-8 rounded-lg";

  const iconSize =
    size === "xs"
      ? "h-3 w-3"
      : size === "sm"
      ? "h-3.5 w-3.5"
      : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={isListening ? stopListening : startListening}
      disabled={isProcessing}
      title={
        error
          ? (isEn ? `Failed: ${error}` : `Gagal: ${error}`)
          : isListening
          ? (isEn ? "Listening... Click to stop" : "Sedang mendengarkan... Klik untuk berhenti")
          : isProcessing
          ? (isEn ? "Processing audio..." : "Sedang memproses suara...")
          : effectiveTitle
      }
      className={cn(
        "inline-flex items-center justify-center border transition-all shrink-0 cursor-pointer active:scale-95 shadow-2xs",
        isListening
          ? "bg-rose-600 border-rose-600 text-white animate-pulse"
          : isProcessing
          ? "bg-primary/20 border-primary text-primary animate-pulse cursor-wait"
          : error
          ? "bg-rose-50 border-rose-300 text-rose-500 dark:bg-rose-950/30 dark:border-rose-800"
          : "bg-background/80 border-input/70 text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5",
        sizeClasses,
        className
      )}
    >
      {isProcessing ? (
        <Loader2 className={cn(iconSize, "animate-spin text-primary")} />
      ) : isListening ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
    </button>
  );
}
