import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "../trpc";
import { accounts, categories, transactions, ledgers } from "../../db/schema";
import { eq, sql } from "drizzle-orm";
import { GoogleGenAI, Type } from "@google/genai";
import {
  getEffectiveGeminiKey,
  generateWithFallback,
  DEFAULT_GEMINI_MODELS,
  isFatalGeminiError,
} from "../../gemini";
import { cleanNumericAmount } from "@/lib/utils";
import zlib from "zlib";
import * as XLSX from "xlsx";
import {
  generateOpenRouterCompletion,
  getEffectiveOpenRouterKey,
  OPENROUTER_EXTRACTION_MODELS,
  OPENROUTER_VISION_MODELS,
} from "../../openrouter";
import { CANONICAL_CATEGORY_MAP } from "@/lib/nlp-parser";

const DOCUMENT_TX_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    detectedBank: { type: Type.STRING, nullable: true },
    summaryInfo: {
      type: Type.OBJECT,
      nullable: true,
      properties: {
        totalIncome: { type: Type.NUMBER, nullable: true },
        totalExpense: { type: Type.NUMBER, nullable: true },
        initialBalance: { type: Type.NUMBER, nullable: true },
        endingBalance: { type: Type.NUMBER, nullable: true },
      },
    },
    transactions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          txType: {
            type: Type.STRING,
            enum: ["expense", "income", "transfer"],
          },
          amount: { type: Type.NUMBER },
          happenedAt: { type: Type.STRING },
          categoryName: { type: Type.STRING },
          accountName: { type: Type.STRING },
          toAccountName: { type: Type.STRING, nullable: true },
          note: { type: Type.STRING },
        },
        required: ["txType", "amount", "happenedAt", "note"],
      },
    },
  },
  required: ["transactions"],
};

const SCREENSHOT_TX_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      txType: {
        type: Type.STRING,
        enum: ["expense", "income", "transfer"],
      },
      amount: { type: Type.NUMBER },
      happenedAt: { type: Type.STRING },
      categoryName: { type: Type.STRING },
      accountName: { type: Type.STRING },
      toAccountName: { type: Type.STRING, nullable: true },
      note: { type: Type.STRING },
    },
    required: ["txType", "amount", "happenedAt", "note"],
  },
};

function decodePdfHex(hex: string): string {
  const clean = hex.replace(/[\s\r\n]+/g, "");
  let out = "";
  if (clean.length >= 4 && clean.startsWith("00")) {
    for (let i = 0; i + 3 < clean.length; i += 4) {
      const code = parseInt(clean.slice(i, i + 4), 16);
      if (code >= 32 && code <= 126) out += String.fromCharCode(code);
      else if (code === 10 || code === 13) out += " ";
    }
    if (out.trim()) return out;
  }
  for (let i = 0; i + 1 < clean.length; i += 2) {
    const code = parseInt(clean.slice(i, i + 2), 16);
    if ((code >= 32 && code <= 126) || (code >= 160 && code <= 255)) out += String.fromCharCode(code);
    else if (code === 10 || code === 13) out += " ";
  }
  return out;
}

type PdfCMap = {
  codeHexLen: number;
  map: Map<string, string>;
};

function decodeUtf16BeHex(hex: string): string {
  const clean = hex.replace(/\s+/g, "");
  let out = "";
  for (let i = 0; i + 3 < clean.length; i += 4) {
    const code = parseInt(clean.slice(i, i + 4), 16);
    if (!isNaN(code) && code > 0) {
      out += String.fromCharCode(code);
    }
  }
  if (!out && clean.length === 2) {
    const code = parseInt(clean, 16);
    if (!isNaN(code) && code >= 32) out = String.fromCharCode(code);
  }
  return out;
}

function parseToUnicodeCMap(cmapText: string): PdfCMap {
  const map = new Map<string, string>();
  let codeHexLen = 4;

  const csMatch = cmapText.match(
    /begincodespacerange\s*<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/i
  );
  if (csMatch) {
    codeHexLen = csMatch[1].length;
  }

  for (const block of cmapText.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
    for (const p of block[1].matchAll(/<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g)) {
      const src = p[1].toUpperCase();
      codeHexLen = src.length;
      const dst = decodeUtf16BeHex(p[2]);
      if (dst) map.set(src, dst);
    }
  }

  for (const block of cmapText.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
    const rangeRegex =
      /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]+)>|\[([\s\S]*?)\])/g;
    for (const r of block[1].matchAll(rangeRegex)) {
      const startHex = r[1];
      const endHex = r[2];
      codeHexLen = startHex.length;
      const start = parseInt(startHex, 16);
      const end = parseInt(endHex, 16);
      if (isNaN(start) || isNaN(end) || end < start || end - start > 4096) continue;

      if (r[3]) {
        const dstStart = parseInt(r[3], 16);
        if (!isNaN(dstStart)) {
          for (let c = start; c <= end; c++) {
            const key = c.toString(16).toUpperCase().padStart(codeHexLen, "0");
            map.set(key, String.fromCharCode(dstStart + (c - start)));
          }
        }
      } else if (r[4]) {
        const dstItems = [...r[4].matchAll(/<([0-9a-fA-F]+)>/g)].map((m) =>
          decodeUtf16BeHex(m[1])
        );
        for (let i = 0; i <= end - start && i < dstItems.length; i++) {
          const key = (start + i).toString(16).toUpperCase().padStart(codeHexLen, "0");
          if (dstItems[i]) map.set(key, dstItems[i]);
        }
      }
    }
  }

  return { codeHexLen, map };
}

function decompressPdfStream(raw: Buffer): Buffer {
  for (const fn of [zlib.inflateSync, zlib.inflateRawSync]) {
    try {
      return fn(raw);
    } catch {}
    if (raw.length > 2) {
      try {
        return fn(raw.subarray(0, raw.length - 1));
      } catch {}
    }
  }
  return raw;
}

function extractBalancedJsonObjects(text: string): any[] {
  const results: any[] = [];
  let inString = false;
  let escape = false;
  let depth = 0;
  let objStart = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
      continue;
    }
    if (ch === "\"") {
      inString = true;
    } else if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      if (depth > 0) {
        depth--;
        if (depth === 0 && objStart !== -1) {
          const slice = text.slice(objStart, i + 1);
          try {
            const parsed = JSON.parse(slice);
            if (parsed && typeof parsed === "object" && "amount" in parsed) {
              results.push(parsed);
            }
          } catch {}
          objStart = -1;
        }
      }
    }
  }
  return results;
}

export function parseJsonSafe(text: string): any {
  if (!text || !text.trim()) return {};
  const cleaned = text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {}
    }
    // Truncated JSON recovery: extract detectedBank and complete transaction objects
    const bankMatch = cleaned.match(/"detectedBank"\s*:\s*"([^"]+)"/);
    const txArrIdx = cleaned.search(/"transactions"\s*:\s*\[/);
    const sliceForObjs = txArrIdx !== -1 ? cleaned.slice(txArrIdx) : cleaned;
    const recoveredTxs = extractBalancedJsonObjects(sliceForObjs);
    if (recoveredTxs.length > 0) {
      return {
        detectedBank: bankMatch ? bankMatch[1] : null,
        transactions: recoveredTxs,
      };
    }
  }
  return {};
}

export interface DocumentSummaryInfo {
  totalIncome?: number | null;
  totalExpense?: number | null;
  initialBalance?: number | null;
  endingBalance?: number | null;
}

export function extractTransactionsFromAiPayload(rawText: string): {
  detectedBank: string | null;
  summaryInfo: DocumentSummaryInfo | null;
  transactions: any[];
} {
  const parsed = parseJsonSafe(rawText);
  if (!parsed || typeof parsed !== "object") {
    return { detectedBank: null, summaryInfo: null, transactions: [] };
  }

  if (Array.isArray(parsed)) {
    // Handle wrapped array like [{ detectedBank: "BCA", transactions: [...] }]
    const first = parsed[0];
    if (
      first &&
      typeof first === "object" &&
      (Array.isArray(first.transactions) ||
        Array.isArray(first.items) ||
        Array.isArray(first.data) ||
        Array.isArray(first.mutasi))
    ) {
      const merged: any[] = [];
      let bank: string | null = null;
      let summaryInfo: DocumentSummaryInfo | null = null;
      for (const entry of parsed) {
        if (!bank && typeof entry?.detectedBank === "string" && entry.detectedBank.trim()) {
          bank = entry.detectedBank.trim();
        }
        if (!summaryInfo && entry?.summaryInfo && typeof entry.summaryInfo === "object") {
          summaryInfo = entry.summaryInfo;
        }
        const arr =
          entry?.transactions || entry?.items || entry?.data || entry?.mutasi || [];
        if (Array.isArray(arr)) merged.push(...arr);
      }
      return { detectedBank: bank, summaryInfo, transactions: merged };
    }
    return { detectedBank: null, summaryInfo: null, transactions: parsed };
  }

  const detectedBank =
    typeof parsed.detectedBank === "string" && parsed.detectedBank.trim()
      ? parsed.detectedBank.trim()
      : null;
  const summaryInfo =
    parsed.summaryInfo && typeof parsed.summaryInfo === "object"
      ? (parsed.summaryInfo as DocumentSummaryInfo)
      : null;
  const list =
    parsed.transactions ||
    parsed.items ||
    parsed.data ||
    parsed.mutasi ||
    parsed.records ||
    parsed.results ||
    [];
  return {
    detectedBank,
    summaryInfo,
    transactions: Array.isArray(list) ? list : [],
  };
}

const SUMMARY_OR_BALANCE_NOTE_REGEX =
  /^(?:total\s+(?:pemasukan|pengeluaran|income|expense|credit|debit|kredit|debet|mutasi|transaksi|keseluruhan|dana\s+masuk|dana\s+keluar)|saldo\s+(?:awal|akhir|sebelumnya|berjalan|tersedia|mengendap)|(?:initial|opening|beginning|ending|closing|available|remaining|current)\s+balance|sisa\s+saldo|grand\s+total|sub\s*total|ringkasan(?:\s+rekening)?|summary(?:\s+of)?|rekapan\s+mutasi)\b/i;

const BILINGUAL_SUMMARY_REGEX =
  /\b(?:total\s+pemasukan\s*\/\s*total\s+income|total\s+pengeluaran\s*\/\s*total\s+expense|saldo\s+awal\s*\/\s*initial\s+balance|saldo\s+akhir\s*\/\s*ending\s+balance|mutasi\s+kredit|mutasi\s+debet)\b/i;

