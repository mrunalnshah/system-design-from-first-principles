# Screen: Not found (404)
Requirements: REQ-SITE-004 · Journeys: J1 · Layout is a **proposal** until GD.

## Layout
SiteHeader, then centred at reading width: a large faint "404" (in the big-chapter-number style, `aria-hidden`), "Page not found" (`h1`), one sentence ("This page may have moved when a chapter was renamed."), a [Read from the start] PrimaryButton, then "Contents" and "Home" links. Then SiteFooter.

## States
| State | What shows |
|---|---|
| Default | As above, with HTTP status 404 (REQ-SITE-004.AC1) |
| Loading / Long text / Offline / No permission | As Home |

## Acceptance
REQ-SITE-004.AC1.
