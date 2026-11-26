---
id: FEAT-site
title: Site shell, pages and publishing
paths: [src/features/site/**]
---
# FEAT-site: Site shell, pages and publishing

What every page shares (header, footer, theme, page metadata), the About and 404 pages, and publishing on push. Serves every journey, and J5 and J6 directly.

## Requirements

### REQ-SITE-001 Header
Priority: must · Screens: all · Journeys: J6
WHEN any page is shown THE SYSTEM SHALL show a header with the book title (linking home), "by Mrunal Nirajkumar Shah" (linking to the About page), a portfolio link to https://mrunalnshah.github.io/, and links to Contents and Articles; the name and link come from `book.md`.
- REQ-SITE-001.AC1: Given `author: "Mrunal Nirajkumar Shah"` and `author_url: "https://mrunalnshah.github.io/"` in `book.md`, when any page is built, then the header shows both.
- REQ-SITE-001.AC2: Given a 375 px screen, when the header is shown, then it fits on one row, with Contents, Articles and the portfolio link in a menu.
- REQ-SITE-001.AC3: Given the portfolio link, when it's followed, then it opens in the same tab and is marked as an external link for screen readers.

### REQ-SITE-002 Theme follows the system
Priority: must · Screens: all · Journeys: J1–J6
WHEN a page loads THE SYSTEM SHALL use the light or dark theme from the reader's `prefers-color-scheme`, switch live when it changes, and work without JavaScript.
- REQ-SITE-002.AC1: Given a reader in dark mode, when any page loads, then the dark theme shows with no flash of the light theme.

### REQ-SITE-003 About page
Priority: must · Screens: design/screens/about.md · Journeys: J6
WHEN a reader opens `/about/` THE SYSTEM SHALL show the rendered `about.md`, with the author's name as the title and the portfolio link.
- REQ-SITE-003.AC1: Given `about.md`, when the site is built, then `/about/` shows its contents in the reading view.
- REQ-SITE-003.AC2: Given no `about.md`, when the site is built, then there's no About page, the header's name links to the portfolio instead, and the build prints a warning.

### REQ-SITE-004 Friendly 404
Priority: must · Screens: design/screens/not-found.md · Journeys: J1
WHEN a reader opens an address that doesn't exist THE SYSTEM SHALL show a "Page not found" page with links to the homepage, the contents and Chapter 1, in the site's look, served with HTTP status 404.
- REQ-SITE-004.AC1: Given `/book/does-not-exist/`, when it's requested, then the host answers 404 with the friendly page.

### REQ-SITE-005 Page metadata and sharing
Priority: must · Screens: all · Journeys: J1–J3
WHEN any page is built THE SYSTEM SHALL give it a unique `<title>` ("<Page> · System Design from First Principles"), a meta description from its summary, a canonical address, Open Graph tags for link previews, and include it in `sitemap.xml`.
- REQ-SITE-005.AC1: Given Chapter 1, when it's built, then its title is "Computer Architecture · System Design from First Principles".
- REQ-SITE-005.AC2: Given a draft, when the sitemap is built, then the draft isn't in it.

### REQ-SITE-006 Privacy-friendly analytics (deferred)
The user chose no analytics at G3 (2026-11-26). If it's added later, it must be cookieless and keep no personal data (NFR-008).

### REQ-SITE-007 Publish on push
Priority: must · Screens: none · Journeys: J5
WHEN the author pushes to the main branch on GitHub THE SYSTEM SHALL build the site, run the checks, and deploy it to GitHub Pages; when the build fails, it shall leave the live site unchanged and show the build errors on the GitHub run page.
- REQ-SITE-007.AC1: Given a push with a new chapter, when the run finishes, then the chapter is live within 10 minutes (NFR-005).
- REQ-SITE-007.AC2: Given a push with a broken embed, when the run finishes, then the live site is unchanged, and the run page shows the REQ-CNT-007 error message.
- REQ-SITE-007.AC3: Given only `.obsidian/` changed, when the push runs, then the site still builds and deploys without error.

### REQ-SITE-008 Footer
Priority: must · Screens: all · Journeys: J6
WHEN any page is shown THE SYSTEM SHALL show a footer with the copyright line "© <year> Mrunal Nirajkumar Shah", and links to the About page and the portfolio.
- REQ-SITE-008.AC1: Given a build in 2026, when any page is built, then the footer reads "© 2026 Mrunal Nirajkumar Shah".

### REQ-SITE-013 Works under the GitHub Pages base path
Priority: must · Screens: all · Journeys: J1–J6
WHEN the site is built THE SYSTEM SHALL prefix every internal link, asset, diagram, canonical address and sitemap entry with the base path of the GitHub Pages project site (`/<repo>/`), set in one place, so it works at `https://mrunalnshah.github.io/<repo>/` and at the root of a custom domain later (CNF-003).
- REQ-SITE-013.AC1: Given base path `/system-design/`, when the site is built, then the Chapter 1 link is `/system-design/book/computer-architecture/`, and no built page has an internal link or asset without the prefix.
- REQ-SITE-013.AC2: Given the base path changes to `/`, when the site is rebuilt, then every link still resolves (the link check passes).

### REQ-SITE-009 Manual theme toggle (deferred)
Not requested; the theme follows the system (G-08). Kept so the ID isn't reused.

### REQ-SITE-010 RSS feed (deferred)
Left out of v1 in interview round 2 and confirmed at G1.

### REQ-SITE-011 Search (deferred)
A nice-to-have for later (G-09).

### REQ-SITE-012 Newsletter (deferred)
Not in v1 (interview round 1).
