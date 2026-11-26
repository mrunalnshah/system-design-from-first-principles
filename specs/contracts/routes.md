# Contract: public addresses

Addresses are public: readers bookmark and share them (Hyrum's law). Changing a shape below needs an ADR. Every address is prefixed with the base path `/system-design-from-first-principles/` (written `<base>`), from one setting in MOD-site (REQ-SITE-013). Trailing slashes are always used.

| Route kind | Address | Source | Status |
|---|---|---|---|
| home | `<base>` | `book.md`, entries | 200 |
| contents | `<base>book/` | the book | 200 |
| chapter | `<base>book/<chapter-slug>/` | `chapter-<n>_<chapter-slug>.md` | 200 |
| section | `<base>book/<chapter-slug>/#<heading-anchor>` | heading text via our `slugify()` (GitHub's rule: lowercase, punctuation removed, spaces → `-`, duplicates get `-1`, `-2`) | — |
| articles | `<base>articles/` | `articles/` | 200 |
| article | `<base>articles/<slug>/` | `articles/<slug>.md` | 200 |
| about | `<base>about/` | `about.md` (only if present) | 200 |
| diagram asset | `<base>diagrams/<hash8>-<file-name>.svg` | the SVG file; the hash changes with content | 200, long cache by the CDN's defaults |
| fonts, CSS, JS | `<base>_astro/…` (hashed) | the build | 200 |
| sitemap | `<base>sitemap-index.xml` | the build | 200 |
| redirect | `<base>book/<old-slug>/`, `<base>articles/<old-slug>/` | `moved_from` | 200 with meta refresh, `noindex`, not in sitemap (GitHub Pages can't send 301) |
| not found | `<base>404.html`, served for unknown paths | MOD-site | 404 (CNF-005 checks it live) |

Rules:
- The chapter number is **not** in the address, so renumbering keeps links (REQ-BOOK-002.AC3, ADR-0009).
- Renaming a chapter's slug changes its address. Add the old slug to `moved_from` to keep old links working (REQ-BOOK-007).
- Chapter and article slugs may not be `diagrams`, `_astro` or `404`; the build reports a clash as an error.