const GENERIC_SUMMARY_WORD_REGEX =
  /\b(?:total|pemasukan|pengeluaran|income|expense|saldo|balance|awal|akhir|initial|ending|closing|opening|ringkasan|summary|rekap|statement)\b/i;

/**
 * Menyaring baris ringkasan / total / saldo agar tidak masuk sebagai transaksi nyata.
 * Berlaku universal untuk seluruh format mutasi bank dan e-wallet.
 */
export function filterOutSummaryAndBalanceRows<
  T extends { txType: "expense" | "income" | "transfer"; amount: number; note: string }
>(items: T[], summaryInfo?: DocumentSummaryInfo | null): T[] {
  if (!items || items.length === 0) return [];

  // 1. Saring berdasarkan pola teks ringkasan/saldo eksplisit
  let filtered = items.filter((item) => {
    const note = (item.note || "").trim();
    if (!note) return true;
    if (SUMMARY_OR_BALANCE_NOTE_REGEX.test(note) || BILINGUAL_SUMMARY_REGEX.test(note)) {
      return false;
    }
    return true;
  });

  if (!summaryInfo) return filtered;

  const roundPositive = (v: unknown): number | null => {
    const n = typeof v === "number" ? Math.round(Math.abs(v)) : cleanNumericAmount(v);
    return n > 0 ? n : null;
  };

  const sumIncomeTarget = roundPositive(summaryInfo.totalIncome);
  const sumExpenseTarget = roundPositive(summaryInfo.totalExpense);
  const initialBal = roundPositive(summaryInfo.initialBalance);
  const endingBal = roundPositive(summaryInfo.endingBalance);

  // 2. Saring baris yang nominalnya sama persis dengan Saldo Awal / Saldo Akhir + berindikasi kata saldo/rekening
  if (initialBal || endingBal) {
    filtered = filtered.filter((item) => {
      const note = (item.note || "").trim();
      if ((item.amount === initialBal || item.amount === endingBal) && GENERIC_SUMMARY_WORD_REGEX.test(note)) {
        return false;
      }
      return true;
    });
  }

  // 3. Rekonsiliasi matematis: jika total income/expense terekstrak berlebih karena ikut menarik baris Total,
  // buang 1 baris yang nominalnya sama dengan Total dan membuat penjumlahan sisa cocok dengan Total.
  if (sumIncomeTarget) {
    const incomeRows = filtered.filter((t) => t.txType === "income");
    if (incomeRows.length >= 2) {
      const totalExtractedIncome = incomeRows.reduce((s, t) => s + t.amount, 0);
      if (totalExtractedIncome > sumIncomeTarget + 100) {
        const idxToDrop = filtered.findIndex(
          (t) =>
            t.txType === "income" &&
            Math.abs(t.amount - sumIncomeTarget) <= 10 &&
            Math.abs(totalExtractedIncome - t.amount - sumIncomeTarget) <= 100
        );
        if (idxToDrop !== -1) {
          filtered.splice(idxToDrop, 1);
        }
      }
    }
  }

  if (sumExpenseTarget) {
    const outRows = filtered.filter((t) => t.txType === "expense" || t.txType === "transfer");
    if (outRows.length >= 2) {
      const totalExtractedOut = outRows.reduce((s, t) => s + t.amount, 0);
      if (totalExtractedOut > sumExpenseTarget + 100) {
        const idxToDrop = filtered.findIndex(
          (t) =>
            (t.txType === "expense" || t.txType === "transfer") &&
            Math.abs(t.amount - sumExpenseTarget) <= 10 &&
            Math.abs(totalExtractedOut - t.amount - sumExpenseTarget) <= 100
        );
        if (idxToDrop !== -1) {
          filtered.splice(idxToDrop, 1);
        }
      }
    }
  }

  return filtered;
}

const KNOWN_INTERNAL_WALLET_OR_BANK_REGEX =
  /\b(?:bca|mandiri|bri|bni|blu|jago|seabank|cimb|permata|bsi|danamon|btn|jenius|gopay|ovo|dana|shopeepay|spay|linkaja|cash|tunai|kas)\b/i;

function isLikelyInternalTransfer(
  toAccountName: string | null | undefined,
  note: string,
  userAccounts: Array<{ id: string; name: string }>
): boolean {
  const target = (toAccountName || "").trim();
  const noteLower = (note || "").toLowerCase();
  if (target) {
    const targetLower = target.toLowerCase();
    const matchesUserAccount = userAccounts.some((a) => {
      const aLower = a.name.toLowerCase().trim();
      return aLower === targetLower || aLower.includes(targetLower) || targetLower.includes(aLower);
    });
    if (matchesUserAccount) return true;
    if (KNOWN_INTERNAL_WALLET_OR_BANK_REGEX.test(target) && /\b(?:top\s*up|isi\s+saldo|e-?wallet|tarik\s+tunai|pindah)\b/i.test(noteLower)) {
      return true;
    }
    return false;
  }
  return /\b(?:top\s*up\s+e-?wallet|tarik\s+tunai\s+atm|pindah\s+buku)\b/i.test(noteLower);
}

const INDONESIAN_ENGLISH_MONTH_MAP: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, maret: 2, march: 2,
  apr: 3, april: 3,
  mei: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  agu: 7, ags: 7, agt: 7, agustus: 7, aug: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oct: 9, oktober: 9, october: 9,
  nov: 10, november: 10,
  des: 11, dec: 11, desember: 11, december: 11,
};

