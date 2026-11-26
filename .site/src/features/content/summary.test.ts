import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readingMinutes, summaryOf } from "./summary.ts";

const chapter1 = readFileSync(join(import.meta.dirname, "../../../tests/fixtures/vault/part-1_foundations/chapter-1_computer-architecture.md"), "utf8");

describe("summaries", () => {
  // @req REQ-CNT-008.AC1
  it("summarises Chapter 1, which has no description, from its first paragraph", () => {
    expect(summaryOf(chapter1)).toMatch(/^Before we can learn how to design large-scale distributed system/);
  });

  // @req REQ-CNT-008.AC2
  it("cuts a 500-character first paragraph to at most 200 characters, at a word boundary, ending in …", () => {
    const words = Array.from({ length: 100 }, (_, i) => `word${i % 10}`).join(" "); // 599 characters
    const paragraph = words.slice(0, 500).trimEnd();
    expect(paragraph.length).toBeGreaterThanOrEqual(499);
    const summary = summaryOf(paragraph);
    expect(summary.length).toBeLessThanOrEqual(200);
    expect(summary.endsWith("…")).toBe(true);
    const kept = summary.slice(0, -1);
    expect(paragraph.startsWith(kept)).toBe(true);
    expect(paragraph[kept.length]).toBe(" "); // the cut falls between words
  });

  it("uses the description as written when there is one", () => {
    expect(summaryOf(chapter1, "  The four parts every system is built from. ")).toBe("The four parts every system is built from.");
  });

  it("skips headings, embeds, lists, quotes, code and comments, and reads Obsidian syntax as plain words", () => {
    const md = [
      "---",
      "title: X",
      "---",
      "# Heading",
      "",
      "![[01-light.svg]]",
      "",
      "%%a private note%%",
      "",
      "- a list",
      "",
      "> [!note] a callout",
      "",
      "```js",
      "const x = 1;",
      "",
      "```",
      "",
      "See [[chapter-2_memory|Chapter 2]] and **bold**, *italic*, ==marked==, `code`, [a link](https://x.y) and $\\mu s$.[^1]",
    ].join("\n");
    expect(summaryOf(md)).toBe("See Chapter 2 and bold, italic, marked, code, a link and \\mu s.");
  });

  it("is empty when there's no paragraph, and keeps a short one whole", () => {
    expect(summaryOf("# Only a heading\n\n![[x.svg]]")).toBe("");
    expect(summaryOf("Short.")).toBe("Short.");
  });

  it("never splits a word: a 199-character word is cut back, not broken", () => {
    const summary = summaryOf(`${"a".repeat(150)} ${"b".repeat(100)}`);
    expect(summary).toBe(`${"a".repeat(150)}…`);
  });
});

describe("reading time", () => {
  // @req REQ-CNT-009.AC1
  it("gives a 700-word chapter 4 minutes (700 / 230, rounded up)", () => {
    const text = Array.from({ length: 700 }, (_, i) => `word${i}`).join(" ");
    expect(readingMinutes(text)).toBe(4);
  });

  it("is at least 1 minute, and doesn't count frontmatter, comments, embeds or bare symbols", () => {
    expect(readingMinutes("")).toBe(1);
    const words = Array.from({ length: 230 }, () => "word").join(" ");
    expect(readingMinutes(`---\ntitle: a b c\n---\n${words}\n%%${words}%%\n![[01-light.svg]] - — |`)).toBe(1);
    expect(readingMinutes(`${words} one`)).toBe(2);
  });
});
