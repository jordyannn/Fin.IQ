"use client";

import React from "react";
import { Mic, MicOff } from "lucide-react";
import { useVoiceInput } from "@/hooks/use-voice-input";
import { cn } from "@/lib/utils";

interface VoiceMicButtonProps {
  onResult: (transcript: string) => void;
  size?: "sm" | "md";
  className?: string;
  title?: string;
}

/**
 * Tombol mic reusable untuk voice input per-field.
 * Menampilkan ikon mic dengan animasi pulse saat mendengarkan.
 */
export function VoiceMicButton({
  onResult,
  size = "sm",
  className,
  title = "Input suara",
}: VoiceMicButtonProps) {
  const { isListening, startListening, stopListening, error } = useVoiceInput(onResult);

  const sizeClasses = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <button
      type="button"
      onClick={isListening ? stopListening : startListening}
      title={isListening ? "Berhenti mendengarkan..." : title}
      className={cn(
        "inline-flex items-center justify-center rounded-full border transition-all shadow-sm shrink-0",
        isListening
          ? "bg-rose-600 border-rose-600 text-white animate-pulse"
          : "bg-background border-input text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5",
        sizeClasses,
        className
      )}
    >
      {isListening ? (
        <MicOff className={iconSize} />
      ) : (
        <Mic className={iconSize} />
      )}
    </button>
  );
}
