# Screen: All articles `/articles/`
Requirements: REQ-ART-002, REQ-CNT-003, 008, 009 · Journeys: J3 · Layout is a **proposal** until GD.

## Layout
SiteHeader, then the title "Articles" (`h1`) and one line describing them ("Standalone essays outside the book."). Then YearGroups, newest first, each an `h2` year followed by ArticleRows, at reading width. Then SiteFooter. Phone: the same, full width.

## States
| State | What shows |
|---|---|
| Default | Year groups |
| Empty | EmptyState: "No articles yet. Start with the book." → Chapter 1 (REQ-ART-002.AC2) |
| Many (200) | One page, well within the weight budget (REQ-ART-002.AC3) |
| Undated articles | A final group "Undated" |
| Loading / Error / Long text / Offline / No permission | As Home |

## Acceptance
REQ-ART-002.AC1–AC3.
