# Design preview: System Design from First Principles (website)
Approved at Gate GD on 2026-11-26. A picture of the finished product, not code to build on. Only `design/tokens.json` carries over into the build.

## How to open it
Double-click `index.html`, or open it in any modern browser. It's one self-contained file (about 880 KB) with no network access: fonts, your two diagrams and the math are all inside it.
- Top bar: pick a **screen**, a **state**, a **width** (laptop 1280 px, phone 375 px, or both side by side) and a **theme** (light or dark; it starts from your system setting).
- Everything inside the frames is clickable: links move between screens, diagrams open full screen, "Sections" opens the phone menu, footnote numbers open margin notes, ← and → work on Chapter 1, and Escape closes overlays.
- Items marked **Sample** are placeholders, not your content.

To rebuild after a change: `node design/preview/src/build.cjs <vault-root> <package-root> design/preview/index.html` (needs the fonts and katex from npm; see `src/build.cjs`).

## What it shows
| Screen or sample | Spec in design/screens/ | Requirements | States shown |
|---|---|---|---|
| Home | home.md | REQ-HOME-001…004, REQ-SITE-001, 002, 008 | default; no featured chapters ("Start here"); no articles; no hero image |
| Chapter 1 (real text and diagrams) | chapter.md | REQ-READ-001…008, REQ-DIAG-001…004, REQ-BOOK-003, 005, REQ-CNT-005, 009 | default; with epigraph + margin note (sample); JavaScript off; last chapter; phone section sheet; diagram viewer; scrollspy |
| Contents | contents.md | REQ-BOOK-001, 004, REQ-ART-003 | default; no published chapters |
| Article (sample) | article.md | REQ-ART-001, REQ-READ-006, 009 | default; undated |
| All articles (samples) | articles.md | REQ-ART-002 | default (grouped by year); empty |
| About (placeholder text) | about.md | REQ-SITE-003 | default |
| 404 and redirect page | not-found.md | REQ-SITE-004, REQ-BOOK-007 | not found; old address (redirect page) |
| Build report | (no screen; J5) | REQ-CNT-007, REQ-SITE-007, REQ-DIAG-004 | today's vault (publishes, 2 caption warnings); a sample typo that blocks publishing |

Real facts used: Chapter 1's text exactly as written (186 words → "1 min read"), section numbers 1.1–1.3, its two diagrams in both themes, alt text taken from the SVGs' own text, and KaTeX 0.19.1 MathML for `\frac{1}{10^3}`, `\mu s` and `\approx \frac{1}{10^6}`.

## Journeys
1. J1: Home → "Read from the start" → Chapter 1 → diagram full screen → Next (sample) / last-chapter state.
2. J2: Home → featured chapter card → chapter menu (laptop panel, phone sheet) → Contents → a section link.
3. J3: Home → article row → Article → "All articles" (default and empty).
4. J6: Header name → About → portfolio link (a notice, since the preview has no network).
5. 404 → "Read from the start"; redirect page state.
6. J5: Build report, today's vault and a sample error.

## Not shown
- Things you can't see: page metadata and sharing tags (REQ-SITE-005), the base path in addresses (REQ-SITE-013, shown only on the redirect example), lazy loading and layout stability (REQ-DIAG-005), and drawing sources being gitignored (REQ-DIAG-006).
- Real browser behaviour the preview imitates: the theme follows your system in the real site (the toolbar simulates it), and zoom in the real viewer also supports pinch and the mouse wheel (the preview has +/− buttons only).
- Chapters 2–4, Parts II–III and all articles are samples. Their pages aren't drawn.
- Reduced-motion handling (REQ-READ-002): the preview has no animations at all.

## Changes made at Gate GD
None: approved as built. Fixes made during self-review before GD: small diagrams are no longer upscaled (REQ-DIAG-002.AC2); keyboard previous/next and the redirect page were added so every user-facing requirement appears.
