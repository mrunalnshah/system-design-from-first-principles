/**
 * Test helpers for this module's tests (not part of the public interface): a render context like the loader's,
 * and golden-file comparison. Kept apart from the *.test.ts files so importing them doesn't repeat any tests.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { renderObsidian } from "./render.ts";
import { createFileResolver } from "./resolve.ts";
import type { RenderContext } from "./types.ts";

const fixtures = join(import.meta.dirname, "../../../tests/fixtures/markdown");
export const CHAPTER_1 = { href: "/system-design-from-first-principles/book/computer-architecture/", title: "Computer Architecture" };

/** A context like the loader's: Chapter 1 is published, figures are stubbed (MOD-diagrams draws them). */
export function context(over: Partial<RenderContext> = {}): RenderContext {
  return {
    filePath: "articles/why-caches.md",
    resolveFile: createFileResolver(["part-1_foundations/diagram/01-light.svg", "part-1_foundations/diagram/01-dark.svg"]),
    resolveNote: (t) => (t === "chapter-1_computer-architecture" ? CHAPTER_1 : undefined),
    headingNumbers: false,
    figure: ({ files, alias }) => ({ html: `<figure data-files="${files.join(" ")}">${alias ?? ""}</figure>`, issues: [] }),
    ...over,
  };
}

/** Golden test: `<name>.html` next to `<name>.md`. Run with UPDATE_GOLDEN=1 to rewrite it, then review the diff. */
export async function golden(name: string, ctx: RenderContext): Promise<{ html: string; expected: string }> {
  const { html } = await renderObsidian(readFileSync(join(fixtures, `${name}.md`), "utf8"), ctx);
  const file = join(fixtures, `${name}.html`);
  if (process.env.UPDATE_GOLDEN || !existsSync(file)) writeFileSync(file, html);
  return { html, expected: readFileSync(file, "utf8").replace(/\r\n/g, "\n") };
}
