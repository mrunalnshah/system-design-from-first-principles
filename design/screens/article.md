# Screen: Article `/articles/<slug>/`
Requirements: REQ-ART-001, REQ-READ-001, 002, 006, 008, 009, REQ-DIAG-001…005, REQ-CNT-005 · Journeys: J3 · Layout is a **proposal** until GD.

## Layout
- SiteHeader, then the reading column (42 rem) centred, with the margin column on the right at ≥ 1100 px. There's no ChapterMenu and no big number.
- "Article" eyebrow (sans, muted, small caps), title (`h1`), ArticleMeta "1 November 2026 · 6 min read", then Prose with **unnumbered** headings, figures and math.
- End: "All articles →" and "Read the book →" (REQ-READ-009), then SiteFooter.
- Phone: one column, with notes as tap-to-open markers.

## States
| State | What shows |
|---|---|
| Default | As above |
| No date | The meta shows only the reading time (REQ-CNT-003.AC3) |
| Loading / JavaScript off / Error / Long text / Offline / No permission | As Chapter |

## Acceptance
REQ-ART-001.AC1, REQ-READ-009.AC1, plus the shared reader and diagram criteria.