export function parseHappenedAt(rawDate: string | undefined, currentYear: number): string {
  if (!rawDate || !rawDate.trim()) {
    return new Date().toISOString();
  }
  const clean = rawDate.trim();
  // Standard ISO YYYY-MM-DD (treat naive datetimes as WIB +07:00 for Indonesian statements)
  if (/^\d{4}-\d{2}-\d{2}/.test(clean)) {
    const hasTz = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(clean);
    const isoCandidate = /^\d{4}-\d{2}-\d{2}$/.test(clean)
      ? `${clean}T12:00:00+07:00`
      : hasTz
      ? clean
      : `${clean}+07:00`;
    const d = new Date(isoCandidate);
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // Text month format: "15 Okt 2026", "15-OKT-2026 14:30", "15 Oct"
  const textMonthMatch = clean.match(
    /^(\d{1,2})[\s\-\/\.]+([a-zA-Z]{3,12})(?:[\s\-\/\.]+(\d{2,4}))?(?:[\s,T]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/i
  );
  if (textMonthMatch) {
    const day = parseInt(textMonthMatch[1], 10);
    const mStr = textMonthMatch[2].toLowerCase();
    const month =
      INDONESIAN_ENGLISH_MONTH_MAP[mStr] ??
      INDONESIAN_ENGLISH_MONTH_MAP[mStr.slice(0, 3)];
    if (month !== undefined) {
      let year = textMonthMatch[3] ? parseInt(textMonthMatch[3], 10) : currentYear;
      if (year < 100) year += 2000;
      const hour = textMonthMatch[4] ? parseInt(textMonthMatch[4], 10) : 12;
      const min = textMonthMatch[5] ? parseInt(textMonthMatch[5], 10) : 0;
      const sec = textMonthMatch[6] ? parseInt(textMonthMatch[6], 10) : 0;
      const d = new Date(Date.UTC(year, month, day, hour - 7, min, sec));
      if (!isNaN(d.getTime())) return d.toISOString();
    }
  }
  // DD/MM/YYYY or DD-MM-YYYY (Indonesian bank statement standard)
  const dmyMatch = clean.match(
    /^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year < 100) year += 2000;
    const hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 12;
    const min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    const sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    const d = new Date(Date.UTC(year, month, day, hour - 7, min, sec));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  // DD/MM or DD-MM without year
  const dmMatch = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (dmMatch) {
    const day = parseInt(dmMatch[1], 10);
    const month = parseInt(dmMatch[2], 10) - 1;
    const hour = dmMatch[3] ? parseInt(dmMatch[3], 10) : 12;
    const min = dmMatch[4] ? parseInt(dmMatch[4], 10) : 0;
    const d = new Date(Date.UTC(currentYear, month, day, hour - 7, min, 0));
    if (!isNaN(d.getTime())) return d.toISOString();
  }
  const fallback = new Date(clean);
  return isNaN(fallback.getTime()) ? new Date().toISOString() : fallback.toISOString();
}

function normalizeTxTypeValue(raw: unknown): "expense" | "income" | "transfer" {
  const val = String(raw || "").toLowerCase().trim();
  if (
    val === "income" ||
    val === "credit" ||
    val === "kredit" ||
    val === "cr" ||
    val === "pemasukan" ||
    val === "masuk"
  ) {
    return "income";
  }
  if (val === "transfer" || val === "pindah") {
    return "transfer";
  }
  return "expense";
}

export function isReadablePdfText(text: string): boolean {
  const trimmed = (text || "").trim();
  if (trimmed.length < 8) return false;
  const nonSpace = trimmed.replace(/\s+/g, "");
  if (!nonSpace) return false;
  const alnumCount = (nonSpace.match(/[a-zA-Z0-9]/g) || []).length;
  const alnumRatio = alnumCount / nonSpace.length;
  const gibberishCount = (nonSpace.match(/[%$&;^*~\\|<>{}]/g) || []).length;
  const gibberishRatio = gibberishCount / nonSpace.length;
  const hasRealWord = /[a-zA-Z]{2,}/.test(trimmed);
  const hasDigits = /\d/.test(trimmed);
  return alnumRatio >= 0.65 && gibberishRatio < 0.12 && (hasRealWord || hasDigits);
}

/**
 * Ekstraktor teks digital dari file PDF tanpa binary eksternal
 * Mendukung FlateDecode, ToUnicode CMap (Chrome / Bank e-statements), literal & hex strings, serta TJ kerning.
 */
export function extractTextFromPdfBuffer(pdfBuffer: Buffer): string {
  const latin = pdfBuffer.toString("latin1");

  // 1. Parse indirect objects dan dekompresi stream-nya
  const objStreams = new Map<number, string>();
  const objHeaders = new Map<number, string>();
  const objRegex = /(\d+)\s+\d+\s+obj\b([\s\S]*?)\bendobj/g;

  for (const m of latin.matchAll(objRegex)) {
    const objNum = parseInt(m[1], 10);
    const body = m[2];
    const streamIdx = body.indexOf("stream");
    if (streamIdx !== -1) {
      objHeaders.set(objNum, body.slice(0, streamIdx));
      const afterStream = body.slice(streamIdx + 6);
      const nlMatch = afterStream.match(/^(?:\r\n|\r|\n)/);
      const startOffset = nlMatch ? nlMatch[0].length : 0;
      const endStreamIdx = afterStream.lastIndexOf("endstream");
      if (endStreamIdx > startOffset) {
        let streamSlice = afterStream.slice(startOffset, endStreamIdx);
        streamSlice = streamSlice.replace(/(?:\r\n|\r|\n)$/, "");
        const dec = decompressPdfStream(Buffer.from(streamSlice, "latin1"));
        objStreams.set(objNum, dec.toString("latin1"));
      }
    } else {
      objHeaders.set(objNum, body);
    }
  }

  // Fallback jika ada stream tanpa pembungkus obj..endobj
  const rawStreamsFallback: string[] = [];
  if (objStreams.size === 0) {
    const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]*endstream/g;
    let sm: RegExpExecArray | null;
    while ((sm = streamRegex.exec(latin)) !== null) {
      const dec = decompressPdfStream(Buffer.from(sm[1], "latin1"));
      rawStreamsFallback.push(dec.toString("latin1"));
    }
  }

  // 2. Kumpulkan seluruh ToUnicode CMap dari stream yang didekompresi
  const cmapsByObj = new Map<number, PdfCMap>();
  for (const [objNum, text] of objStreams.entries()) {
    if (text.includes("beginbfchar") || text.includes("beginbfrange")) {
      const cmap = parseToUnicodeCMap(text);
      if (cmap.map.size > 0) {
        cmapsByObj.set(objNum, cmap);
      }
    }
  }

  // 3. Petakan /FontName -> /ToUnicode CMap
  const fontObjToCMap = new Map<number, PdfCMap>();
  for (const [objNum, header] of objHeaders.entries()) {
    const tuMatch = header.match(/\/ToUnicode\s+(\d+)\s+\d+\s+R/);
    if (tuMatch) {
      const cmap = cmapsByObj.get(parseInt(tuMatch[1], 10));
      if (cmap) fontObjToCMap.set(objNum, cmap);
    }
  }

  const fontNameToCMap = new Map<string, PdfCMap>();
  const scanHeaders = [...objHeaders.values(), ...objStreams.values()];
  for (const header of scanHeaders) {
    if (!header.includes("/")) continue;
    for (const fm of header.matchAll(
      /\/(F[A-Za-z0-9_+-]*|TT[A-Za-z0-9_+-]*|C\d+_\d+|T\d+_\d+)\s+(\d+)\s+\d+\s+R/g
    )) {
      const cmap = fontObjToCMap.get(parseInt(fm[2], 10));
      if (cmap) fontNameToCMap.set(fm[1], cmap);
    }
  }

  const decodeHexWithCMap = (hex: string, cmap?: PdfCMap): string => {
    const clean = hex.replace(/\s+/g, "").toUpperCase();
    if (!clean) return "";
    if (cmap && cmap.map.size > 0) {
      let out = "";
      const step = cmap.codeHexLen || 4;
      for (let i = 0; i + step <= clean.length; i += step) {
        const mapped = cmap.map.get(clean.slice(i, i + step));
        if (mapped !== undefined) out += mapped;
      }
      if (out) return out;
    }
    return decodePdfHex(clean);
  };

  const decodeLiteralString = (raw: string, cmap?: PdfCMap): string => {
    const bytes: number[] = [];
    for (let i = 0; i < raw.length; i++) {
      const ch = raw[i];
      if (ch === "\\" && i + 1 < raw.length) {
        const next = raw[++i];
        if (next === "n") bytes.push(10);
        else if (next === "r") bytes.push(13);
        else if (next === "t") bytes.push(9);
        else if (next === "b") bytes.push(8);
        else if (next === "f") bytes.push(12);
        else if (next === "\r" || next === "\n") {
          if (next === "\r" && raw[i + 1] === "\n") i++;
        } else if (/[0-7]/.test(next)) {
          let oct = next;
          if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i];
          if (i + 1 < raw.length && /[0-7]/.test(raw[i + 1])) oct += raw[++i];
          bytes.push(parseInt(oct, 8));
        } else {
          bytes.push(next.charCodeAt(0));
        }
      } else {
        bytes.push(ch.charCodeAt(0));
      }
    }
    if (cmap && cmap.map.size > 0 && cmap.codeHexLen === 2) {
      let out = "";
      for (const b of bytes) {
        const key = b.toString(16).toUpperCase().padStart(2, "0");
        out +=
          cmap.map.get(key) ??
          (b >= 32 && b <= 126 ? String.fromCharCode(b) : "");
      }
      return out;
    }
    return bytes
      .map((b) =>
        (b >= 32 && b <= 126) || b >= 160
          ? String.fromCharCode(b)
          : b === 10 || b === 13
          ? " "
          : ""
      )
      .join("");
  };

  // 4. Parse text operators dari content streams
  const lines: string[] = [];
  const streamsToScan =
    objStreams.size > 0
      ? [...objStreams.values()]
      : rawStreamsFallback.length > 0
      ? rawStreamsFallback
      : [latin];

  for (const content of streamsToScan) {
    if (!content.includes("Tj") && !content.includes("TJ")) continue;
    if (content.includes("begincmap")) continue;

    let currentFont: string | undefined;
    let currentLine = "";
    let lastTmY: number | null = null;
    const numStack: number[] = [];

    let i = 0;
    const len = content.length;

    const readLiteral = (): string => {
      i++; // skip '('
      let depth = 1;
      let buf = "";
      while (i < len && depth > 0) {
        const c = content[i];
        if (c === "\\") {
          buf += c + (content[i + 1] ?? "");
          i += 2;
          continue;
        }
        if (c === "(") depth++;
        else if (c === ")") {
          depth--;
          if (depth === 0) {
            i++;
            break;
          }
        }
        buf += c;
        i++;
      }
      return buf;
    };

    const readHex = (): string => {
      i++; // skip '<'
      const start = i;
      while (i < len && content[i] !== ">") i++;
      const hex = content.slice(start, i);
      if (i < len && content[i] === ">") i++;
      return hex;
    };

    let lastString = "";
    let inArray = false;
    let arrayParts: Array<{ type: "str" | "num"; val: string }> = [];

    while (i < len) {
      const c = content[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }
      if (c === "%") {
        while (i < len && content[i] !== "\n" && content[i] !== "\r") i++;
        continue;
      }
      if (c === "(") {
        const lit = readLiteral();
        const decoded = decodeLiteralString(
          lit,
          currentFont ? fontNameToCMap.get(currentFont) : undefined
        );
        if (inArray) arrayParts.push({ type: "str", val: decoded });
        else lastString = decoded;
        continue;
      }
      if (c === "<" && content[i + 1] !== "<") {
        const hex = readHex();
        const decoded = decodeHexWithCMap(
          hex,
          currentFont ? fontNameToCMap.get(currentFont) : undefined
        );
        if (inArray) arrayParts.push({ type: "str", val: decoded });
        else lastString = decoded;
        continue;
      }
      if (c === "[") {
        inArray = true;
        arrayParts = [];
        i++;
        continue;
      }
      if (c === "]") {
        inArray = false;
        i++;
        continue;
      }
      if (c === "/") {
        i++;
        const start = i;
        while (i < len && !/[\s\[\]<>()\/]/.test(content[i])) i++;
        lastString = "/" + content.slice(start, i);
        continue;
      }

      const start = i;
      while (i < len && !/[\s\[\]<>()\/]/.test(content[i])) i++;
      const tok = content.slice(start, i);
      if (!tok) {
        i++;
        continue;
      }

      if (inArray) {
        if (/^-?\d+(?:\.\d+)?$/.test(tok)) {
          arrayParts.push({ type: "num", val: tok });
        }
        continue;
      }

      if (/^-?\d+(?:\.\d+)?$/.test(tok)) {
        numStack.push(parseFloat(tok));
        if (numStack.length > 8) numStack.shift();
        continue;
      }

      if (tok === "Tf") {
        if (lastString.startsWith("/")) {
          currentFont = lastString.slice(1);
        }
        numStack.length = 0;
      } else if (tok === "Tj" || tok === "'" || tok === "\"") {
        if (tok === "'" || tok === "\"") {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = "";
        }
        currentLine += lastString;
        lastString = "";
        numStack.length = 0;
      } else if (tok === "TJ") {
        let joined = "";
        for (const part of arrayParts) {
          if (part.type === "str") joined += part.val;
          else if (part.type === "num" && parseFloat(part.val) <= -150) joined += " ";
        }
        currentLine += joined;
        arrayParts = [];
        numStack.length = 0;
      } else if (tok === "T*" || tok === "ET") {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = "";
        numStack.length = 0;
      } else if (tok === "Td" || tok === "TD") {
        const dy = numStack.length >= 1 ? numStack[numStack.length - 1] : 0;
        const dx = numStack.length >= 2 ? numStack[numStack.length - 2] : 0;
        if (Math.abs(dy) >= 0.5) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = "";
        } else if (Math.abs(dx) >= 4 && currentLine && !currentLine.endsWith(" ")) {
          currentLine += " ";
        }
        numStack.length = 0;
      } else if (tok === "Tm") {
        const y = numStack.length >= 1 ? numStack[numStack.length - 1] : null;
        if (y !== null && lastTmY !== null && Math.abs(y - lastTmY) >= 0.5) {
          if (currentLine.trim()) lines.push(currentLine.trim());
          currentLine = "";
        } else if (currentLine && !currentLine.endsWith(" ")) {
          currentLine += " ";
        }
        if (y !== null) lastTmY = y;
        numStack.length = 0;
      } else if (tok === "BI") {
        const eiIdx = content.indexOf("EI", i);
        if (eiIdx !== -1) i = eiIdx + 2;
        numStack.length = 0;
      } else {
        numStack.length = 0;
      }
    }
    if (currentLine.trim()) lines.push(currentLine.trim());
  }

  return lines.map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

