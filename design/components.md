# Components: System Design from First Principles (website)

All visual decisions are **proposals** until Gate GD. Tokens come from `design/tokens.json`. Accessibility target: WCAG 2.2 AA (ASM-001).

| Component | Purpose | Variants | States | Accessibility notes | Used on |
|---|---|---|---|---|---|
| SiteHeader | Book title (home link), "by Mrunal Nirajkumar Shah" (About), Contents, Articles, portfolio link | wide (all inline); narrow < 768 px (title + menu button) | default, menu open, current page | `<header>` + `<nav aria-label="Site">`; `aria-current="page"`; menu button `aria-expanded`; portfolio link has an "external site" label | all |
| SiteFooter | © line, About, portfolio | one | default | `<footer>`; links ≥ 44 px tap height | all |
| BookHero | Title (`h1`), subtitle, author, pitch, hero diagram, "N chapters · M min", Read-from-the-start button, Contents link | with image; without image (REQ-HOME-001.AC4) | default, long title (wraps, max 3 lines) | Button is a link styled as a button; the image has alt text | home |
| PrimaryButton | Main action | default | hover, focus, active | `--on-accent` on `--accent` (≥ 6:1); 2 px focus ring offset 2 px; ≥ 44 px tall | home, 404 |
| ChapterCard | Chapter number, "Part I · Foundations", title, summary (3 lines max), reading time | default | hover (title underline), focus (whole-card ring), long title | Whole card is one link; the title is the link text and the rest is described by it | home |
| ArticleRow | Title, date, summary (2 lines), reading time, optional "Featured" tag | default, featured | hover, focus | One link per row; `<time datetime>` | home, articles |
| SectionHeading | "Featured chapters", "Latest articles" + "All …" link | default | — | `h2` | home |
| ContentsPart | "I. Foundations" + its chapters | default | — | `h2` per part; chapters in an `<ol>` | contents |
| ContentsChapter | Number, title, reading time, sub-section links | default | hover, focus | Nested `<ol>`; sub-items are anchor links | contents |
| ChapterTitle | Big faint chapter number + `h1` title + "Part I · Foundations · 4 min read" | with epigraph; without | long title | The big number is `aria-hidden`; the `h1` reads "Chapter 1: Computer Architecture" through visually hidden text | chapter |
| Epigraph | Opening quote + "— source" | with source; without | long quote | `<figure><blockquote>` + `<figcaption>` | chapter |
| Prose | Rendered Markdown: paragraphs, lists, tables, code, callouts, highlights | chapter (numbered headings); article (no numbers) | — | Body links underlined (accent vs text < 3:1); tables scroll inside a focusable region with a label; code blocks scroll inside | chapter, article, about |
| NumberedHeading | Heading + right-aligned section number + hover/focus anchor link | h2 (1.1), h3 (1.1.1) | hover, focus (anchor icon shows) | The number is part of the heading text, so screen readers hear "1.1 Components"; the anchor link is labelled "Link to this section" | chapter |
| Figure (DiagramFigure) | One themed diagram (`<picture>` with a prefers-color-scheme source), optional caption, select to enlarge | paired (light/dark); single | loading (space reserved by viewBox), focus, missing (build error, never shown) | `<figure>` + `<figcaption>`; alt text from the alias or the Excalidraw text; it's a button that opens the full-screen view; without JS it's a link to the SVG | chapter, article, home hero |
| DiagramViewer | Full-screen zoom and pan view | — | open, zoomed, closing | `<dialog>` with `aria-modal`; focus is trapped; Escape closes; + / − / 0 keys; close button ≥ 44 px; disabled under reduced motion animations | chapter, article |
| MathBlock / MathInline | Build-time typeset math | inline, display | overflow (display scrolls inside its own box) | MathML for screen readers next to the visual HTML | chapter, article |
| MarginNote | Footnote shown in the margin (≥ 1100 px) or inline on tap (< 1100 px) | margin; inline; end-list (no JS) | closed, open (narrow) | The marker is a `<button aria-expanded>` with JS, and a link to the end-list note without it; notes have `role="note"` | chapter, article |
| ChapterMenu | Book title, this chapter's sections with the current one highlighted, previous/next | wide: sticky side panel; narrow: top-bar button + sheet; no JS: plain list under the title | closed, open, current section | `<nav aria-label="Chapter">`; `aria-current="location"` on the current section; the sheet is a `<dialog>`; Escape closes and returns focus | chapter |
| PrevNext | Previous/next chapter with number and title | both; first (Contents + Next); last (Previous + Back to contents) | hover, focus | `<nav aria-label="Chapter navigation">`; `rel="prev"`/`rel="next"` | chapter |
| ArticleMeta | Date · reading time | — | no date (hidden) | `<time datetime>` | article |
| YearGroup | "2026" + its ArticleRows | — | — | `h2` per year | articles |
| EmptyState | Short message + one helpful link | — | — | Plain text, no illustration | articles, home (articles section left out instead) |
| SkipLink | "Skip to content" | — | visible on focus | First focusable element | all |
