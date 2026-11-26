# Contract: module interfaces

The public surface of each module (`index.ts`). Types are in specs/data-model.md. Interface comments say what callers need to know: intent, units and invariants. Nothing else is exported.

## MOD-obsidian-markdown (`.site/src/features/markdown/index.ts`)
```ts
/**
 * Renders one Obsidian-flavoured Markdown document to accessible HTML.
 * Never throws for content problems: every problem is returned in `issues`
 * with a 1-based line/column in the ORIGINAL source (frontmatter lines included).
 * Pure apart from calling ctx functions; safe to run in parallel.
 */
export function renderObsidian(source: string, ctx: RenderContext): Promise<RenderResult>;

/** Obsidian's lookup for `![[name]]` over the vault's files: the match closest to `fromPath` wins (REQ-CNT-006; CR-0006). */
export function createFileResolver(paths: readonly string[]): (name: string, fromPath: string) => string | undefined;
/** The heading-anchor rule (GitHub's), shared with `[[note#Heading]]` links: "Moore's Law" → "moores-law" (CR-0006). */
export function slugify(text: string): string;

export type RenderContext = {
  filePath: string;                                            // vault-relative, used in issues
  resolveFile(name: string, fromPath: string): string | undefined;  // Obsidian shortest-path lookup (REQ-CNT-006)
  resolveNote(target: string): { href: string; title: string } | undefined; // [[note]] links
  headingNumbers: { prefix: string } | false;                  // "1" → 1.1, 1.1.1 (REQ-READ-004); false for articles
  figure: FigureRenderer;                                      // supplied by MOD-diagrams
};
export type FigureRenderer = (embed: { files: string[] /* 1 or 2 consecutive SVG embeds */; alias?: string; fromPath: string; line: number }) =>
  { html: string; issues: BuildIssue[] };
export type RenderResult = { html: string; sections: Section[]; footnoteCount: number; figureCount: number; plainText: string; issues: BuildIssue[] };
```

## MOD-diagrams (`.site/src/features/diagrams/index.ts`)
```ts
/** Scans the vault once and indexes every SVG in the part folders and articles/ (never a drawing source). Cached per build; `DiagramIndex` carries its vault `root`. */
export function getDiagramIndex(vaultRoot: string): Promise<DiagramIndex>;
/** An index built from given SVG texts (path → text), for tests. */
export function indexOf(svgs: Record<string, string>): DiagramIndex;
/** Returns the renderer MOD-obsidian-markdown calls for SVG embeds. Groups light/dark pairs into one figure. */
export function createFigureRenderer(index: DiagramIndex): FigureRenderer;
/** Static paths for every referenced diagram asset, i.e. one a figure has drawn (used by src/pages/diagrams/[...file].ts; CR-0007). */
export function diagramAssetPaths(index: DiagramIndex): { params: { file: string }; props: { sourcePath: string } }[];
export { default as DiagramFigure } from "./DiagramFigure.astro"; // props: { file: string; alt?: string; eager?: boolean }; its problems go to the build report
// client: import "…/diagrams/client/diagram-viewer" (auto-binds to [data-diagram] figures)
```

## MOD-vault (`.site/src/features/content/index.ts`)
```ts
/** Astro content loader for the vault one folder above .site/. Registers chapters, articles, pages and book. */
export function vaultLoader(options: { vaultRoot: string }): Loader;
/** The published book in reading order. Drafts are never included. */
export function getBook(): Promise<Book>;
/** Published articles: featured first, then newest first, then undated. */
export function getArticles(): Promise<Article[]>;
export function getPage(slug: "about"): Promise<Page | undefined>;
```

## MOD-book (`.site/src/features/book/index.ts`)
```ts
export function contentsOf(book: Book): ContentsPart[];        // parts → chapters → depth-2 sections
export function neighbours(book: Book, chapterSlug: string): { previous?: Chapter; next?: Chapter };
export function firstChapter(book: Book): Chapter | undefined;
export function romanNumeral(n: number): string;                // 1 → "I"; n in 1..3999
export { default as Contents } from "./Contents.astro";
export { default as PrevNext } from "./PrevNext.astro";
```

## MOD-site (`.site/src/features/site/index.ts`)
```ts
export type Route = { kind: "home" } | { kind: "contents" } | { kind: "chapter"; slug: string } | { kind: "articles" }
  | { kind: "article"; slug: string } | { kind: "about" } | { kind: "asset"; path: string };
/** The only way to build an internal address. Always includes the base path and a trailing slash for pages. */
export function url(route: Route): string;
export function absoluteUrl(route: Route): string;
/** Collects build issues from every module; the build report prints them grouped and fails on any error. */
export const buildIssues: { add(issue: BuildIssue): void; all(): readonly BuildIssue[]; hasErrors(): boolean };
/** A fresh collector of the same shape, for tests (CR-0007). */
export function createIssueCollector(): typeof buildIssues;
/** The vault's absolute path (the folder holding .site/), fixed by astro.config.ts (CR-0007). */
export function vaultRoot(): string;
export function buildReport(): AstroIntegration;
export { default as BaseLayout } from "./BaseLayout.astro";    // props: { title; description; route; ogImage? }
```

## MOD-reader, MOD-home, MOD-articles
Astro components only (props as in specs/modules.md). Client modules are imported by their components and have no exports.
