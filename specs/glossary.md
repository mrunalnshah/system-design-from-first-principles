# Glossary: System Design from First Principles (website)

| Term | Meaning | Name in code |
|---|---|---|
| Vault | The Obsidian folder that holds all content; the single source of truth | `vault` |
| Book | The one book in v1: its title, subtitle, author, pitch and hero diagram, set in `book.md` at the vault root | `Book` |
| Part | A group of chapters, from a folder named `part-<n>_<slug>`; shown with Roman numerals (Part I) | `Part` |
| Chapter | A Markdown file `chapter-<n>_<slug>.md` inside a part folder; numbered continuously across parts | `Chapter` |
| Chapter number | The `<n>` in the chapter file name; unique across the whole book | `chapterNumber` |
| Article | A standalone Markdown file in `articles/`, outside the book | `Article` |
| Page | A standalone Markdown page that's neither chapter nor article: `about.md` | `Page` |
| Entry | Any chapter, article or page; the unit the content module parses | `Entry` |
| Frontmatter | The YAML block at the top of a Markdown file (`title`, `featured`, `draft`, `epigraph`, …) | `frontmatter` |
| Featured | `featured: true` in frontmatter: the chapter appears in "Featured chapters", or the article is pinned to the top of "Latest articles" | `featured` |
| Draft | `draft: true` in frontmatter: the file is not published anywhere, including contents and previous/next | `draft` |
| Published | Not a draft, and inside a part folder, `articles/` or `about.md` | `isPublished` |
| Embed | Obsidian's `![[file]]` syntax that includes another file, usually a diagram | `Embed` |
| Diagram | An SVG embedded in an entry, exported from Excalidraw | `Diagram` |
| Drawing | The Excalidraw source of a diagram (`*.excalidraw.md`); gitignored, never published | `Drawing` |
| Auto-export | The Excalidraw plugin settings "Auto-export SVG" + "Export both light and dark", which write a drawing's SVG pair on every save | — |
| Redirect page | A small page at an old address (from `moved_from`) that sends readers to the current one | `RedirectPage` |
| Diagram pair | Two SVGs with the same base name ending in `-light`/`-dark` (`01-light.svg`) or `.light`/`.dark` (auto-export), shown as one figure that follows the theme | `DiagramPair` |
| Section | A heading inside a chapter; `#` becomes section 1.1, `##` becomes 1.1.1 | `Section` |
| Section number | The automatic number shown beside a chapter heading (`1.2`, `1.2.1`) | `sectionNumber` |
| Margin note | An Obsidian footnote `[^n]` shown in the right margin on wide screens and as a tap-to-open note on phones | `MarginNote` |
| Epigraph | An optional opening quote at the top of a chapter, from `epigraph:` and `epigraph_source:` | `epigraph` |
| Chapter menu | The sticky panel on chapter pages: book title, this chapter's sections, previous/next | `ChapterMenu` |
| Contents | The book's table of contents page | `Contents` |
| Hero | The top of the homepage that presents the book and "Read from the start" | `BookHero` |
| Theme | Light or dark, chosen by the reader's system setting (`prefers-color-scheme`) | `theme` |
| Build | Turning the vault into static HTML files | `build` |
| Publish | A push to GitHub that builds the site and deploys it to the host | `publish` |
| Build error | A problem that stops publishing, such as a broken embed; always names the file, line and fix | `BuildError` |
| Build warning | A problem that publishes anyway, such as a missing optional field | `BuildWarning` |
