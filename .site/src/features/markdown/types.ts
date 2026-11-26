/**
 * MOD-obsidian-markdown's types (specs/contracts/interfaces.md#mod-obsidian-markdown). Public ones are
 * re-exported from index.ts; the rest are shared by the plugins, which each get one render's `RenderState`.
 */

/**
 * One content problem, shaped exactly like MOD-site's `BuildIssue` (specs/contracts/build-messages.md), so
 * callers add these to the build report unchanged. Declared here because this module depends on no other
 * module of the site (specs/modules.md, TOOL-06): it stays usable for any Obsidian note.
 */
export type BuildIssue = {
  severity: "error" | "warning";
  code: string;
  file: string;
  line?: number;
  column?: number;
  message: string;
  fix: string;
};

/** A heading of the rendered document, for the chapter menu and contents (data-model.md `Section`). */
export type Section = {
  /** 2 for the vault's `#`, 3 for `##` (headings are demoted one level: the page title is the only h1). */
  depth: 2 | 3;
  text: string;
  /** The heading's id, by GitHub's rule (slugify.ts), unique within the document. */
  anchor: string;
  /** "1.2" or "1.2.1" when numbering is on; undefined otherwise. */
  number?: string;
};

/** Renders one diagram figure from 1 or 2 consecutive SVG embeds (a light/dark pair). Supplied by MOD-diagrams. */
export type FigureRenderer = (embed: { files: string[]; alias?: string; fromPath: string; line: number }) => { html: string; issues: BuildIssue[] };

/** Everything the renderer needs to know about the document's surroundings; book rules arrive only through here. */
export type RenderContext = {
  /** Vault-relative path of the document, used in issues and to resolve embeds closest to it. */
  filePath: string;
  /** Obsidian's lookup: the vault path a `![[name]]` refers to, seen from `fromPath`; undefined if none. */
  resolveFile(name: string, fromPath: string): string | undefined;
  /** Where a `[[note]]` link goes and what to call it; undefined when the note isn't published. */
  resolveNote(target: string): { href: string; title: string } | undefined;
  /** `{ prefix: "1" }` numbers `#` as 1.1 and `##` as 1.1.1 (chapters); false leaves headings unnumbered (articles). */
  headingNumbers: { prefix: string } | false;
  figure: FigureRenderer;
};

export type RenderResult = {
  html: string;
  sections: Section[];
  footnoteCount: number;
  figureCount: number;
  /** The words a reader sees (math as written), for search and reading time. */
  plainText: string;
  /** Every content problem, with 1-based line and column in the original source (frontmatter lines included). */
  issues: BuildIssue[];
};

/** One render's shared, mutable state, handed to each plugin as its options. */
export type RenderState = {
  ctx: RenderContext;
  /** The text being parsed (frontmatter and comments blanked, line numbers unchanged). */
  source: string;
  issues: BuildIssue[];
  sections: Section[];
  figureCount: number;
  footnoteCount: number;
  plainText: string;
};

/** The few Markdown-tree (mdast) node fields the plugins use; kept local so no type package is needed. */
export type MdNode = {
  type: string;
  value?: string;
  children?: MdNode[];
  depth?: number;
  url?: string;
  lang?: string | null;
  position?: { start: Point; end: Point };
  data?: { hName?: string; hProperties?: Record<string, unknown>; [key: string]: unknown };
  [key: string]: unknown;
};
export type Point = { line: number; column: number; offset?: number };

/** Calls `visit` on every node, parents before children; `visit` may replace a node's `children` before they're walked. */
export function walk(node: MdNode, visit: (node: MdNode, parent: MdNode | undefined) => void, parent?: MdNode): void {
  visit(node, parent);
  for (const child of node.children ?? []) walk(child, visit, node);
}

/** The line and column `offset` characters into a text node's value, counting its newlines. */
export function positionIn(node: MdNode, offset: number): { line: number; column: number } {
  const start = node.position?.start ?? { line: 1, column: 1 };
  const before = (node.value ?? "").slice(0, offset);
  const lines = before.split("\n");
  return lines.length === 1 ? { line: start.line, column: start.column + offset } : { line: start.line + lines.length - 1, column: lines.at(-1)!.length + 1 };
}
