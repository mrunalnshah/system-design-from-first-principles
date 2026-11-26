# Screen: Home `/`
Requirements: REQ-HOME-001…004, REQ-SITE-001, 002, 005, 008, 013 · Journeys: J1, J2, J3 · Layout is a **proposal** until GD.

## Layout
Laptop (≥ 1100 px), max 1200 px wide, airy:
1. SiteHeader.
2. BookHero, two columns: left has the title (`h1`, sans, 3xl), subtitle, "by Mrunal Nirajkumar Shah", pitch (serif, 2–4 sentences), "1 chapter · 4 min" and [Read from the start] + "Contents →". Right has the hero diagram on the theme background with no frame.
3. SectionHeading "Featured chapters" + "All chapters →", then ChapterCards in a 3-column grid (2 on tablet, 1 on phone).
4. SectionHeading "Latest articles" + "All articles →", then up to 5 ArticleRows in one column at reading width.
5. SiteFooter.

Phone (320–767 px): one column. The hero stacks title → diagram → pitch → button (full width); cards and rows are full width.

## States
| State | What shows |
|---|---|
| Default | As above |
| Empty: no featured chapters | The section is titled "Start here" and shows the first 3 chapters (REQ-HOME-002.AC2) |
| Empty: no articles | The "Latest articles" section and its link are left out (REQ-HOME-003.AC3) |
| Empty: no hero image | The hero is one column; no gap (REQ-HOME-001.AC4) |
| Loading | Static HTML: text paints at once; the hero diagram's space is reserved by its viewBox |
| Error | None at runtime; build errors stop publishing (REQ-CNT-007) |
| Long text | Titles wrap; card summaries clamp at 3 lines and row summaries at 2 |
| Offline | The browser's own offline page (no service worker in v1) |
| No permission | Not applicable: every page is public |

## Interactions
- "Read from the start" opens the first published chapter. Cards and rows open their entry.
- No JavaScript of its own (REQ-HOME-004).

## Acceptance
REQ-HOME-001.AC1–AC4, REQ-HOME-002.AC1–AC3, REQ-HOME-003.AC1–AC3, REQ-HOME-004.AC1.
