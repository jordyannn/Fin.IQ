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

export interface UseVoiceInputOptions {
  silenceDelayMs?: number; // Waktu jeda hening sebelum otomatis selesai bicara (default: 2000ms)
  processDelayMs?: number; // Waktu pemrosesan halus sebelum mengeksekusi hasil (default: 500ms)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function useVoiceInput(
  onResult?: (transcript: string, audioBase64?: string, mimeType?: string) => void,
  options?: UseVoiceInputOptions
) {
  const silenceDelayMs = options?.silenceDelayMs ?? 2000;
  const processDelayMs = options?.processDelayMs ?? 500;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // MediaRecorder audio capture refs
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordedMimeTypeRef = useRef<string>("audio/webm");

  const silenceDelayRef = useRef(silenceDelayMs);
  silenceDelayRef.current = silenceDelayMs;

  const processDelayRef = useRef(processDelayMs);
  processDelayRef.current = processDelayMs;

  const isProcessingRef = useRef(false);
  const isListeningRef = useRef(false);

  const clearSilenceTimer = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  };

  const stopMediaStreamAndRecorder = useCallback(async (): Promise<{ audioBase64: string; mimeType: string }> => {
    let audioBase64 = "";
    const mimeType = recordedMimeTypeRef.current || "audio/webm";

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try {
        await new Promise<void>((resolve) => {
          if (!mediaRecorderRef.current || mediaRecorderRef.current.state === "inactive") {
            return resolve();
          }
          mediaRecorderRef.current.onstop = () => resolve();
          mediaRecorderRef.current.stop();
        });
      } catch (err) {
        console.warn("Gagal menghentikan MediaRecorder:", err);
      }
    }

    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      } catch {}
    }

    if (audioChunksRef.current.length > 0) {
      try {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        if (audioBlob.size > 200) {
          audioBase64 = await blobToBase64(audioBlob);
        }
      } catch (err) {
        console.warn("Gagal konversi blob audio ke base64:", err);
      }
      audioChunksRef.current = [];
    }

    return { audioBase64, mimeType };
  }, []);

  const handleFinishSpeech = useCallback(async () => {
    clearSilenceTimer();
    const textToProcess = finalTranscriptRef.current.trim();

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
    }

    setIsListening(false);
    isListeningRef.current = false;

    // Ambil rekaman audio Base64 untuk keperluan Gemini Native Audio fallback
    const { audioBase64, mimeType } = await stopMediaStreamAndRecorder();

    if (textToProcess || audioBase64) {
      setIsProcessing(true);
      isProcessingRef.current = true;
      setTimeout(() => {
        setIsProcessing(false);
        isProcessingRef.current = false;
        if (onResultRef.current) {
          onResultRef.current(textToProcess, audioBase64, mimeType);
        }
      }, processDelayRef.current);
    } else {
      setIsProcessing(false);
      isProcessingRef.current = false;
    }
  }, [stopMediaStreamAndRecorder]);

  const handleFinishSpeechRef = useRef(handleFinishSpeech);
  handleFinishSpeechRef.current = handleFinishSpeech;

  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "id-ID";

        recognition.onresult = (event: any) => {
          let fullText = "";
          for (let i = 0; i < event.results.length; i++) {
            fullText += event.results[i][0].transcript + " ";
          }
          const cleanText = fullText.trim();
          finalTranscriptRef.current = cleanText;
          setTranscript(cleanText);

          // Reset silence timer setiap kata baru terdeteksi
          clearSilenceTimer();
          silenceTimerRef.current = setTimeout(() => {
            handleFinishSpeechRef.current();
          }, silenceDelayRef.current);
        };

        recognition.onerror = (event: any) => {
          if (event.error !== "no-speech") {
            clearSilenceTimer();
            setError(event.error);
            setIsListening(false);
            isListeningRef.current = false;
            setIsProcessing(false);
            isProcessingRef.current = false;
          }
        };

        recognition.onend = () => {
          clearSilenceTimer();
          if (isListeningRef.current && finalTranscriptRef.current.trim() && !isProcessingRef.current) {
            handleFinishSpeechRef.current();
          } else {
            setIsListening(false);
            isListeningRef.current = false;
          }
        };

        recognitionRef.current = recognition;
      }
    }

    return () => {
      clearSilenceTimer();
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    clearSilenceTimer();
    finalTranscriptRef.current = "";
    setTranscript("");
    setIsProcessing(false);
    isProcessingRef.current = false;
    audioChunksRef.current = [];

    const hasSpeech = Boolean(recognitionRef.current);
    const hasMedia = typeof window !== "undefined" && Boolean(navigator?.mediaDevices?.getUserMedia);

    if (!hasSpeech && !hasMedia) {
      setError("Browser tidak mendukung input suara.");
      return;
    }

    setIsListening(true);
    isListeningRef.current = true;

    // 1. Rekam audio via MediaRecorder secara paralel untuk input native Gemini
    if (hasMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;

        let mimeType = "audio/webm";
        if (typeof MediaRecorder !== "undefined") {
          if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
            mimeType = "audio/webm;codecs=opus";
          } else if (MediaRecorder.isTypeSupported("audio/webm")) {
            mimeType = "audio/webm";
          } else if (MediaRecorder.isTypeSupported("audio/mp4")) {
            mimeType = "audio/mp4";
          } else if (MediaRecorder.isTypeSupported("audio/ogg")) {
            mimeType = "audio/ogg";
          }
        }
        recordedMimeTypeRef.current = mimeType;

        const recorder = new MediaRecorder(stream, { mimeType });
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        mediaRecorderRef.current = recorder;
        recorder.start(200);
      } catch (micErr: any) {
        console.warn("getUserMedia error:", micErr);
        if (!hasSpeech) {
          setIsListening(false);
          isListeningRef.current = false;
          setError("Izin mikrofon ditolak atau tidak tersedia.");
          return;
        }
      }
    }

    // 2. Start SpeechRecognition lokal untuk kecepatan respons 0 ms
    if (recognitionRef.current) {
      try {
        recognitionRef.current.start();
      } catch (e) {
        // Abaikan jika sudah berjalan
      }
    }
  }, []);

  const stopListening = useCallback(() => {
    handleFinishSpeech();
  }, [handleFinishSpeech]);

  return {
    isListening,
    isProcessing,
    transcript,
    error,
    startListening,
    stopListening,
  };
}