export function fuzzyMatchAccount(
  rawName: string | undefined,
  userAccounts: { id: string; name: string }[],
  fallbackBankHint?: string | null
): string {
  const tryMatch = (candidate: string): string | null => {
    if (!candidate || !candidate.trim()) return null;
    const rawLower = candidate.toLowerCase().trim();
    const clean = rawLower
      .replace(/\b(?:akun|rekening|rek|kartu|bank|dompet|saldo|pt|tbk)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    // 1. Exact match
    const exact = userAccounts.find((a) => {
      const aName = a.name.toLowerCase().trim();
      return aName === rawLower || (clean && aName === clean);
    });
    if (exact) return exact.name;

    // 2. Special direct alias for blu / blue / BCA Digital (before generic substring so "BCA Digital" doesn't match "BCA")
    if (clean === "blue" || clean === "blu" || rawLower.includes("bca digital") || /\bblu\b/.test(clean)) {
      const bluMatch = userAccounts.find((a) => {
        const aName = a.name.toLowerCase();
        return (
          aName.includes("blu") ||
          aName.includes("blue") ||
          aName.includes("bca digital") ||
          aName === "blu"
        );
      });
      if (bluMatch) return bluMatch.name;
    }

    // 3. Substring match (only when clean is non-empty and >= 2 chars)
    if (clean.length >= 2) {
      const sub = userAccounts.find((a) => {
        const aName = a.name.toLowerCase().trim();
        return aName.includes(clean) || clean.includes(aName);
      });
      if (sub) return sub.name;
    }

    // 4. Known aliases in Indonesia (test against rawLower AND clean)
    const aliases: Record<string, string[]> = {
      blu: [
        "blue",
        "bca digital",
        "blubybcadigital",
        "blu bca",
        "blubca",
        "blu by bca digital",
        "kartu blu",
        "kartu blue",
      ],
      bca: ["bank central asia", "central asia", "klikbca", "m-bca", "mbca", "mybca", "tahapan bca"],
      mandiri: ["livin", "livin' by mandiri", "livin by mandiri", "bank mandiri"],
      bri: ["brimo", "bank rakyat indonesia", "rakyat indonesia", "bri mo"],
      bni: ["wondr", "bni mobile", "wondr by bni", "bank negara indonesia", "negara indonesia"],
      gopay: ["go-pay", "gojek", "gopay tabungan"],
      ovo: ["ovo cash"],
      dana: ["dompet dana", "e-wallet dana"],
      shopeepay: ["shopee pay", "spay", "shopee"],
      cash: ["tunai", "kas tunai", "dompet", "uang tunai", "kas", "fisik"],
      jago: ["bank jago", "kantong jago"],
      seabank: ["sea bank", "sea"],
      cimb: ["cimb niaga", "octo", "octo mobile", "octoclicks"],
      permata: ["permata bank", "permata me"],
      bsi: ["bank syariah indonesia", "syariah indonesia", "bsi mobile"],
      danamon: ["bank danamon", "d-bank"],
      btn: ["bank tabungan negara", "tabungan negara", "btn mobile"],
      jenius: ["btpn", "bank btpn", "jenius btpn"],
      linkaja: ["link aja", "tcash"],
    };

    for (const [key, aliasList] of Object.entries(aliases)) {
      if (
        rawLower.includes(key) ||
        (clean && clean.includes(key)) ||
        aliasList.some((al) => rawLower.includes(al) || (clean && clean.includes(al)))
      ) {
        const match = userAccounts.find((a) => {
          const aName = a.name.toLowerCase();
          return aName.includes(key) || aliasList.some((al) => aName.includes(al));
        });
        if (match) return match.name;
      }
    }

    return null;
  };

  if (rawName && rawName.trim()) {
    const isAccountNumberOnly = /^[\d\-\s.*#]{4,}$/.test(rawName.trim());
    if (!isAccountNumberOnly) {
      const matched = tryMatch(rawName);
      if (matched) return matched;
    }
  }

  if (fallbackBankHint && fallbackBankHint.trim()) {
    const matchedBank = tryMatch(fallbackBankHint);
    if (matchedBank) return matchedBank;
  }

  if (rawName && rawName.trim() && !/^[\d\-\s.*#]{4,}$/.test(rawName.trim())) {
    return rawName.trim();
  }

  return fallbackBankHint?.trim() || userAccounts[0]?.name || "Kas Tunai";
}

export function fuzzyMatchCategory(
  rawName: string | undefined,
  userCategories: { id: string; name: string; kind?: string }[]
): string {
  if (!rawName || !rawName.trim()) return "Umum";
  const clean = rawName.toLowerCase().trim();

  // 1. Exact match
  const exact = userCategories.find((c) => c.name.toLowerCase().trim() === clean);
  if (exact) return exact.name;

  // 2. Canonical dictionary match (e.g. "makanan & minuman" / "restoran" -> "Dining", "transport" -> "Transportasi")
  const canonicalName = CANONICAL_CATEGORY_MAP[clean];
  if (canonicalName) {
    const matchedCanonical = userCategories.find(
      (c) => c.name.toLowerCase().trim() === canonicalName.toLowerCase()
    );
    if (matchedCanonical) return matchedCanonical.name;
  }

  // 3. Substring match
  const sub = userCategories.find((c) => {
    const cName = c.name.toLowerCase().trim();
    return cName.includes(clean) || clean.includes(cName);
  });
  if (sub) return sub.name;

  // 4. Return raw name if no existing category matches, so new categories are preserved
  return rawName.trim();
}

export const importRouter = router({
  parseScreenshot: protectedProcedure
    .input(
      z.object({
        images: z
          .array(
            z.object({
              base64: z.string(),
              mimeType: z.string().default("image/jpeg"),
            })
          )
          .min(1)
          .max(10),
      })
    )
    .mutation(async ({ ctx, input }) => {
      let geminiClient: GoogleGenAI | null = null;
      let geminiSetupError: any = null;
      try {
        const apiKey = await getEffectiveGeminiKey(ctx);
        geminiClient = new GoogleGenAI({ apiKey });
      } catch (keyErr: any) {
        geminiSetupError = keyErr;
      }
      const openRouterKey = await getEffectiveOpenRouterKey(ctx);

      // Ambil daftar akun & kategori user untuk kontekstualisasi prompt AI
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({ id: categories.id, name: categories.name, kind: categories.kind })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      const allExtracted: Array<{
        txType: "expense" | "income" | "transfer";
        amount: number;
        happenedAt: string;
        categoryName: string;
        accountName: string;
        toAccountName?: string | null;
        note: string;
        sourceImageIndex: number;
      }> = [];

      const currentYear = new Date().getFullYear();
      const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA, GoPay";
      const categoryNamesStr =
        userCategories.map((c) => c.name).join(", ") ||
        "Dining, Beverage, Snacks, Transportasi, Daily Goods, Shopping, Utilities, Saving, Family, Beauty, Health, Education, entertain, invest job, paylater, Salary, Part time, Allowance, Umum";

      for (let i = 0; i < input.images.length; i++) {
        const img = input.images[i];
        const cleanBase64 = img.base64
          .replace(/^data:[^;]+(?:;[^;]+)*;base64,/i, "")
          .replace(/\s+/g, "");

        const prompt = `Kamu adalah sistem OCR dan analisis transaksi keuangan profesional untuk aplikasi Fin.IQ di Indonesia.
Tugasmu adalah menganalisis gambar mutasi rekening, riwayat transaksi bank/e-wallet (seperti BCA, Mandiri, BRI, blu BCA, BNI, GoPay, OVO, DANA, ShopeePay, Jenius, Seabank, Jago), bukti transfer, atau foto struk belanja kasir fisik, lalu mengekstrak SEMUA data transaksi yang tertera di gambar menjadi format JSON array.

Daftar akun pengguna di aplikasi: ${accountNamesStr}.
Daftar kategori pengguna di aplikasi: ${categoryNamesStr}.

FORMAT OUTPUT:
Kembalikan HANYA JSON array dengan objek transaksi:
[
  {
    "txType": "expense" | "income" | "transfer",
    "amount": number,
    "happenedAt": "YYYY-MM-DDTHH:mm:ss",
    "categoryName": string,
    "accountName": string,
    "toAccountName": string | null,
    "note": string
  }
]

ATURAN EKSTRAKSI PENTING:
1. txType:
   - "expense": uang keluar, debit, tanda minus (-), pembayaran QRIS, belanja merchant, potongan biaya admin, transfer keluar.
   - "income": uang masuk, kredit, tanda plus (+), gaji, cashback, refund, transfer masuk yang diterima.
   - "transfer": perpindahan dana antar rekening atau top up e-wallet.
2. amount:
   - Angka nominal murni positif dalam Rupiah (integer / number), BUKAN string. Contoh: 50000, 125000.
   - PERHATIKAN FORMAT INDONESIA: Tanda titik (.) adalah pemisah ribuan (Rp 50.000 = 50000, Rp 1.500.000 = 1500000). Jangan membaca titik sebagai desimal!
3. happenedAt:
   - Format tanggal ISO 8601 string: "YYYY-MM-DDTHH:mm:ss".
   - Jika jam dan menit tertera di mutasi (misal 09:07 WIB), sertakan jam tersebut dalam format 24 jam. Jika jam tidak tertera, gunakan jam 12:00:00 ("YYYY-MM-DDT12:00:00").
   - Jika tahun tidak tertera di gambar, gunakan tahun ${currentYear}.
4. categoryName:
   - WAJIB pilih dan cocokkan HANYA dari salah satu daftar kategori pengguna berikut: [${categoryNamesStr}]. Jangan gunakan nama kategori di luar daftar tersebut.
5. accountName:
   - Nama bank atau e-wallet asal transaksi (misal: "blu", "BCA", "Mandiri", "GoPay", "DANA", "ShopeePay"). Utamakan yang ada di daftar akun pengguna.
6. toAccountName:
   - Jika transaksi transfer/top up, isi nama bank/e-wallet/penerima tujuan. Jika bukan transfer, isi null.
7. note:
   - Keterangan ringkas transaksi, nama merchant, atau nama penerima/pengirim (misal: "Kopi Kenangan", "Transfer ke Budi", "Indomaret", "PLN Pascabayar", "Gaji Bulanan").
8. Jika gambar adalah struk belanja fisik (misal Alfamart, Indomaret, restoran):
   - Ambil Total Belanja akhir sebagai 1 transaksi expense.
   - Isi note dengan nama toko/merchant.
9. Jika TIDAK ADA transaksi yang ditemukan di gambar, kembalikan array kosong [].`;

        let rawText: string | null = null;
        let geminiImgErr: any = geminiSetupError;

        if (geminiClient && !geminiSetupError) {
          try {
            const response = await generateWithFallback(geminiClient, {
              preferredModels: DEFAULT_GEMINI_MODELS,
              fastMode: true,
              timeoutMs: 22000,
              contents: [
                {
                  inlineData: {
                    data: cleanBase64,
                    mimeType: img.mimeType || "image/jpeg",
                  },
                },
                {
                  text: prompt,
                },
              ],
              config: {
                responseMimeType: "application/json",
                responseSchema: SCREENSHOT_TX_SCHEMA,
                maxOutputTokens: 32768,
              },
            });
            rawText = response.text || "[]";
          } catch (genErr: any) {
            geminiImgErr = genErr;
            if (isFatalGeminiError(genErr)) {
              geminiSetupError = genErr;
            }
            console.warn(
              `[parseScreenshot] Gemini gagal memproses gambar ${i + 1}:`,
              genErr?.message || genErr
            );
          }
        }

        let openRouterImgErr: any = null;
        if (rawText === null) {
          if (openRouterKey) {
            try {
              const orVisionRes = await generateOpenRouterCompletion({
                apiKey: openRouterKey,
                candidateModels: OPENROUTER_VISION_MODELS,
                timeoutMs: 35000,
                temperature: 0.1,
                systemPrompt: prompt,
                userContent: [
                  {
                    type: "text",
                    text: "Analisis gambar transaksi/mutasi ini dan kembalikan HANYA JSON array sesuai format.",
                  },
                  {
                    type: "image_url",
                    image_url: {
                      url: `data:${img.mimeType || "image/jpeg"};base64,${cleanBase64}`,
                    },
                  },
                ],
                validateResponse: (text) => {
                  const trimmed = text.trim();
                  return trimmed.includes("[") || trimmed.includes("{");
                },
              });
              rawText = orVisionRes.text;
            } catch (orErr: any) {
              openRouterImgErr = orErr;
              console.warn(
                `[parseScreenshot] OpenRouter Vision gagal memproses gambar ${i + 1}:`,
                orErr?.message || orErr
              );
            }
          } else {
            openRouterImgErr = new Error("OPENROUTER_API_KEY belum dikonfigurasi");
          }
        }

        if (rawText === null) {
          const gemMsg = geminiImgErr?.message || String(geminiImgErr || "");
          const orMsg = openRouterImgErr?.message || String(openRouterImgErr || "");
          if (/429|RESOURCE_EXHAUSTED|rate-limit/i.test(`${gemMsg} ${orMsg}`)) {
            throw new TRPCError({
              code: "TOO_MANY_REQUESTS",
              message: "Batas permintaan AI tercapai (Rate Limit). Silakan tunggu 1 menit lalu coba lagi.",
            });
          }
          if (
            geminiImgErr instanceof TRPCError &&
            geminiImgErr.code === "PRECONDITION_FAILED" &&
            (!openRouterKey || /belum dikonfigurasi/i.test(orMsg))
          ) {
            throw new TRPCError({
              code: "PRECONDITION_FAILED",
              message:
                "API Key AI (Gemini atau OpenRouter) belum terkonfigurasi. Silakan atur API Key di Pengaturan & Profil atau environment server.",
            });
          }
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: `Gagal membaca screenshot: ${orMsg || gemMsg}`,
          });
        }

        const { transactions: parsedItems } = extractTransactionsFromAiPayload(rawText);

        for (const item of parsedItems) {
          const rawAmount = cleanNumericAmount(item.amount);
          if (rawAmount <= 0) continue;

          const txType = normalizeTxTypeValue(item.txType);
          const happenedAtStr = parseHappenedAt(item.happenedAt, currentYear);

          const matchedAccName = fuzzyMatchAccount(item.accountName, userAccounts);
          const matchedToAccName =
            txType === "transfer" && item.toAccountName
              ? fuzzyMatchAccount(item.toAccountName, userAccounts)
              : item.toAccountName || null;
          const matchedCatName = fuzzyMatchCategory(item.categoryName, userCategories);

          allExtracted.push({
            txType,
            amount: Math.round(rawAmount),
            happenedAt: happenedAtStr,
            categoryName: matchedCatName,
            accountName: matchedAccName,
            toAccountName: matchedToAccName,
            note: (item.note || "").trim() || "Transaksi Screenshot",
            sourceImageIndex: i,
          });
        }
      }

      return {
        transactions: allExtracted,
        imageCount: input.images.length,
      };
    }),

  convertAnyDocument: protectedProcedure
    .input(
      z.object({
        fileBase64: z.string().optional(),
        fileText: z.string().optional(),
        fileName: z.string(),
        mimeType: z.string().default("text/plain"),
        defaultAccountId: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const userAccounts = await ctx.db
        .select({ id: accounts.id, name: accounts.name, group: accounts.group })
        .from(accounts)
        .where(eq(accounts.userId, ctx.userId));

      const userCategories = await ctx.db
        .select({ id: categories.id, name: categories.name, kind: categories.kind })
        .from(categories)
        .where(eq(categories.userId, ctx.userId));

      const accountNamesStr = userAccounts.map((a) => a.name).join(", ") || "Kas Tunai, BCA, GoPay";
      const categoryNamesStr =
        userCategories.map((c) => c.name).join(", ") ||
        "Umum, Makanan & Minuman, Transportasi, Belanja, Tagihan & Utilitas, Gaji & Pendapatan";

      const defaultAccountName = input.defaultAccountId
        ? userAccounts.find((a) => a.id === input.defaultAccountId)?.name
        : undefined;

      let cleanBase64 = (input.fileBase64 || "")
        .replace(/^data:[^;]+(?:;[^;]+)*;base64,/i, "")
        .replace(/\s+/g, "");
      if (!cleanBase64 && input.fileText) {
        cleanBase64 = Buffer.from(input.fileText, "utf-8").toString("base64");
      }

      const currentYear = new Date().getFullYear();
      const isPdf =
        input.mimeType === "application/pdf" ||
        input.fileName.toLowerCase().endsWith(".pdf");
      const isExcel =
        input.fileName.toLowerCase().endsWith(".xlsx") ||
        input.fileName.toLowerCase().endsWith(".xls") ||
        input.mimeType.includes("spreadsheet") ||
        input.mimeType.includes("excel");

      // Ekstraksi teks lokal yang valid (untuk PDF teks, Excel, CSV, Teks).
      // PENTING: Untuk PDF, JANGAN pernah decode biner PDF mentah menjadi UTF-8 jika ekstraksi teks gagal!
      let extractedDocText = "";
      let isEncryptedPdf = false;
      let pdfBuf: Buffer | null = null;

      if (isPdf && cleanBase64) {
        try {
          pdfBuf = Buffer.from(cleanBase64, "base64");
          const rawBin = pdfBuf.toString("latin1");
          if (/\/Encrypt\s+\d+\s+\d+\s+R|\/Encrypt\s*<</i.test(rawBin)) {
            isEncryptedPdf = true;
          }
          const rawExtracted = extractTextFromPdfBuffer(pdfBuf);
          if (isReadablePdfText(rawExtracted)) {
            extractedDocText = rawExtracted;
          }
        } catch (pdfErr) {
          console.warn("[convertAnyDocument] Gagal ekstraksi teks PDF lokal:", pdfErr);
        }
      } else if (isExcel && cleanBase64) {
        try {
          const excelBuf = Buffer.from(cleanBase64, "base64");
          const wb = XLSX.read(excelBuf, { type: "buffer" });
          const sheetsCsv: string[] = [];
          for (const sheetName of wb.SheetNames) {
            const sheet = wb.Sheets[sheetName];
            if (sheet) {
              sheetsCsv.push(`=== Sheet: ${sheetName} ===\n` + XLSX.utils.sheet_to_csv(sheet));
            }
          }
          extractedDocText = sheetsCsv.join("\n\n");
        } catch (excelErr) {
          console.warn("[convertAnyDocument] Gagal ekstraksi teks Excel:", excelErr);
        }
      } else if (!isPdf) {
        if (input.fileText) {
          extractedDocText = input.fileText;
        } else if (cleanBase64) {
          try {
            extractedDocText = Buffer.from(cleanBase64, "base64").toString("utf-8");
          } catch {
            extractedDocText = "";
          }
        }
      }

      const promptInstructions = `Kamu adalah sistem analisis dokumen keuangan dan konversi mutasi transaksi profesional untuk aplikasi Fin.IQ di Indonesia.
Tugasmu adalah menganalisis dokumen atau file mutasi keuangan yang diunggah (${input.fileName}) dengan template/format APAPUN (e-statement PDF BCA, Mandiri Livin', BRImo, BNI, blu BCA, SeaBank, Bank Jago, Permata, CIMB, e-wallet GoPay/OVO/DANA/ShopeePay, struk PDF, atau CSV/Excel), lalu memisahkan ringkasan dokumen (summaryInfo) dan mengekstrak HANYA baris transaksi nyata ke dalam array transactions.

Daftar akun/rekening pengguna: [${accountNamesStr}].
Daftar kategori pengguna: [${categoryNamesStr}].
${defaultAccountName ? `Rekening default jika di dokumen tidak disebutkan: "${defaultAccountName}".` : ""}

ATURAN KETAT EKSTRAKSI TRANSAKSI (WAJIB DIPATUHI):
1. BEDAKAN TRANSAKSI NYATA vs RINGKASAN/SALDO HEADER/FOOTER:
   - Dokumen mutasi bank/e-wallet sering memiliki kotak ringkasan atau baris rekap di bagian ATAS (halaman pertama) maupun BAWAH (halaman terakhir), serta kolom running balance di tiap baris, contoh:
     * "Saldo Awal" / "Opening Balance" / "Previous Balance" / "Beginning Balance"
     * "Saldo Akhir" / "Closing Balance" / "Ending Balance" / "Current Balance"
     * "Total Pemasukan" / "Total Income" / "Total Kredit" / "Mutasi Kredit" / "Total Uang Masuk"
     * "Total Pengeluaran" / "Total Expense" / "Total Debet" / "Total Debit" / "Mutasi Debet" / "Total Uang Keluar"
     * "Ringkasan Transaksi" / "Summary" / "Total Mutasi" / "Sisa Saldo" / "Saldo" per baris
   - DILARANG KERAS memasukkan angka-angka ringkasan atau saldo tersebut sebagai item di dalam array "transactions"!
   - Masukkan angka ringkasan dokumen tersebut HANYA ke objek "summaryInfo" (jika ada di dokumen, jika tidak ada isi null).
   - PENGECUALIAN PENTING: Biaya administrasi atau biaya cek saldo bank (seperti "Biaya Cek Saldo", "Biaya Admin", "Biaya Transfer", "Biaya Tarik Tunai") ADALAH transaksi pengeluaran nyata jika memiliki baris mutasi dan tanggal transaksi sendiri -> TETAP EKSTRAK sebagai "expense".

2. KLASIFIKASI TIPE TRANSAKSI (txType):
   - "expense": Pembelian merchant, QRIS, bayar tagihan/pulsa/listrik, tarik tunai, biaya admin/cek saldo bank, SERTA transfer keluar ke rekening/orang lain (contoh: "Transfer ke MAHMUDIN", "BI-FAST ke Budi", "Transfer ke PT XYZ"). Untuk transfer ke orang lain/eksternal, WAJIB gunakan "expense" dan toAccountName = null.
   - "income": Gaji, dana masuk, transfer masuk dari orang lain, bunga bank, cashback, pengembalian dana, refund, "Nota Kredit", "Penyesuaian Kredit", "Koreksi Kredit".
   - "transfer": HANYA jika jelas merupakan pemindahan dana antar rekening MILIK PENGGUNA SENDIRI yang ada di [${accountNamesStr}], atau top-up ke e-wallet / kantong milik sendiri (contoh: "Top Up DANA", "Top Up GoPay", "Transfer ke OVO", "Pindah Buku bluSaving/bluPocket"). Jika pindah ke nama individu/merchant lain, JANGAN gunakan "transfer" — gunakan "expense"!
   - Kolom Debit / suffix "DB" / tanda minus (-) = "expense"; Kolom Kredit / suffix "CR" / tanda plus (+) = "income".

3. NOMINAL (amount):
   - Angka number positif murni dalam Rupiah tanpa simbol mata uang atau pemisah ribuan (jangan masukkan kolom Sisa Saldo / Balance sebagai amount!).
   - Contoh format Indonesia "Rp 150.000,00" -> 150000; format koma ribuan "28,000.00" -> 28000; nilai desimal sen seperti ".20" atau ",50" -> bulatkan atau simpan desimal wajar, JANGAN kalikan sen menjadi ribuan.

4. TANGGAL & WAKTU (happenedAt):
   - Format ISO 8601 lokal WIB tanpa offset: "YYYY-MM-DDTHH:mm:ss".
   - Gunakan tanggal & jam transaksi persis seperti tertulis di mutasi (jika tanpa jam, gunakan "YYYY-MM-DDT12:00:00").
   - Jika tanggal tanpa tahun (misal 01/11), lihat periode di header dokumen atau gunakan tahun ${currentYear}.

5. KATEGORI (categoryName):
   - WAJIB pilih satu yang paling sesuai dari [${categoryNamesStr}] berdasarkan deskripsi/merchant transaksi.

6. AKUN (accountName):
   - Isi dengan NAMA BANK / E-WALLET sumber mutasi (contoh: "blu", "BCA", "Mandiri", "BRI", "BNI", "SeaBank", "Jago", "GoPay", "DANA"), BUKAN nomor rekening!
   - Cocokkan ke [${accountNamesStr}] HANYA berdasarkan kecocokan NAMA bank/e-wallet/produk. JANGAN PERNAH mencocokkan akun hanya karena potongan angka nomor rekening (misal nomor rekening "0095 0063 0742" JANGAN dicocokkan ke akun lain yang kebetulan mengandung angka "0095" jika nama banknya berbeda).
   - Jika nama bank dokumen (misal "blu") belum ada di [${accountNamesStr}], tetap isi "blu"${
     defaultAccountName ? ` (atau "${defaultAccountName}" jika dokumen benar-benar tidak menyebut bank/e-wallet)` : ""
   }.

7. KETERANGAN (note):
   - Tulis keterangan transaksi secara ringkas, jelas, dan informatif (contoh: "QRIS WARUNG KOPI", "Transfer ke MAHMUDIN", "Top Up DANA", "Biaya Cek Saldo", "Penyesuaian Kredit Refund").
   - Hapus karakter masking kartu "••••", nomor referensi hash panjang, atau teks sisa saldo agar output ringkas dan akurat.

FORMAT OUTPUT:
Kembalikan HANYA 1 objek JSON valid sesuai skema berikut:
{
  "detectedBank": "BCA / Bank Mandiri / blu / GoPay / dll (atau null)",
  "summaryInfo": {
    "totalIncome": number | null,
    "totalExpense": number | null,
    "initialBalance": number | null,
    "endingBalance": number | null
  },
  "transactions": [
    {
      "txType": "expense" | "income" | "transfer",
      "amount": number,
      "happenedAt": "YYYY-MM-DDTHH:mm:ss",
      "categoryName": string,
      "accountName": string,
      "toAccountName": string | null,
      "note": string
    }
  ]
}`;

      let extractedTransactions: any[] = [];
      let extractedBank: string | null = null;
      let extractedSummary: DocumentSummaryInfo | null = null;
      let modelUsedName = "";
      let geminiMultimodalSucceeded = false;
      let geminiError: any = null;
      let openRouterError: any = null;

      // 1. Prioritas Utama untuk PDF: Google Gemini Multimodal PDF
      // Mendukung PDF hasil scan gambar, e-statement BCA/Mandiri/BRI/BNI dengan CIDFont, maupun tabel multi-halaman
      if (isPdf && cleanBase64) {
        try {
          const apiKey = await getEffectiveGeminiKey(ctx);
          const ai = new GoogleGenAI({ apiKey });

          const geminiRes = await generateWithFallback(ai, {
            preferredModels: DEFAULT_GEMINI_MODELS,
            fastMode: true,
            timeoutMs: 25000,
            contents: [
              {
                inlineData: {
                  data: cleanBase64,
                  mimeType: "application/pdf",
                },
              },
              { text: promptInstructions },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: DOCUMENT_TX_SCHEMA,
              maxOutputTokens: 65536,
              temperature: 0.1,
            },
          });

          const resText = geminiRes.text || "{}";
          const extracted = extractTransactionsFromAiPayload(resText);
          geminiMultimodalSucceeded = true;
          extractedBank = extracted.detectedBank;
          extractedSummary = extracted.summaryInfo;
          extractedTransactions = extracted.transactions;
          if (extractedTransactions.length > 0) {
            modelUsedName = "Google Gemini (Multimodal PDF)";
          } else {
            console.warn("[convertAnyDocument] Gemini Multimodal tidak menemukan transaksi di PDF, memeriksa teks lokal / OpenRouter...");
          }
        } catch (err: any) {
          geminiError = err;
          console.warn("[convertAnyDocument] Gemini Multimodal PDF gagal:", err?.message || err);
        }
      }

      const openRouterKey = await getEffectiveOpenRouterKey(ctx);

      const mergeParsedResult = (
        parsed: ReturnType<typeof extractTransactionsFromAiPayload>,
        usedModelLabel: string
      ) => {
        if (!extractedBank && parsed.detectedBank) {
          extractedBank = parsed.detectedBank;
        }
        if (parsed.summaryInfo) {
          if (!extractedSummary) {
            extractedSummary = { ...parsed.summaryInfo };
          } else {
            for (const key of ["totalIncome", "totalExpense", "initialBalance", "endingBalance"] as const) {
              if (extractedSummary[key] == null && parsed.summaryInfo[key] != null) {
                extractedSummary[key] = parsed.summaryInfo[key];
              }
            }
          }
        }
        if (parsed.transactions.length > 0) {
          extractedTransactions.push(...parsed.transactions);
          modelUsedName = usedModelLabel;
        }
      };

      // 2. Fallback / Pemrosesan Berbasis Teks (untuk CSV/Excel/TXT atau PDF yang teksnya terekstrak lokal)
      if (extractedTransactions.length === 0 && extractedDocText && extractedDocText.trim().length > 10) {
        // Pecah teks panjang menjadi beberapa potongan baris agar tidak melebihi context limit model gratis
        const chunkTexts: string[] = [];
        const maxChunkChars = 20000;
        if (extractedDocText.length <= maxChunkChars) {
          chunkTexts.push(extractedDocText);
        } else {
          const lines = extractedDocText.split(/\r?\n/);
          let currentChunk = "";
          for (const line of lines) {
            if (currentChunk.length + line.length + 1 > maxChunkChars && currentChunk) {
              chunkTexts.push(currentChunk);
              currentChunk = line;
            } else {
              currentChunk += (currentChunk ? "\n" : "") + line;
            }
          }
          if (currentChunk) chunkTexts.push(currentChunk);
        }

        // A. Coba OpenRouter dengan teks bersih
        try {
          for (const chunk of chunkTexts.slice(0, 6)) {
            const openRouterRes = await generateOpenRouterCompletion({
              apiKey: openRouterKey,
              candidateModels: OPENROUTER_EXTRACTION_MODELS,
              timeoutMs: 35000,
              systemPrompt: promptInstructions,
              userPrompt: `Berikut adalah teks dokumen mutasi keuangan dari file "${input.fileName}" yang harus dikonversi ke format JSON Fin.IQ:\n\n=== ISI DOKUMEN ===\n${chunk}\n\nIngat: HANYA kembalikan 1 objek JSON valid dengan key "detectedBank", "summaryInfo", dan "transactions" (hanya baris transaksi nyata; jangan masukkan Total Pemasukan, Total Pengeluaran, Saldo Awal, atau Saldo Akhir ke dalam "transactions").`,
              temperature: 0.1,
              validateResponse: (text) => {
                const check = extractTransactionsFromAiPayload(text);
                return check.transactions.length > 0;
              },
            });

            const parsedOr = extractTransactionsFromAiPayload(openRouterRes.text);
            mergeParsedResult(parsedOr, openRouterRes.modelUsed);
          }
        } catch (openRouterErr: any) {
          openRouterError = openRouterErr;
          console.warn("[convertAnyDocument] OpenRouter text fallback error:", openRouterErr?.message);
        }
      }

      // 2B. Fallback PDF Native OpenRouter (file-parser plugin pdf-text)
      // Menangani e-statement PDF modern (/ObjStm, XObject, CIDFont) ketika Gemini gagal/terblokir dan ekstraktor lokal kosong
      if (isPdf && cleanBase64 && !isEncryptedPdf && extractedTransactions.length === 0) {
        try {
          const openRouterPdfRes = await generateOpenRouterCompletion({
            apiKey: openRouterKey,
            candidateModels: OPENROUTER_EXTRACTION_MODELS.slice(0, 4),
            timeoutMs: 40000,
            temperature: 0.1,
            systemPrompt: promptInstructions,
            plugins: [{ id: "file-parser", pdf: { engine: "pdf-text" } }],
            userContent: [
              {
                type: "text",
                text: `Berikut adalah dokumen PDF mutasi keuangan dari file "${input.fileName}" yang harus dikonversi ke format JSON Fin.IQ.\n\nIngat: HANYA kembalikan 1 objek JSON valid dengan key "detectedBank", "summaryInfo", dan "transactions" (hanya baris transaksi nyata; jangan masukkan Total Pemasukan, Total Pengeluaran, Saldo Awal, atau Saldo Akhir ke dalam "transactions").`,
              },
              {
                type: "file",
                file: {
                  filename: input.fileName || "document.pdf",
                  file_data: `data:application/pdf;base64,${cleanBase64}`,
                },
              },
            ],
            validateResponse: (text) => {
              const check = extractTransactionsFromAiPayload(text);
              return check.transactions.length > 0;
            },
          });

          const parsedPdfOr = extractTransactionsFromAiPayload(openRouterPdfRes.text);
          mergeParsedResult(parsedPdfOr, `${openRouterPdfRes.modelUsed} (PDF Parser)`);
          openRouterError = null;
        } catch (openRouterPdfErr: any) {
          openRouterError = openRouterPdfErr;
          console.warn("[convertAnyDocument] OpenRouter PDF file-parser error:", openRouterPdfErr?.message);
        }
      }

      // 2C. Jika OpenRouter belum berhasil dan ada teks terbaca, coba Gemini Text (hanya jika Gemini tidak error fatal)
      if (
        extractedTransactions.length === 0 &&
        extractedDocText &&
        extractedDocText.trim().length > 10 &&
        !(geminiError && isFatalGeminiError(geminiError))
      ) {
        try {
          const apiKey = await getEffectiveGeminiKey(ctx);
          const ai = new GoogleGenAI({ apiKey });

          const geminiRes = await generateWithFallback(ai, {
            preferredModels: DEFAULT_GEMINI_MODELS,
            fastMode: true,
            timeoutMs: 25000,
            contents: [
              {
                text: `${promptInstructions}\n\n=== ISI DOKUMEN (${input.fileName}) ===\n${extractedDocText.slice(0, 60000)}`,
              },
            ],
            config: {
              responseMimeType: "application/json",
              responseSchema: DOCUMENT_TX_SCHEMA,
              maxOutputTokens: 65536,
              temperature: 0.1,
            },
          });

          const parsedGemText = extractTransactionsFromAiPayload(geminiRes.text || "{}");
          mergeParsedResult(parsedGemText, "Google Gemini (Text Prompt)");
        } catch (geminiTextErr: any) {
          if (!geminiError) geminiError = geminiTextErr;
          console.error("[convertAnyDocument] Gemini text prompt failed:", geminiTextErr);
        }
      }

      // Jika seluruh jalur gagal karena error (bukan karena dokumen memang tidak berisi transaksi)
      if (extractedTransactions.length === 0 && !geminiMultimodalSucceeded) {
        if (isEncryptedPdf) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Dokumen PDF ini memiliki proteksi kata sandi (password). Silakan buka file PDF Anda di browser atau aplikasi PDF reader, simpan/cetak ulang tanpa kata sandi (fitur 'Print to PDF' / 'Simpan sebagai PDF'), lalu unggah kembali file hasil cetak tersebut.",
          });
        }
        const gemMsg = geminiError?.message || String(geminiError || "");
        const orMsg = openRouterError?.message || String(openRouterError || "");
        const gemKeyMissing =
          geminiError instanceof TRPCError && geminiError.code === "PRECONDITION_FAILED";
        const orKeyMissing =
          !openRouterKey || /belum dikonfigurasi/i.test(orMsg);

        if (gemKeyMissing && orKeyMissing) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Layanan AI belum dikonfigurasi di server maupun profil Anda. Tambahkan OPENROUTER_API_KEY atau GEMINI_API_KEY di secret server, atau masukkan API Key di Pengaturan & Profil.",
          });
        }
        if (/429|RESOURCE_EXHAUSTED|rate-limit/i.test(`${gemMsg} ${orMsg}`)) {
          throw new TRPCError({
            code: "TOO_MANY_REQUESTS",
            message: "Batas permintaan AI sedang padat (Rate Limit). Silakan tunggu beberapa saat lalu coba unggah kembali.",
          });
        }
        if (/Kunci API OpenRouter tidak valid/i.test(orMsg)) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: orMsg,
          });
        }
        if (/API_KEY_INVALID|API key not valid|PERMISSION_DENIED/i.test(gemMsg) && orKeyMissing) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "API Key AI tidak valid atau belum aktif. Silakan periksa API Key di Pengaturan & Profil atau secret server.",
          });
        }
        if (isPdf) {
          const detailParts = [
            gemMsg ? `Gemini: ${gemMsg.slice(0, 140)}` : "",
            orMsg ? `OpenRouter: ${orMsg.slice(0, 140)}` : "",
          ]
            .filter(Boolean)
            .join(" | ");
          throw new TRPCError({
            code: "INTERNAL_SERVER_ERROR",
            message: detailParts
              ? `Layanan AI gagal membaca PDF ini (${detailParts}). Pastikan OPENROUTER_API_KEY / GEMINI_API_KEY aktif dan file bukan PDF hasil scan tanpa akses Gemini.`
              : "Layanan AI tidak dapat membaca dokumen PDF ini. Jika ini PDF hasil scan gambar atau terenkripsi, pastikan file jelas dan koneksi AI aktif.",
          });
        }
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: orMsg
            ? `Layanan AI gagal membaca dokumen ini: ${orMsg}`
            : "Layanan AI tidak dapat membaca dokumen ini. Pastikan file dokumen jelas, tidak rusak, dan koneksi AI aktif.",
        });
      }

      try {
        const normalizedTxs: Array<{
          id: string;
          txType: "expense" | "income" | "transfer";
          amount: number;
          happenedAt: string;
          categoryName: string;
          accountName: string;
          toAccountName?: string | null;
          note: string;
        }> = [];

        for (let idx = 0; idx < extractedTransactions.length; idx++) {
          const item = extractedTransactions[idx];
          if (!item || typeof item !== "object") continue;
          const rawAmount = cleanNumericAmount(item.amount);
          if (rawAmount <= 0) continue;

          const noteStr = (item.note || "").trim() || "Transaksi Impor Dokumen";
          let txType = normalizeTxTypeValue(item.txType);
          const happenedAtStr = parseHappenedAt(item.happenedAt, currentYear);

          const matchedAccName = fuzzyMatchAccount(
            item.accountName || defaultAccountName,
            userAccounts,
            extractedBank || defaultAccountName
          );
          let matchedToAccName =
            txType === "transfer" && item.toAccountName
              ? fuzzyMatchAccount(item.toAccountName, userAccounts)
              : item.toAccountName || null;

          // Prevent external person transfers (e.g. "Transfer ke MAHMUDIN") from creating bogus own accounts
          if (
            txType === "transfer" &&
            !isLikelyInternalTransfer(matchedToAccName || item.toAccountName, noteStr, userAccounts)
          ) {
            txType = "expense";
            matchedToAccName = null;
          }

          const matchedCatName = fuzzyMatchCategory(item.categoryName, userCategories);

          normalizedTxs.push({
            id: `ai-conv-${Date.now()}-${idx}-${Math.random().toString(36).substring(2, 6)}`,
            txType,
            amount: Math.round(rawAmount),
            happenedAt: happenedAtStr,
            categoryName: matchedCatName,
            accountName: matchedAccName,
            toAccountName: matchedToAccName,
            note: noteStr,
          });
        }

        const filteredTxs = filterOutSummaryAndBalanceRows(normalizedTxs, extractedSummary);

        if (filteredTxs.length === 0 && isEncryptedPdf) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message:
              "Dokumen PDF ini memiliki proteksi kata sandi (password). Silakan buka file PDF Anda di browser atau aplikasi PDF reader, simpan/cetak ulang tanpa kata sandi (fitur 'Print to PDF' / 'Simpan sebagai PDF'), lalu unggah kembali file hasil cetak tersebut.",
          });
        }

        return {
          transactions: filteredTxs,
          detectedBank: extractedBank,
          totalCount: filteredTxs.length,
          modelUsed: modelUsedName,
        };
      } catch (postErr: any) {
        if (postErr instanceof TRPCError) throw postErr;
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Gagal memproses hasil konversi: ${postErr?.message || postErr}`,
        });
      }
    }),

  executeBatch: protectedProcedure
    .input(
      z.object({
        items: z.array(
          z.object({
            txType: z.enum(["expense", "income", "transfer"]),
            amount: z.number().positive(),
            happenedAt: z.string(),
            categoryName: z.string(),
            accountName: z.string(),
            toAccountName: z.string().nullable().optional(),
            note: z.string().optional(),
            tags: z.array(z.string()).optional(),
          })
        ),
        targetLedgerId: z.string().optional(),
        defaultAccountId: z.string().optional(),
        dedupStrategy: z.enum(["skip_duplicates", "insert_all"]).default("skip_duplicates"),
        autoTag: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // 1. Resolve target ledger
      let targetLedgerId = input.targetLedgerId;
      if (!targetLedgerId) {
        const existingLedgers = await ctx.db
          .select()
          .from(ledgers)
          .where(eq(ledgers.userId, ctx.userId))
          .limit(1);

        if (existingLedgers.length > 0) {
          targetLedgerId = existingLedgers[0].id;
        } else {
          const newLedgerId = crypto.randomUUID();
          await ctx.db.insert(ledgers).values({
            id: newLedgerId,
            userId: ctx.userId,
            name: "Buku Kas Utama",
            currency: "IDR",
            monthStartDay: 1,
          });
          targetLedgerId = newLedgerId;
        }
      }

      // 2. Cache user accounts
      const userAccounts = await ctx.db.select().from(accounts).where(eq(accounts.userId, ctx.userId));
      const accountMap = new Map<string, any>();
      for (const a of userAccounts) {
        accountMap.set(a.name.toLowerCase().trim(), a);
        accountMap.set(a.id, a);
      }

      let defaultAccount = userAccounts[0];
      if (input.defaultAccountId) {
        const found = userAccounts.find((a) => a.id === input.defaultAccountId);
        if (found) defaultAccount = found;
      }

      if (!defaultAccount) {
        const newAccId = crypto.randomUUID();
        const initialAcc = {
          id: newAccId,
          userId: ctx.userId,
          name: "Kas Tunai",
          group: "Cash",
          currency: "IDR",
          initialBalance: 0,
          balance: 0,
        };
        await ctx.db.insert(accounts).values(initialAcc);
        defaultAccount = initialAcc as any;
        accountMap.set("kas tunai", initialAcc);
        accountMap.set("cash", initialAcc);
        accountMap.set(newAccId, initialAcc);
      }

      // 3. Cache user categories
      const userCategories = await ctx.db.select().from(categories).where(eq(categories.userId, ctx.userId));
      const categoryMap = new Map<string, any>();
      for (const c of userCategories) {
        categoryMap.set(c.name.toLowerCase().trim(), c);
        categoryMap.set(c.id, c);
      }

      // 4. Deduplication timestamps
      const existingTxTimestamps = new Set<string>();
      if (input.dedupStrategy === "skip_duplicates") {
        const existingTx = await ctx.db
          .select({
            happenedAt: transactions.happenedAt,
            amount: transactions.amount,
            accountId: transactions.accountId,
          })
          .from(transactions)
          .where(eq(transactions.userId, ctx.userId));

        for (const t of existingTx) {
          const key = `${new Date(t.happenedAt).getTime()}_${t.amount}_${t.accountId}`;
          existingTxTimestamps.add(key);
        }
      }

      const accountsCreated: string[] = [];
      const categoriesCreated: string[] = [];
      const txToInsert: any[] = [];
      let skippedCount = 0;
      const balanceDeltas = new Map<string, number>();

      for (const item of input.items) {
        const rawDateObj = new Date(item.happenedAt);
        const happenedAtDate = isNaN(rawDateObj.getTime()) ? new Date() : rawDateObj;

        // Category resolution
        const rawCat = item.categoryName ? item.categoryName.trim() : "";
        const cleanCatName =
          rawCat
            .replace(/\s*[\(（][\u4e00-\u9fa5\s]+[\)）]/g, "")
            .replace(/[\u4e00-\u9fa5]+/g, "")
            .trim();

        let matchedCat = null;
        if (cleanCatName) {
          // 1. Direct or cached match
          matchedCat = categoryMap.get(cleanCatName.toLowerCase()) || categoryMap.get(cleanCatName);

          // 2. Fuzzy match against existing categories (only if cleanCatName is not deliberately new)
          if (!matchedCat) {
            const resolvedName = fuzzyMatchCategory(cleanCatName, userCategories);
            if (resolvedName && resolvedName.toLowerCase() !== cleanCatName.toLowerCase()) {
              matchedCat = categoryMap.get(resolvedName.toLowerCase()) || categoryMap.get(resolvedName);
            }
          }
        }

        // 3. If not matched, check if it's a new custom category (not empty or generic 'umum')
        const isGenericCat = !cleanCatName || /^(umum|uncategorized|lainnya|lain-lain|-)$/i.test(cleanCatName);
        if (!matchedCat && !isGenericCat) {
          const newCatId = crypto.randomUUID();
          const newCat = {
            id: newCatId,
            userId: ctx.userId,
            name: cleanCatName,
            kind: item.txType === "income" ? ("income" as const) : ("expense" as const),
            icon: item.txType === "income" ? "TrendingUp" : "Receipt",
          };
          await ctx.db.insert(categories).values(newCat);
          matchedCat = newCat;
          categoryMap.set(cleanCatName.toLowerCase(), newCat);
          categoryMap.set(cleanCatName, newCat);
          categoryMap.set(newCatId, newCat);
          userCategories.push(newCat as any);
          if (!categoriesCreated.includes(cleanCatName)) {
            categoriesCreated.push(cleanCatName);
          }
        } else if (!matchedCat) {
          // Fallback to default user category only if generic or empty
          const fallbackCat = userCategories.find(
            (c) => c.kind === (item.txType === "income" ? "income" : "expense")
          ) || userCategories[0];
          matchedCat = fallbackCat;
        }

        // Account resolution
        const accName = item.accountName ? item.accountName.trim() : "";
        let matchedAccount = null;

        if (accName) {
          // 1. Direct or cached match
          matchedAccount =
            accountMap.get(accName.toLowerCase()) ||
            accountMap.get(accName);

          // 2. Fuzzy alias match only if mapped to an existing user account
          if (!matchedAccount) {
            const fuzzyName = fuzzyMatchAccount(accName, userAccounts);
            if (fuzzyName && fuzzyName.toLowerCase() !== accName.toLowerCase()) {
              matchedAccount = accountMap.get(fuzzyName.toLowerCase()) || accountMap.get(fuzzyName);
            }
          }
        }

        // 3. If account not found in user's accounts, and a valid account name was provided:
        // CREATE THE NEW ACCOUNT!
        const isGenericAcc = !accName || /^(kas tunai|cash|tunai|dompet|-)$/i.test(accName);
        if (!matchedAccount && !isGenericAcc) {
          const groupName = /(bank|bca|mandiri|bni|bri|cimb|jago|seabank|bsi|permata|danamon|btn|panin|mega)/i.test(accName)
            ? "Bank card"
            : /(gopay|ovo|dana|shopee|spay|linkaja|wallet|dompet)/i.test(accName)
            ? "E-Wallet"
            : "Cash";

          const newAccId = crypto.randomUUID();
          const newAcc = {
            id: newAccId,
            userId: ctx.userId,
            name: accName,
            group: groupName,
            currency: "IDR",
            initialBalance: 0,
            balance: 0,
          };
          await ctx.db.insert(accounts).values(newAcc);
          matchedAccount = newAcc;
          accountMap.set(accName.toLowerCase(), newAcc);
          accountMap.set(accName, newAcc);
          accountMap.set(newAccId, newAcc);
          userAccounts.push(newAcc as any);
          if (!accountsCreated.includes(accName)) {
            accountsCreated.push(accName);
          }
        } else if (!matchedAccount) {
          matchedAccount = defaultAccount;
        }

        // To Account for transfer
        let matchedToAccount = null;
        if (item.txType === "transfer" && item.toAccountName) {
          const toName = item.toAccountName.trim();
          matchedToAccount = accountMap.get(toName.toLowerCase()) || accountMap.get(toName);
          if (!matchedToAccount) {
            const fuzzyTo = fuzzyMatchAccount(toName, userAccounts);
            if (fuzzyTo && fuzzyTo.toLowerCase() !== toName.toLowerCase()) {
              matchedToAccount = accountMap.get(fuzzyTo.toLowerCase()) || accountMap.get(fuzzyTo);
            }
          }

          if (!matchedToAccount && toName) {
            const groupName = /(bank|bca|mandiri|bni|bri|cimb|jago|seabank|bsi|permata|danamon|btn|panin|mega)/i.test(toName)
              ? "Bank card"
              : /(gopay|ovo|dana|shopee|spay|linkaja|wallet|dompet)/i.test(toName)
              ? "E-Wallet"
              : "Cash";

            const newToAccId = crypto.randomUUID();
            const newToAcc = {
              id: newToAccId,
              userId: ctx.userId,
              name: toName,
              group: groupName,
              currency: "IDR",
              initialBalance: 0,
              balance: 0,
            };
            await ctx.db.insert(accounts).values(newToAcc);
            matchedToAccount = newToAcc;
            accountMap.set(toName.toLowerCase(), newToAcc);
            accountMap.set(toName, newToAcc);
            accountMap.set(newToAccId, newToAcc);
            userAccounts.push(newToAcc as any);
            if (!accountsCreated.includes(toName)) {
              accountsCreated.push(toName);
            }
          }
        }

        // Dedup check
        if (input.dedupStrategy === "skip_duplicates") {
          const dedupKey = `${happenedAtDate.getTime()}_${item.amount}_${matchedAccount.id}`;
          if (existingTxTimestamps.has(dedupKey)) {
            skippedCount++;
            continue;
          }
          existingTxTimestamps.add(dedupKey);
        }

        const tagsList = [...(item.tags || [])];
        if (input.autoTag && input.autoTag.trim()) {
          tagsList.push(input.autoTag.trim());
        }

        txToInsert.push({
          id: crypto.randomUUID(),
          userId: ctx.userId,
          ledgerId: targetLedgerId,
          accountId: matchedAccount.id,
          toAccountId: matchedToAccount?.id || null,
          categoryId: matchedCat.id,
          txType: item.txType,
          amount: item.amount,
          nativeAmount: item.amount,
          currency: matchedAccount.currency || "IDR",
          happenedAt: happenedAtDate,
          note: item.note || null,
          tagsJson: tagsList,
          createdAt: new Date(),
        });

        // Track balance delta
        if (item.txType === "expense") {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) - item.amount);
        } else if (item.txType === "income") {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) + item.amount);
        } else if (item.txType === "transfer" && matchedToAccount) {
          balanceDeltas.set(matchedAccount.id, (balanceDeltas.get(matchedAccount.id) || 0) - item.amount);
          balanceDeltas.set(matchedToAccount.id, (balanceDeltas.get(matchedToAccount.id) || 0) + item.amount);
        }
      }

      // Batch insert transactions in chunks of 200
      const chunkSize = 200;
      for (let i = 0; i < txToInsert.length; i += chunkSize) {
        const chunk = txToInsert.slice(i, i + chunkSize);
        if (chunk.length > 0) {
          await ctx.db.insert(transactions).values(chunk);
        }
      }

      // Update balances
      for (const [accId, delta] of balanceDeltas.entries()) {
        if (delta !== 0) {
          await ctx.db
            .update(accounts)
            .set({
              balance: sql`${accounts.balance} + ${delta}`,
              updatedAt: new Date(),
            })
            .where(eq(accounts.id, accId));
        }
      }

      return {
        success: true,
        createdCount: txToInsert.length,
        skippedCount,
        accountsCreated,
        categoriesCreated,
      };
    }),
});
