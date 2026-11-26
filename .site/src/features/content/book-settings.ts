/**
 * The book's settings (REQ-CNT-011): `book.md` at the vault root holds the title, subtitle, author, portfolio
 * address and hero image in its frontmatter, and the homepage pitch as its body, so the author changes them in
 * Obsidian, not in code. Without it the build stops (E-BOOK-MISSING).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { BuildIssue } from "../site/index.ts";
import { readFrontmatter } from "./schemas.ts";

/** The settings every page uses (header, homepage hero, footer). */
export type BookSettings = {
  title: string;
  subtitle?: string;
  author: string;
  /** Always an https:// address (REQ-CNT-011.AC3). */
  authorUrl: string;
  /** File name of the hero diagram's light image; its dark partner is found by the diagrams module. */
  heroImage?: string;
  /** The body of book.md, as Markdown; rendered into the homepage pitch by the loader (T-01.14). */
  pitchMarkdown: string;
};

const EXAMPLE = ["---", 'title: "System Design from First Principles"', 'author: "Your Name"', "author_url: https://example.com/", "---", "One paragraph about the book."].join("\n");

/** Reads `<root>/book.md`. `settings` is undefined when the file is missing or a required field is wrong. */
export function readBookSettings(root: string): { settings?: BookSettings; issues: BuildIssue[] } {
  if (!existsSync(join(root, "book.md"))) {
    return {
      issues: [
        {
          severity: "error",
          code: "E-BOOK-MISSING",
          file: "book.md",
          message: "book.md is missing at the vault root. Create it with at least a title and an author.",
          fix: `Create book.md with at least a title, an author and author_url. Example:\n${EXAMPLE}`,
        },
      ],
    };
  }
  const { data, body, issues } = readFrontmatter(readFileSync(join(root, "book.md"), "utf8"), "book.md", "book");
  if (!data) return { issues };
  const settings: BookSettings = { title: data.title, author: data.author, authorUrl: data.author_url, pitchMarkdown: body.trim() };
  if (data.subtitle) settings.subtitle = data.subtitle;
  if (data.hero_image) settings.heroImage = data.hero_image;
  return { settings, issues };
}
