"use client";

import React, { useState } from "react";
import { marked, type Token, type Tokens } from "marked";
import { Copy, Check, Table as TableIcon } from "lucide-react";

interface AIMessageRendererProps {
  content: string;
  className?: string;
}

/**
 * High-precision regex to detect Indonesian Rupiah currency figures and percentages
 * so monetary telemetry stands out with tabular monospace anti-slop typography.
 */
const FINANCIAL_TELEMETRY_REGEX = /(\bRp\.?\s?[\d.,]+|[+-]?\b\d+(?:[.,]\d+)?%)/g;

function renderHighlightedText(text: string): React.ReactNode[] {
  if (!text) return [];

  const parts = text.split(FINANCIAL_TELEMETRY_REGEX);
  if (parts.length === 1) {
    return [text];
  }

  return parts.map((part, idx) => {
    if (!part) return null;

    // Indonesian Currency (e.g., Rp 150.000, Rp. 1.250.000)
    if (/^Rp\.?\s?[\d.,]+/i.test(part)) {
      return (
        <span
          key={`fin-curr-${idx}`}
          className="font-mono font-semibold tabular-nums text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-1.5 py-0.5 rounded text-[11px] inline-block tracking-tight"
        >
          {part}
        </span>
      );
    }

    // Percentage (e.g. +15%, -8%, 45%)
    if (/^[+-]?\d+(?:[.,]\d+)?%$/.test(part)) {
      const isNegative = part.startsWith("-");
      const isPositive = part.startsWith("+");
      const colorClass = isNegative
        ? "text-rose-600 dark:text-rose-400 bg-rose-500/10"
        : isPositive
        ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
        : "text-foreground font-semibold bg-muted/60";

      return (
        <span
          key={`fin-pct-${idx}`}
          className={`font-mono tabular-nums px-1.5 py-0.5 rounded text-[11px] inline-block tracking-tight ${colorClass}`}
        >
          {part}
        </span>
      );
    }

    return part;
  });
}

function CodeBlockWithCopy({ code, lang }: { code: string; lang?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-2.5 rounded-md overflow-hidden border border-border/70 bg-zinc-950 text-zinc-100 text-xs font-mono shadow-2xs">
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 text-[10px] text-zinc-400">
        <span className="uppercase tracking-wider">{lang || "data"}</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 hover:text-zinc-200 transition-colors cursor-pointer px-1.5 py-0.5 rounded bg-zinc-800/80 hover:bg-zinc-800 active:scale-95"
          title="Salin kode"
        >
          {copied ? (
            <>
              <Check className="h-3 w-3 text-emerald-400" />
              <span className="text-emerald-400">Tersalin</span>
            </>
          ) : (
            <>
              <Copy className="h-3 w-3" />
              <span>Salin</span>
            </>
          )}
        </button>
      </div>
      <pre className="p-3 overflow-x-auto text-[11px] leading-relaxed text-zinc-200">
        <code>{code}</code>
      </pre>
    </div>
  );
}

