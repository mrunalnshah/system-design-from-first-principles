/**
 * Summaries and reading time (REQ-CNT-008, REQ-CNT-009), so every card and meta description has a summary and
 * every entry a reading time with no effort from the author. Both work on the Markdown body (frontmatter, if
 * present, is skipped) and read it as plain text: Obsidian syntax is reduced to the words a reader sees.
 */

/** Longest summary, in characters, including the closing "…". */
export const SUMMARY_MAX = 200;
/** Reading speed for the estimate (REQ-CNT-009). */
export const WORDS_PER_MINUTE = 230;

/**
 * The entry's summary: its `description` when it has one (used as written), else its first paragraph of plain
 * text, cut at a word boundary to at most 200 characters ending in "…". Empty when there's no such paragraph.
 * Headings, embeds, lists, quotes and callouts, tables, code and math blocks are skipped as "not a paragraph".
 */
export function summaryOf(markdown: string, description?: string): string {
  if (description?.trim()) return description.trim();
  const first = blocks(markdown).find(isParagraph);
  if (!first) return "";
  const text = plain(first);
  if (text.length <= SUMMARY_MAX) return text;
  const room = text.slice(0, SUMMARY_MAX - 1); // one character is kept for "…"
  const cut = /\s\S*$/.test(room) && !/\s/.test(text[SUMMARY_MAX - 1] ?? "") ? room.replace(/\s+\S*$/, "") : room;
  return `${cut.replace(/[\s,;:.–—-]+$/, "")}…`;
}

/** Whole minutes to read the entry: words / 230, rounded up, at least 1. */
export function readingMinutes(markdown: string): number {
  const words = plain(stripFrontmatter(markdown).replace(/%%[\s\S]*?%%/g, " ")).match(/\S+/g) ?? [];
  const counted = words.filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
  return Math.max(1, Math.ceil(counted / WORDS_PER_MINUTE));
}

// ---------- internals ----------

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/\r\n?/g, "\n").replace(/^﻿?(\s*\n)?---\n[\s\S]*?\n---(\n|$)/, "");
}

/** Blocks separated by blank lines, after removing comments and fenced code/math (which never hold the summary). */
function blocks(markdown: string): string[] {
  return stripFrontmatter(markdown)
    .replace(/%%[\s\S]*?%%/g, "")
    .replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "")
    .replace(/^\$\$[\s\S]*?\$\$\s*$/gm, "")
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);
}

/** A paragraph of prose: not a heading, embed, list, quote, table, HTML block or rule. */
function isParagraph(block: string): boolean {
  if (/^(#{1,6}\s|[-*+]\s|\d+[.)]\s|>|\||<|(?:[-*_]\s*){3,}$)/.test(block)) return false;
  return plain(block).length > 0;
}

/** The words a reader sees, on one line. */
function plain(text: string): string {
  return text
    .replace(/!\[\[[^\]]*\]\]/g, " ") // embeds
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ") // images
    .replace(/\[\[([^\]|#]*)(?:#[^\]|]*)?\|([^\]]*)\]\]/g, "$2") // [[note|label]] → label
    .replace(/\[\[([^\]|#]*)(?:#[^\]]*)?\]\]/g, (_, note: string) => note.split("/").pop() ?? note) // [[note]] → note
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // [text](url) → text
    .replace(/\[\^[^\]]+\]/g, "") // footnote references
    .replace(/<[^>]+>/g, " ") // HTML tags
    .replace(/(\*\*|__|==|~~)(.+?)\1/g, "$2") // bold, highlight, strikethrough
    .replace(/(^|[^\w*])[*_]([^*_\s][^*_]*?)[*_](?=[^\w*]|$)/g, "$1$2") // italics
    .replace(/`([^`]*)`/g, "$1") // inline code
    .replace(/\$([^$\n]+)\$/g, "$1") // inline math, as written
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1") // Markdown escapes
    .replace(/\s+/g, " ")
    .trim();
}
