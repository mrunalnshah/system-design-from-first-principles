# Screen: About `/about/`
Requirements: REQ-SITE-003, REQ-SITE-001 · Journeys: J6 · Layout is a **proposal** until GD.

## Layout
SiteHeader, then the reading column with the title "About" and "Mrunal Nirajkumar Shah" (`h1`), the rendered `about.md` in Prose (unnumbered), then a "Portfolio: mrunalnshah.github.io →" link and a "Start reading the book →" link. Then SiteFooter.

## States
| State | What shows |
|---|---|
| Default | As above |
| No about.md | The page doesn't exist; the header name links to the portfolio (REQ-SITE-003.AC2) |
| Loading / Error / Long text / Offline / No permission | As Home |

## Acceptance
REQ-SITE-003.AC1–AC2.
