# Modules: System Design from First Principles (website)

All code lives in `.site/` (ADR-0002). Each module is a folder under `.site/src/features/` with one public `index.ts`; nothing imports another module's internals (enforced by dependency-cruiser, TOOL-06). Signatures are in `specs/contracts/interfaces.md`.

Dependency direction (no cycles): `site ← book ← vault → obsidian-markdown → diagrams`; `home`, `articles` and `reader` depend on `vault`, `book`, `diagrams` (figure component only) and `site`; `home` may also use `articles` (`<ArticleRow>`), never the reverse; `src/pages` depends on features only.

## MOD-vault
- Purpose: turn the Obsidian vault into a validated, ordered `Book` with chapters, articles and pages, ready to render.
- Interface: `vaultLoader(options)` (the Astro content loader registered in `content.config.ts`); `getBook(): Promise<Book>`; `getArticles(): Promise<Article[]>`; `getPage(slug): Promise<Page | undefined>`.
- Hides: which folders and file names count as content; the `part-<n>_` / `chapter-<n>_` naming rules; frontmatter schemas and defaults; draft filtering; title derivation; summary extraction; reading-time rules; the vault file index; how and when Markdown is rendered (Astro loader details).
- Depends on: MOD-obsidian-markdown (`renderObsidian`), MOD-site (`url()`, the build-issue collector, `stopOnErrors`, `buildRun`), Astro content layer, `astro/zod`. MOD-diagrams' figure renderer is handed in by `content.config.ts` (CR-0008).
- Owns data: the Astro content store collections `chapters`, `articles`, `pages`, `book` (build-time only).
- Serves: REQ-CNT-001, REQ-CNT-002, REQ-CNT-003, REQ-CNT-004, REQ-CNT-007, REQ-CNT-008, REQ-CNT-009, REQ-CNT-011, REQ-ART-003, REQ-HOME-002 (featured flags), REQ-HOME-003 (ordering data)
- Paths: .site/src/features/content/**, .site/src/content.config.ts
- Failure and scaling: every problem becomes a `BuildIssue` (never a thrown stack trace to the author); one pass over the vault per build; the file index is built once and shared.
- Decision: ADR-0003

## MOD-obsidian-markdown
- Purpose: render one Obsidian-flavoured Markdown string to accessible HTML, with its headings, footnotes and issues; general-purpose, with no book knowledge.
- Interface: `renderObsidian(source: string, ctx: RenderContext): Promise<RenderResult>` where `RenderContext` gives the file path, a `resolveFile(name, fromPath)` function, a `resolveNote(target)` link function, a `headingNumbers` option (`{ prefix: "1" } | false`) and a `figure` renderer; `RenderResult` is `{ html, headings, footnotes, issues, plainText }`.
- Hides: the remark/rehype plugin list and order; wikilink and embed parsing; diagram-pair grouping of consecutive embeds; callout, highlight and comment syntax; footnote → margin-note markup; heading demotion and numbering; KaTeX rendering and error positions; Shiki configuration.
- Depends on: @astrojs/markdown-remark (or unified directly, see ADR-0003 fallback), remark-math, katex, unist-util-visit (heading slugs are our own `slugify()`, CR-0001). MOD-diagrams is reached only through the `figure` renderer passed in `ctx` (dependency inversion at the boundary).
- Owns data: none.
- Serves: REQ-CNT-005, REQ-CNT-006, REQ-CNT-007 (positions), REQ-READ-004, REQ-READ-006 (markup), REQ-READ-008, REQ-DIAG-001 (pair grouping), REQ-DIAG-004 (alias), REQ-DIAG-007 (drawing embeds)
- Paths: .site/src/features/markdown/**
- Failure and scaling: an unknown math command, a missing embed or an unresolvable wikilink becomes an issue with line and column; rendering is pure and per-file, so it parallelises.
- Decision: ADR-0004, ADR-0008

## MOD-diagrams
- Purpose: make every diagram look right: one themed figure per pair, correctly sized, accessible, served from the site, and viewable full screen.
- Interface: `createFigureRenderer(index: DiagramIndex): FigureRenderer` (passed to MOD-obsidian-markdown); `getDiagramIndex(vaultRoot): Promise<DiagramIndex>`; the `<DiagramFigure>` Astro component (for the home hero); the route helper `diagramAssetPaths()` used by `src/pages/diagrams/[...file].ts`; the client module `diagram-viewer.ts`.
- Hides: both pair-naming rules (`-light`/`-dark` and the plugin's `.light`/`.dark`); reading `viewBox` sizes; extracting alt text from the SVG's own `<text>` elements; refusing drawing-source embeds; hashed asset file names; `<picture>` + `prefers-color-scheme` markup; the zoom library.
- Depends on: @panzoom/panzoom (client only), MOD-site (`url()`).
- Owns data: the diagram asset routes `/diagrams/<hash>-<name>.svg`.
- Serves: REQ-DIAG-001, REQ-DIAG-002, REQ-DIAG-003, REQ-DIAG-004, REQ-DIAG-005, REQ-DIAG-006, REQ-DIAG-007, REQ-HOME-001 (AC3)
- Paths: .site/src/features/diagrams/**, .site/src/pages/diagrams/**, .gitignore (drawing rule)
- Failure and scaling: a missing partner falls back to single-variant display (REQ-DIAG-001.AC4); SVG metadata is cached per file per build; the viewer script loads only on pages with figures.
- Decision: ADR-0005, ADR-0012

## MOD-book
- Purpose: everything about moving through the book in order.
- Interface: `contentsOf(book): ContentsPart[]`; `neighbours(book, chapterId): { previous?: Chapter; next?: Chapter }`; `firstChapter(book): Chapter | undefined`; `romanNumeral(n): string`; components `<Contents>`, `<PrevNext>`.
- Hides: ordering across parts; the first/last chapter special cases; Roman numerals; which sections appear as contents sub-items.
- Depends on: MOD-vault (types only), MOD-site (`url()`).
- Owns data: none.
- Serves: REQ-BOOK-001, REQ-BOOK-003, REQ-BOOK-004, REQ-CNT-004 (AC1), REQ-HOME-001 (AC2)
- Paths: .site/src/features/book/**
- Failure and scaling: pure functions over the in-memory book.
- Decision: ADR-0009

## MOD-reader
- Purpose: the calm reading page for chapters, articles and the About page.
- Interface: components `<ReaderLayout kind="chapter" | "article" | "page">`, `<ChapterTitle>`, `<Epigraph>`, `<ChapterMenu>`; client modules `chapter-menu.ts`, `margin-notes.ts`, `keyboard-nav.ts`.
- Hides: the three-zone grid and its breakpoint; margin-note placement (CSS floats) and the narrow-screen toggle; the scrollspy; arrow-key rules (focus and modifier checks); reduced-motion handling.
- Depends on: MOD-vault (types), MOD-book (`neighbours`, `<PrevNext>`), MOD-diagrams (viewer script inclusion), MOD-site (layout, `url()`).
- Owns data: none.
- Serves: REQ-READ-001, REQ-READ-002, REQ-READ-003, REQ-READ-005, REQ-READ-006 (layout and behaviour), REQ-READ-007, REQ-READ-009, REQ-BOOK-005
- Paths: .site/src/features/reader/**
- Failure and scaling: every script is optional (NFR-004); scripts are deferred modules.
- Decision: ADR-0006

## MOD-home
- Purpose: the homepage: book hero, featured chapters, latest articles.
- Interface: component `<HomePage book articles>`; pure `selectFeaturedChapters(book)`, `selectLatestArticles(articles)`.
- Hides: the 6-card and 5-row limits; the "Start here" fallback; the featured-first ordering.
- Depends on: MOD-vault, MOD-book (`firstChapter`, `contentsOf` counts), MOD-diagrams (`<DiagramFigure>`), MOD-articles (`<ArticleRow>`, shared with the archive), MOD-site.
- Owns data: none.
- Serves: REQ-HOME-001, REQ-HOME-002, REQ-HOME-003, REQ-HOME-004
- Paths: .site/src/features/home/**
- Failure and scaling: no client JS by construction.
- Decision: ADR-0010 (styling); no separate ADR (thin composition).

## MOD-articles
- Purpose: the article page composition and the all-articles archive.
- Interface: components `<ArticlesArchive articles>`, `<ArticleRow article>`, `<ArticleEnd>`; pure `groupByYear(articles)`.
- Hides: year grouping and the "Undated" group; the empty state.
- Depends on: MOD-vault, MOD-reader (`<ReaderLayout kind="article">`), MOD-site.
- Owns data: none.
- Serves: REQ-ART-002, REQ-READ-009 (end links)
- Paths: .site/src/features/articles/**
- Failure and scaling: one static page; 200 articles ≈ 60 KB of HTML.
- Decision: no separate ADR (thin composition).

## MOD-site
- Purpose: what every page shares, plus the one place that knows addresses and the base path.
- Interface: `url(route: Route): string` where `Route` is `{ kind: "home" } | { kind: "contents" } | { kind: "chapter"; slug } | { kind: "articles" } | { kind: "article"; slug } | { kind: "about" } | { kind: "asset"; path }`; `absoluteUrl(route)`; components `<BaseLayout title description route>`, `<SiteHeader>`, `<SiteFooter>`, `<NotFound>`; `BuildIssues` collector (`add`, `summary`, `hasErrors`); the Astro integration `buildReport()` that prints the summary and fails the build; the generated `tokens.css`.
- Hides: Astro's `base` and `site` configuration; route shapes (contracts/routes.md); redirect pages from `moved_from` and their clash rules; `<head>` metadata, Open Graph, canonical and CSP meta; sitemap configuration; how tokens become CSS custom properties.
- Depends on: @astrojs/sitemap, design/tokens.json (through the token build tool).
- Owns data: the route table; the issue collector.
- Serves: REQ-BOOK-002, REQ-BOOK-007, REQ-ART-001, REQ-SITE-001, REQ-SITE-002, REQ-SITE-003, REQ-SITE-004, REQ-SITE-005, REQ-SITE-007, REQ-SITE-008, REQ-SITE-013
- Paths: .site/src/features/site/**, .site/src/pages/**, .site/astro.config.ts, .github/workflows/**
- Failure and scaling: a link check over `dist/` fails the build on any internal link without the base path (REQ-SITE-013).
- Decision: ADR-0007, ADR-0011

## MOD-authoring
- Purpose: the author's side of the system: one command to publish, and the guide and templates for writing (CR-0005).
- Interface: `sync.cmd` (double-click) and `npm --prefix .site run sync`; `WRITING-GUIDE.md`; `templates/chapter.md`, `templates/article.md`, `templates/book.md`, `templates/about.md`.
- Hides: the git steps (pull, add, commit, push); moving Excalidraw's exports into `diagram/`; the freshness rule (images at least as new as their drawing); running the site build before anything is committed.
- Depends on: git and npm on the author's computer; the site build (`npm run build`); the pre-commit hook (gitleaks, boundaries).
- Owns data: none (it moves the author's exported images; it never edits chapter text).
- Serves: REQ-AUTH-001, REQ-AUTH-002, REQ-AUTH-003
- Paths: .site/tools/sync.ts, sync.cmd, WRITING-GUIDE.md, templates/**
- Failure and scaling: stops before committing at the first problem; every message says what to do next.
- Decision: ADR-0012, CR-0005
