"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Parse angka dari teks bahasa Indonesia.
 * Contoh: "lima puluh ribu" → 50000, "seratus dua puluh" → 120, "2,5 juta" → 2500000
 */
export function parseSpokenNumber(text: string): number | null {
  if (!text) return null;
  const lower = text.toLowerCase().trim();

  // 1. Explicit regex shortcuts: "2.5jt", "2,5 juta", "50rb", "50 ribu", "50k"
  const jtMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(?:jt|juta|m|million)\b/i);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1].replace(",", ".")) * 1_000_000);
  }

  const rbMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1].replace(",", ".")) * 1_000);
  }

  // 2. Pure digits or formatted digits e.g. "Rp 50.000", "50000"
  // If string contains digits without word multipliers
  const hasDigits = /\d/.test(lower);
  const hasMultipliers = /(?:ribu|rb|k|juta|jt|ratus|puluh)/.test(lower);
  if (hasDigits && !hasMultipliers) {
    const cleanDigits = lower.replace(/[^\d]/g, "");
    if (cleanDigits) {
      const parsed = parseInt(cleanDigits, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 3. Word-based parsing: e.g. "seratus lima puluh ribu", "dua puluh lima ribu"
  const unitMap: Record<string, number> = {
    nol: 0, kosong: 0,
    satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5,
    enam: 6, tujuh: 7, delapan: 8, sembilan: 9,
  };

  const words = lower.split(/[\s\-]+/);
  let total = 0;
  let currentGroup = 0;
  let currentUnit = 0;

  for (const w of words) {
    if (w === "seratus") {
      currentGroup += 100;
      currentUnit = 0;
    } else if (w === "seribu") {
      total += (currentGroup > 0 ? currentGroup : 1) * 1_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (w === "sejuta") {
      total += (currentGroup > 0 ? currentGroup : 1) * 1_000_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (w === "sepuluh") {
      currentGroup += 10;
      currentUnit = 0;
    } else if (w === "sebelas") {
      currentGroup += 11;
      currentUnit = 0;
    } else if (w === "belas") {
      currentGroup += 10 + (currentUnit > 0 ? currentUnit : 0);
      currentUnit = 0;
    } else if (w === "puluh") {
      currentGroup += (currentUnit > 0 ? currentUnit : 1) * 10;
      currentUnit = 0;
    } else if (w === "ratus") {
      currentGroup += (currentUnit > 0 ? currentUnit : 1) * 100;
      currentUnit = 0;
    } else if (w === "ribu") {
      const val = currentGroup + currentUnit;
      total += (val > 0 ? val : 1) * 1_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (w === "juta") {
      const val = currentGroup + currentUnit;
      total += (val > 0 ? val : 1) * 1_000_000;
      currentGroup = 0;
      currentUnit = 0;
    } else if (unitMap[w] !== undefined) {
      currentUnit = unitMap[w];
    } else if (/^\d+$/.test(w)) {
      currentUnit = parseInt(w, 10);
    }
  }

  total += currentGroup + currentUnit;
  return total > 0 ? total : null;
}

export function useVoiceInput(onResult?: (transcript: string) => void) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // Stabilize onResult with useCallback ref pattern
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "id-ID";

        recognition.onresult = (event: any) => {
          const text = event.results[0][0].transcript;
          setTranscript(text);
          setIsListening(false);
          if (onResultRef.current) onResultRef.current(text);
        };

        recognition.onerror = (event: any) => {
          setError(event.error);
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      }
    }
  }, []); // No dependency on onResult — use ref instead

  const startListening = useCallback(() => {
    setError(null);
    if (!recognitionRef.current) {
      setError("Browser tidak mendukung speech recognition.");
      return;
    }
    try {
      setIsListening(true);
      recognitionRef.current.start();
    } catch (e) {
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  }, []);

  return {
    isListening,
    transcript,
    error,
    startListening,
    stopListening,
  };
}
