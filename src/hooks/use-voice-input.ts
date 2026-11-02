"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { deduplicateTranscript } from "@/lib/nlp-parser";

export { deduplicateTranscript };

/**
 * Parse angka dari teks bahasa Indonesia, termasuk angka lisan formal dan slang sehari-hari.
 * Contoh:
 * - "lima puluh ribu" → 50000
 * - "seratus dua puluh ribu" → 120000
 * - "2,5 juta" → 2500000
 * - "50rb" / "50k" → 50000
 * - "goceng" → 5000, "ceban" → 10000, "goban" → 50000, "cepek" → 100000
 */
export function parseSpokenNumber(text: string): number | null {
  if (!text) return null;
  const cleanText = deduplicateTranscript(text);
  const lower = cleanText.toLowerCase().trim();

  // 1. Indonesian slang currency terms
  const slangMap: Record<string, number> = {
    goceng: 5_000,
    seceng: 1_000,
    noceng: 2_000,
    ceban: 10_000,
    goban: 50_000,
    cepek: 100_000,
    gocap: 50_000,
    pekgo: 150_000,
  };

  for (const [slang, val] of Object.entries(slangMap)) {
    if (new RegExp(`\\b${slang}\\b`, "i").test(lower)) {
      return val;
    }
  }

  // 2. Explicit regex shortcuts: "2.5jt", "2,5 juta", "50rb", "50 ribu", "50k"
  const jtMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(?:jt|juta|m|million)\b/i);
  if (jtMatch) {
    return Math.round(parseFloat(jtMatch[1].replace(",", ".")) * 1_000_000);
  }

  const rbMatch = lower.match(/(\d+(?:[\.,]\d+)?)\s*(?:rb|ribu|k)\b/i);
  if (rbMatch) {
    return Math.round(parseFloat(rbMatch[1].replace(",", ".")) * 1_000);
  }

  // 3. Pure digits or formatted digits e.g. "Rp 50.000", "50000", "25,000"
  const hasDigits = /\d/.test(lower);
  const hasMultipliers = /(?:ribu|rb|k|juta|jt|ratus|puluh)/.test(lower);
  if (hasDigits && !hasMultipliers) {
    const cleanDigits = lower.replace(/[^\d]/g, "");
    if (cleanDigits) {
      const parsed = parseInt(cleanDigits, 10);
      if (!isNaN(parsed) && parsed > 0) return parsed;
    }
  }

  // 4. Word-based parsing: e.g. "seratus lima puluh ribu", "dua puluh lima ribu"
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
  processDelayMs?: number; // Waktu pemrosesan halus sebelum mengeksekusi hasil (default: 400ms)
  continuous?: boolean;    // Mode continuous listening (default: false untuk dictation transaksi cepat & anti-redundansi)
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = (reader.result as string) || "";
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
  const processDelayMs = options?.processDelayMs ?? 400;

  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recognitionRef = useRef<any>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const finalTranscriptRef = useRef<string>("");
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  // MediaRecorder audio capture refs (fallback untuk browser tanpa Web Speech API)
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
  const isFinishingRef = useRef(false);

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
    if (isFinishingRef.current) return;
    isFinishingRef.current = true;
    clearSilenceTimer();

    const rawText = finalTranscriptRef.current.trim();
    const textToProcess = deduplicateTranscript(rawText);
    finalTranscriptRef.current = textToProcess;
    setTranscript(textToProcess);

    setIsListening(false);
    isListeningRef.current = false;

    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }

    // Hentikan rekaman audio jika fallback MediaRecorder aktif
    const { audioBase64, mimeType } = await stopMediaStreamAndRecorder();

    if (textToProcess || audioBase64) {
      setIsProcessing(true);
      isProcessingRef.current = true;
      setTimeout(() => {
        setIsProcessing(false);
        isProcessingRef.current = false;
        isFinishingRef.current = false;
        if (onResultRef.current) {
          onResultRef.current(textToProcess, audioBase64, mimeType);
        }
      }, processDelayRef.current);
    } else {
      setIsProcessing(false);
      isProcessingRef.current = false;
      isFinishingRef.current = false;
    }
  }, [stopMediaStreamAndRecorder]);

  const handleFinishSpeechRef = useRef(handleFinishSpeech);
  handleFinishSpeechRef.current = handleFinishSpeech;

  // Cleanup saat unmount
  useEffect(() => {
    return () => {
      clearSilenceTimer();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
        recognitionRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  // Memulai perekaman audio fallback via MediaRecorder (misal: Firefox atau tanpa Web Speech API)
  const startMediaRecorderFallback = useCallback(async () => {
    try {
      if (typeof window === "undefined" || !navigator?.mediaDevices?.getUserMedia) {
        setError("Browser tidak mendukung perekaman mikrofon.");
        setIsListening(false);
        isListeningRef.current = false;
        return;
      }

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
        }
      }
      recordedMimeTypeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start(250);

      setIsListening(true);
      isListeningRef.current = true;
      setError(null);
    } catch (micErr: any) {
      console.warn("getUserMedia error:", micErr);
      setIsListening(false);
      isListeningRef.current = false;
      setError("Izin mikrofon ditolak atau tidak tersedia. Silakan izinkan akses mikrofon di browser Anda.");
    }
  }, []);

  const startListening = useCallback(async () => {
    setError(null);
    clearSilenceTimer();
    finalTranscriptRef.current = "";
    setTranscript("");
    setIsProcessing(false);
    isProcessingRef.current = false;
    isFinishingRef.current = false;
    audioChunksRef.current = [];

    // Hentikan sesi lama jika masih menggantung
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    const SpeechRecognition =
      typeof window !== "undefined"
        ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
        : null;

    // 1. Jika browser mendukung Web Speech API (Google Chrome, Edge, Chromium)
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        const isContinuous = options?.continuous ?? false;
        recognition.continuous = isContinuous;
        recognition.interimResults = true;
        recognition.lang = "id-ID";
        recognition.maxAlternatives = 1;

        let finalTrans = "";
        let lastFinalPiece = "";

        recognition.onstart = () => {
          setIsListening(true);
          isListeningRef.current = true;
          isFinishingRef.current = false;
          setError(null);
        };

        recognition.onresult = (event: any) => {
          let interimTrans = "";
          let newlyFinalized = "";

          for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const transcriptPiece = (result[0]?.transcript || "").trim();
            if (!transcriptPiece) continue;

            if (result.isFinal) {
              const lowerPiece = transcriptPiece.toLowerCase();
              // Hindari bug Chromium Android yang mengulang segmen final identik secara beruntun
              if (lowerPiece !== lastFinalPiece.toLowerCase()) {
                newlyFinalized += (newlyFinalized ? " " : "") + transcriptPiece;
                lastFinalPiece = transcriptPiece;
              }
            } else {
              interimTrans += (interimTrans ? " " : "") + transcriptPiece;
            }
          }

          if (newlyFinalized) {
            finalTrans = finalTrans ? `${finalTrans} ${newlyFinalized}` : newlyFinalized;
          }

          const rawCombined = finalTrans
            ? interimTrans
              ? `${finalTrans} ${interimTrans}`
              : finalTrans
            : interimTrans;

          // Bersihkan pengulangan kata/frasa redundan seketika secara real-time
          const cleanText = deduplicateTranscript(rawCombined);

          // Cek apakah transkrip ada perubahan substantif
          const hasChanged = cleanText !== finalTranscriptRef.current;
          finalTranscriptRef.current = cleanText;
          setTranscript(cleanText);

          // Reset jeda timer hening hanya jika ada konten baru
          if (hasChanged) {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              handleFinishSpeechRef.current();
            }, silenceDelayRef.current);
          }
        };

        recognition.onspeechend = () => {
          // Ketika user selesai berbicara, jika bukan mode continuous, jadwalkan stop cepat
          if (!isContinuous) {
            clearSilenceTimer();
            silenceTimerRef.current = setTimeout(() => {
              handleFinishSpeechRef.current();
            }, 600);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("SpeechRecognition event:", event.error);
          if (event.error === "no-speech") {
            // Jangan matikan instan jika user hanya jeda sejenak
            return;
          }

          if (event.error === "not-allowed") {
            setError("Izin mikrofon ditolak oleh browser. Silakan aktifkan izin mikrofon.");
            clearSilenceTimer();
            setIsListening(false);
            isListeningRef.current = false;
            return;
          }

          if (event.error === "network") {
            setError("Layanan suara Google tidak dapat terhubung.");
          } else if (event.error !== "aborted") {
            setError(`Pengenalan suara: ${event.error}`);
          }

          // Jika ada hasil parsial yang sudah tertangkap, proses hasilnya
          if (finalTranscriptRef.current.trim()) {
            handleFinishSpeechRef.current();
          } else {
            setIsListening(false);
            isListeningRef.current = false;
          }
        };

        recognition.onend = () => {
          clearSilenceTimer();
          if (isListeningRef.current && !isFinishingRef.current) {
            if (finalTranscriptRef.current.trim()) {
              handleFinishSpeechRef.current();
            } else {
              setIsListening(false);
              isListeningRef.current = false;
            }
          }
        };

        recognitionRef.current = recognition;
        recognition.start();
        setIsListening(true);
        isListeningRef.current = true;
        return;
      } catch (recErr: any) {
        console.warn("SpeechRecognition start gagal, mencoba fallback MediaRecorder:", recErr);
        // Fallback ke MediaRecorder jika Web Speech API gagal start
        await startMediaRecorderFallback();
        return;
      }
    }

    // 2. Jika Web Speech API tidak didukung, gunakan perekam audio MediaRecorder
    await startMediaRecorderFallback();
  }, [startMediaRecorderFallback]);

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
