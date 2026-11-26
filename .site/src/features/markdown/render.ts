/**
 * `renderObsidian` (ADR-0004): one Obsidian Markdown document → accessible HTML, built on Astro's own Markdown
 * processor (CommonMark, GFM, Shiki) plus this module's plugins, in this order:
 *   remark-math → math guard (Obsidian's `$` rule) → comments removed → embeds → links/highlights → callouts
 *   → headings → collect → math typeset → HTML (Shiki highlights code at build time).
 * The order is hidden here; callers only pass a `RenderContext`.
 *
 * A fresh processor per document keeps each render's state apart (renders may run in parallel); Astro caches
 * the Shiki highlighter, so this costs little.
 */
import { createMarkdownProcessor, parseFrontmatter, type RemarkPlugin } from "@astrojs/markdown-remark";
import remarkMath from "remark-math";
import { remarkCallouts } from "./plugins/callouts.ts";
import { remarkEmbeds } from "./plugins/embeds.ts";
import { plainText, remarkHeadings } from "./plugins/headings.ts";
import { remarkMathGuard, remarkMathRender } from "./plugins/math.ts";
import { PLUGIN_BLOCKS, remarkComments, remarkObsidianInline } from "./plugins/obsidian-inline.ts";
import { walk } from "./tree.ts";
import type { MdNode, RenderContext, RenderResult, RenderState } from "./types.ts";

/**
 * Renders one Obsidian-flavoured Markdown document to accessible HTML.
 * Never throws for content problems: every problem is returned in `issues`
 * with a 1-based line/column in the ORIGINAL source (frontmatter lines included).
 * Pure apart from calling ctx functions; safe to run in parallel.
 */
export async function renderObsidian(source: string, ctx: RenderContext): Promise<RenderResult> {
  const state: RenderState = { ctx, source: prepare(source), issues: [], sections: [], figureCount: 0, footnoteCount: 0, plainText: "" };
  const processor = await createMarkdownProcessor({
    gfm: true,
    smartypants: false, // as in Obsidian: "--flag" and straight quotes stay as written
    syntaxHighlight: { type: "shiki", excludeLangs: [...PLUGIN_BLOCKS] },
    // Both themes as CSS variables (--shiki-light, --shiki-dark); the reader's stylesheet picks one per theme.
    shikiConfig: { themes: { light: "github-light", dark: "github-dark" }, defaultColor: false },
    remarkPlugins: [
      remarkMath,
      withState(remarkMathGuard, state),
      withState(remarkComments, state),
      withState(remarkEmbeds, state),
      withState(remarkObsidianInline, state),
      withState(remarkCallouts, state),
      withState(remarkHeadings, state),
      withState(remarkCollect, state),
      withState(remarkMathRender, state),
    ],
  });
  const { code } = await processor.render(state.source);
  return {
    html: code,
    sections: state.sections,
    footnoteCount: state.footnoteCount,
    figureCount: state.figureCount,
    plainText: state.plainText,
    issues: state.issues.sort((a, b) => (a.line ?? 0) - (b.line ?? 0) || (a.column ?? 0) - (b.column ?? 0)),
  };
}

/** A plugin and this render's state, typed for Astro's list (our plugins use a minimal local tree type). */
function withState(plugin: (state: RenderState) => (tree: MdNode) => void, state: RenderState): [RemarkPlugin, RenderState] {
  return [plugin as unknown as RemarkPlugin, state];
}

/** Frontmatter blanked, keeping every line where it was. Broken frontmatter is the vault's to report. */
function prepare(source: string): string {
  const text = source.replace(/\r\n?/g, "\n");
  let body = text;
  try {
    body = parseFrontmatter(text, { frontmatter: "empty-with-lines" }).content;
  } catch {
    // Invalid YAML: MOD-vault reports E-FRONTMATTER-YAML; render the rest as it stands.
  }
  return body;
}

/** Counts footnotes and gathers the plain text, before math is typeset (so formulas count as written). */
function remarkCollect(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (node) => {
      if (node.type === "footnoteDefinition") state.footnoteCount++;
    });
    state.plainText = readable(tree).replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
  };
}

/** Node types whose children are blocks, so their texts are separate lines, not run together. */
const BLOCKS = new Set(["root", "list", "listItem", "blockquote", "callout", "table", "footnoteDefinition"]);
/** Node types that hold one line of inline content. */
const LINES = new Set(["paragraph", "heading", "tableCell", "calloutTitle"]);

/** The text a reader sees: no section numbers or raw HTML (figures), code and math as written. */
function readable(node: MdNode): string {
  if (node.type === "sectionNumber" || node.type === "html") return "";
  if (node.type === "break") return "\n";
  if (node.type === "code") return `${node.value ?? ""}\n`;
  if (!node.children) return plainText(node);
  const inner = node.children.map(readable);
  if (BLOCKS.has(node.type)) return `${inner.join("\n")}\n`;
  if (node.type === "tableRow") return `${inner.map((c) => c.trim()).join(" ")}\n`;
  return LINES.has(node.type) ? `${inner.join("")}\n` : inner.join("");
}
