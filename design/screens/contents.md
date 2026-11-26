# Screen: Contents `/book/`
Requirements: REQ-BOOK-001, 004, REQ-ART-003, REQ-CNT-001, 004 · Journeys: J2, J4 · Layout is a **proposal** until GD.

## Layout
- SiteHeader, then the title "Contents" (`h1`, sans), then the book title and "N chapters · M min" in muted text.
- For each part: ContentsPart "I. Foundations" (sans, uppercase small caps, accent numeral), then an ordered list of ContentsChapter rows: "1." in muted text, the title as a link (sans, medium), the reading time on the right, and the sub-sections as small links underneath.
- One column at reading width, centred. The same on phone, with reading times moving under the titles.
- SiteFooter.

## States
| State | What shows |
|---|---|
| Default | Parts and chapters |
| Empty: no published chapters | "The first chapter is on its way." plus a link to All articles. Build warning |
| Part with only drafts | Part not shown (REQ-BOOK-001.AC2) |
| Loading | Static HTML |
| Error | None at runtime |
| Long text | Long chapter titles wrap with a hanging indent under the number |
| Offline / No permission | As Home |

## Interactions
Chapter titles open the chapter; sub-items open it at the section (REQ-BOOK-001.AC3).

## Acceptance
REQ-BOOK-001.AC1–AC3, REQ-BOOK-004.AC1, REQ-ART-003.AC1.
