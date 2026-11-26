# Screen: Chapter `/book/<chapter-slug>/`
Requirements: REQ-READ-001…008, REQ-DIAG-001…005, REQ-BOOK-002, 003, 005, REQ-CNT-005, 006, 009, REQ-SITE-001, 002, 005 · Journeys: J1, J2, J4 · Layout is a **proposal** until GD.

## Layout
Wide (≥ 1100 px), three zones:
- **Left: ChapterMenu** (15 rem, sticky), with the book title (link to the contents), "Chapter 1", the section list (1.1 Components, 1.1.1 Disk, …) with the current one highlighted, and Previous/Next at the bottom.
- **Centre: reading column** (42 rem). ChapterTitle (big faint "1" to the left of the `h1`), "Part I · Foundations · 4 min read", the Epigraph if any, then Prose with NumberedHeadings, MathInline/MathBlock and Figures. Figures break out of the column to up to 900 px, centred on the column.
- **Right: margin** (15 rem) for MarginNotes, level with their references.
- At the end: PrevNext, then SiteFooter.

Tablet and phone (< 1100 px): one column. The ChapterMenu becomes a "Sections" button in a slim top bar that stays in view, opening a sheet. MarginNotes become tap-to-open markers. Figures are full width with 16 px gutters.

## States
| State | What shows |
|---|---|
| Default | As above (Chapter 1 is the real fixture) |
| No epigraph | Title, then text directly (REQ-READ-005.AC2) |
| No footnotes | The margin column stays empty; the text column doesn't move |
| First chapter | PrevNext: "Contents" + "Next" (REQ-BOOK-003.AC2) |
| Last chapter | PrevNext: "Previous" + "Back to contents" (REQ-BOOK-003.AC3) |
| Loading | Text paints at once; diagram space is reserved (REQ-DIAG-005); diagrams below the first screen load lazily |
| JavaScript off | The section list is a plain list under the title; notes are an end list; diagrams link to the SVG; theme and math still work (NFR-004) |
| Error | A missing diagram can't reach the reader: it's a build error (REQ-CNT-006.AC2) |
| Long text | Long titles wrap beside the big number; long section names wrap in the menu; wide tables and display math scroll inside their own box |
| Offline / No permission | As Home |

## Interactions
- Scrolling highlights the current section in the ChapterMenu (REQ-READ-007.AC1).
- ← and → open the previous and next chapters (REQ-BOOK-005).
- Selecting a Figure opens the DiagramViewer (REQ-DIAG-003). Escape closes it.
- Hovering over or focusing a heading reveals its anchor link (REQ-READ-004.AC3).

## Acceptance
REQ-READ-001…008 ACs, REQ-DIAG-001…005 ACs, REQ-BOOK-002.AC1–AC3, REQ-BOOK-003.AC1–AC3, REQ-BOOK-005.AC1–AC2.
