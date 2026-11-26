# Data model: System Design from First Principles (website)

There's no database. All data lives in the author's Markdown files, and the build holds it in memory as the typed values below. It's read-only at runtime (static HTML). Personal data: the author's own name and portfolio address, published by choice. No reader data is collected (NFR-008).

## Source files (the author's, never rewritten)
| File | Becomes | Schema |
|---|---|---|
| `book.md` | `BookSettings` + pitch | contracts/frontmatter.schema.json `#/$defs/book` |
| `about.md` | `Page` (slug `about`) | `#/$defs/page` |
| `part-<n>_<slug>/` | `Part` | folder name rules (REQ-CNT-001) |
| `part-<n>_<slug>/chapter-<n>_<slug>.md` | `Chapter` | `#/$defs/chapter` |
| `articles/<slug>.md` | `Article` | `#/$defs/article` |
| `**/*.svg` (inside part folders and `articles/`) | `Diagram` | `-light`/`-dark` or `.light`/`.dark` naming (REQ-DIAG-001); alt text from the SVG's `<text>` elements |
| `**/*.excalidraw.md`, `**/*.excalidraw` | nothing: drawing sources are gitignored and never read by the build (REQ-DIAG-006) | — |
| `part-*/excalidraw/<name>.excalidraw.{light,dark}.svg` | moved by sync to `part-*/diagram/<name>-{light,dark}.svg`, the images a drawing embed resolves to (REQ-AUTH-002, REQ-DIAG-007) | — |
| everything else | ignored | REQ-CNT-003 |

## Build-time types
```ts
type BookSettings = { title: string; subtitle?: string; author: string; authorUrl: string /* https only */; heroImage?: string /* file name */; pitchHtml: string };

type Book = { settings: BookSettings; parts: Part[]; chapters: Chapter[] /* book order, published only */; totalReadingMinutes: number };

type Part = { number: number; romanNumeral: string; slug: string; title: string; chapters: Chapter[] };

type Section = { depth: 2 | 3; text: string; anchor: string; number?: string /* "1.2" or "1.2.1"; chapters only */ };

type EntryBase = {
  slug: string;              // from the file name without number and extension; the public address key
  title: string;             // frontmatter title, else derived from the slug (REQ-CNT-002)
  summary: string;           // description, else first paragraph ≤ 200 chars (REQ-CNT-008)
  readingMinutes: number;    // ceil(words / 230), min 1 (REQ-CNT-009)
  featured: boolean;
  movedFrom: string[];       // old slugs that get redirect pages (REQ-BOOK-007)
  sourcePath: string;        // vault-relative, for messages
  html: string;              // rendered body
  sections: Section[];
  hasFootnotes: boolean;
  hasDiagrams: boolean;
};
type Chapter = EntryBase & { kind: "chapter"; number: number; part: Pick<Part, "number" | "romanNumeral" | "title" | "slug">; epigraph?: { text: string; source?: string } };
type Article = EntryBase & { kind: "article"; date?: string /* ISO yyyy-mm-dd */ };
type Page    = EntryBase & { kind: "page" };

type Diagram = { name: string; light?: AssetRef; dark?: AssetRef; width: number; height: number /* from viewBox */; altFromSvgText?: string };
type AssetRef = { sourcePath: string; publicPath: string /* /diagrams/<hash>-<name>.svg */ };

type BuildIssue = { severity: "error" | "warning"; code: string /* contracts/build-messages.md */; file: string; line?: number; column?: number; message: string; fix: string };
```

## Invariants
- Chapter numbers are unique across the book (REQ-CNT-001.AC3). Slugs are unique within chapters and within articles.
- Drafts never appear in `Book.chapters`, `Part.chapters`, article lists, sitemaps or routes (REQ-CNT-004).
- A `Part` with no published chapters is left out of `Book.parts`.
- Dates are calendar dates without time zones, shown in en-GB form ("1 November 2026"). The build year (footer) is computed in UTC.

## Retention and deletion
Deleting or drafting a file removes it from the site on the next publish. Git history keeps old versions on GitHub, which is public (CNF-003, accepted). Drawing sources are never in git: the author's own backup is their only copy (CNF-007, accepted).