function renderTokens(tokens?: Token[]): React.ReactNode {
  if (!tokens || tokens.length === 0) return null;

  return tokens.map((token, index) => {
    switch (token.type) {
      case "heading": {
        const headingToken = token as Tokens.Heading;
        if (headingToken.depth === 1) {
          return (
            <h2
              key={`h1-${index}`}
              className="text-base font-extrabold tracking-tight text-foreground mt-4 mb-2 first:mt-0 flex items-center gap-2"
            >
              <span className="h-2 w-2 rounded-xs bg-emerald-500 shrink-0 inline-block" />
              <span>{renderTokens(headingToken.tokens)}</span>
            </h2>
          );
        }
        if (headingToken.depth === 2) {
          return (
            <h3
              key={`h2-${index}`}
              className="text-sm font-bold tracking-tight text-foreground mt-3.5 mb-2 first:mt-0 flex items-center gap-2"
            >
              <span className="h-2 w-2 rounded-xs bg-emerald-500 shrink-0 inline-block" />
              <span>{renderTokens(headingToken.tokens)}</span>
            </h3>
          );
        }
        // depth >= 3
        return (
          <h4
            key={`h3-${index}`}
            className="text-xs sm:text-sm font-bold tracking-tight text-foreground mt-3.5 mb-1.5 first:mt-0 flex items-center gap-2 border-b border-border/50 pb-1.5"
          >
            <span className="h-1.5 w-1.5 rounded-xs bg-emerald-500 shrink-0 inline-block" />
            <span>{renderTokens(headingToken.tokens)}</span>
          </h4>
        );
      }

      case "paragraph": {
        const paragraphToken = token as Tokens.Paragraph;
        return (
          <p
            key={`p-${index}`}
            className="text-xs leading-relaxed text-foreground/90 my-2 first:mt-0 last:mb-0"
          >
            {renderTokens(paragraphToken.tokens)}
          </p>
        );
      }

      case "list": {
        const listToken = token as Tokens.List;
        const startIndex = typeof listToken.start === "number" ? listToken.start : 1;

        if (listToken.ordered) {
          return (
            <ol key={`ol-${index}`} className="my-2.5 space-y-2 pl-0">
              {listToken.items.map((item, itemIdx) => (
                <li
                  key={`ol-item-${itemIdx}`}
                  className="flex items-start gap-2.5 text-xs text-foreground/90 leading-relaxed"
                >
                  <span className="min-w-[19px] h-[19px] rounded px-1 bg-muted/80 text-[10px] font-mono font-bold text-foreground border border-border/60 flex items-center justify-center shrink-0 mt-0.5 tabular-nums select-none shadow-2xs">
                    {startIndex + itemIdx}
                  </span>
                  <div className="flex-1 min-w-0">{renderTokens(item.tokens)}</div>
                </li>
              ))}
            </ol>
          );
        }

        return (
          <ul key={`ul-${index}`} className="my-2 space-y-1.5 pl-0">
            {listToken.items.map((item, itemIdx) => (
              <li
                key={`ul-item-${itemIdx}`}
                className="flex items-start gap-2 text-xs text-foreground/90 leading-relaxed"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0 mt-2 select-none" />
                <div className="flex-1 min-w-0">{renderTokens(item.tokens)}</div>
              </li>
            ))}
          </ul>
        );
      }

      case "table": {
        const tableToken = token as Tokens.Table;
        return (
          <div
            key={`table-${index}`}
            className="my-3 overflow-x-auto rounded-lg border border-border/70 bg-card/60 shadow-2xs"
          >
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-muted/60 border-b border-border/60">
                  {tableToken.header.map((cell, cIdx) => {
                    const align = tableToken.align[cIdx];
                    const alignClass =
                      align === "right"
                        ? "text-right"
                        : align === "center"
                        ? "text-center"
                        : "text-left";
                    return (
                      <th
                        key={`th-${cIdx}`}
                        className={`px-3.5 py-2 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider ${alignClass}`}
                      >
                        {renderTokens(cell.tokens)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {tableToken.rows.map((row, rIdx) => (
                  <tr
                    key={`tr-${rIdx}`}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    {row.map((cell, cIdx) => {
                      const align = tableToken.align[cIdx];
                      const alignClass =
                        align === "right"
                          ? "text-right"
                          : align === "center"
                          ? "text-center"
                          : "text-left";
                      return (
                        <td
                          key={`td-${cIdx}`}
                          className={`px-3.5 py-2 text-xs font-normal text-foreground/90 tabular-nums ${alignClass}`}
                        >
                          {renderTokens(cell.tokens)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }

      case "blockquote": {
        const blockquoteToken = token as Tokens.Blockquote;
        return (
          <div
            key={`quote-${index}`}
            className="my-2.5 border-l-2 border-emerald-500 bg-emerald-500/5 dark:bg-emerald-950/20 px-3.5 py-2.5 rounded-r-lg text-xs text-foreground/90 font-medium leading-relaxed shadow-2xs"
          >
            {renderTokens(blockquoteToken.tokens)}
          </div>
        );
      }

      case "code": {
        const codeToken = token as Tokens.Code;
        return (
          <CodeBlockWithCopy
            key={`code-${index}`}
            code={codeToken.text}
            lang={codeToken.lang}
          />
        );
      }

      case "strong": {
        const strongToken = token as Tokens.Strong;
        return (
          <strong key={`strong-${index}`} className="font-bold text-foreground">
            {renderTokens(strongToken.tokens)}
          </strong>
        );
      }

      case "em": {
        const emToken = token as Tokens.Em;
        return (
          <em key={`em-${index}`} className="italic text-foreground/90">
            {renderTokens(emToken.tokens)}
          </em>
        );
      }

      case "codespan": {
        const codespanToken = token as Tokens.Codespan;
        return (
          <code
            key={`codespan-${index}`}
            className="px-1.5 py-0.5 rounded bg-muted/80 font-mono text-[11px] text-foreground border border-border/50"
          >
            {codespanToken.text}
          </code>
        );
      }

      case "del": {
        const delToken = token as Tokens.Del;
        return (
          <del key={`del-${index}`} className="line-through text-muted-foreground">
            {renderTokens(delToken.tokens)}
          </del>
        );
      }

      case "link": {
        const linkToken = token as Tokens.Link;
        return (
          <a
            key={`link-${index}`}
            href={linkToken.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-emerald-600 dark:text-emerald-400 font-semibold underline hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            {renderTokens(linkToken.tokens)}
          </a>
        );
      }

      case "hr": {
        return <hr key={`hr-${index}`} className="my-3 border-border/50" />;
      }

      case "br": {
        return <br key={`br-${index}`} />;
      }

      case "space": {
        return null;
      }

      case "text": {
        const textToken = token as Tokens.Text;
        if (textToken.tokens && textToken.tokens.length > 0) {
          return (
            <React.Fragment key={`text-frag-${index}`}>
              {renderTokens(textToken.tokens)}
            </React.Fragment>
          );
        }
        return (
          <React.Fragment key={`text-leaf-${index}`}>
            {renderHighlightedText(textToken.text)}
          </React.Fragment>
        );
      }

      case "escape": {
        const escapeToken = token as Tokens.Escape;
        return (
          <React.Fragment key={`esc-${index}`}>
            {escapeToken.text}
          </React.Fragment>
        );
      }

      default: {
        const anyToken = token as any;
        if (anyToken.tokens) {
          return (
            <React.Fragment key={`default-${index}`}>
              {renderTokens(anyToken.tokens)}
            </React.Fragment>
          );
        }
        if (anyToken.text) {
          return (
            <React.Fragment key={`default-${index}`}>
              {renderHighlightedText(anyToken.text)}
            </React.Fragment>
          );
        }
        return null;
      }
    }
  });
}

export function AIMessageRenderer({ content, className = "" }: AIMessageRendererProps) {
  if (!content) return null;

  // Pre-process any weird multi-asterisk anomalies before lexing
  // e.g., turn stray literal **** into **
  const sanitizedContent = content.replace(/\*{4,}/g, "**");

  let tokens: Token[] = [];
  try {
    tokens = marked.lexer(sanitizedContent);
  } catch (err) {
    // Graceful fallback to simple paragraph
    return (
      <div className={`space-y-1 text-xs select-text ${className}`}>
        <p className="leading-relaxed whitespace-pre-wrap">{content}</p>
      </div>
    );
  }

  return (
    <div className={`space-y-1 text-xs select-text text-foreground ${className}`}>
      {renderTokens(tokens)}
    </div>
  );
}
