# Product: System Design from First Principles (website)

## Vision
A calm, fast website where readers read *System Design from First Principles* from the first chapter to the last, and the author's standalone articles alongside it.
The author writes only in Obsidian. Pushing the vault to GitHub publishes the site, with diagrams that look as good as they do in Obsidian, in light and dark mode.

## Users and roles
| Role | Goals | Can do |
|---|---|---|
| Reader | Read the book in order, jump to a featured chapter, read articles, on a phone or a laptop | Read every published page; no account, nothing to sign in to |
| Author (Mrunal Nirajkumar Shah) | Write in Obsidian, choose what's featured, publish without coding | Edit files in the vault, set frontmatter flags (`featured`, `draft`, `epigraph`, …), push to GitHub to publish |

There is one author. Readers are anonymous. There are no accounts, roles or permissions inside the site (ASM-001…005, G-01).

## Journeys
1. J1 Start the book: open the homepage → press "Read from the start" → Part I, Chapter 1 opens → read to the end → "Next chapter".
2. J2 Featured chapter: open the homepage → pick a featured chapter card → read it → use the chapter menu to jump to a section, or open the contents page.
3. J3 Read an article: open the homepage → pick an article from "Latest articles" (or "All articles" → the archive) → read it.
4. J4 Move through the book: on any chapter → previous/next links, or the contents page → any chapter.
5. J5 Publish: write or edit a Markdown file in Obsidian → set `draft: false` (or remove `draft`) → push to GitHub → the site is live within 10 minutes, or the author gets a plain-language error naming the file and line.
6. J6 Get to know the author: the header's name or the About page → the About page → the portfolio link.

## Scope
- First version: homepage (book hero, featured chapters, latest articles); book contents; chapter reader with serif reading text, margin notes, section numbers, big chapter number, optional epigraph and sticky chapter menu; article reader; all-articles archive; About; 404; light and dark mode following the system; diagram light/dark swap and full-screen view; math; publish on push to GitHub Pages (public repository, CNF-003) under a base path.
- Not now: analytics, accounts, newsletter or email subscription, comments, likes, paid tiers, search, RSS, translations, a manual theme toggle, a second book, "continue where I left off".

## Non-functional requirements
| ID | Quality | Target | How it's measured |
|---|---|---|---|
| NFR-001 | Loading speed | Largest Contentful Paint ≤ 2.5 s and CLS ≤ 0.1 on a mid-range phone over a 4G connection, for the home, contents and chapter pages | Lighthouse CI (mobile preset) in CI on every push; fails the build when exceeded |
| NFR-002 | Page weight | ≤ 60 KB of compressed JavaScript per page; a chapter page's HTML+CSS+fonts ≤ 250 KB compressed, excluding diagrams; only the diagram variant matching the theme is downloaded | Build-size check in CI; network trace in an end-to-end test |
| NFR-003 | Accessibility | WCAG 2.2 AA: zero automated violations; every text/background token pair ≥ 4.5:1 (≥ 3:1 for large text and UI borders); full keyboard use; visible focus | axe checks per screen and state in CI; token contrast check in CI |
| NFR-004 | Reading works without JavaScript | All text, diagrams (in the right theme), math, contents and previous/next work with JavaScript turned off; JavaScript only enhances (sticky menu, full-screen diagrams, margin-note taps) | End-to-end test with JavaScript disabled |
| NFR-005 | Publish time | Push to live in ≤ 10 minutes at the 95th percentile | Timestamps of the CI deploy job |
| NFR-006 | Build time | Full build ≤ 2 minutes for 60 chapters and 100 articles | Timed build against generated fixture content in CI |
| NFR-007 | Cost | $0 a month for hosting and builds | GitHub Pages and GitHub Actions for a public repository (specs/stack.md); checked at each phase review |
| NFR-008 | Privacy | No cookies, no browser storage of personal data, and no third-party requests at all: fonts and scripts are self-hosted, and there's no analytics (G3) | End-to-end test listing every request and cookie on each page; every request goes to the site's own origin |
| NFR-009 | Source fidelity | Every published vault file renders without edits to it: Obsidian embeds, light/dark SVG pairs, `$…$` and `$$…$$` math, footnotes, callouts, tables, code blocks | Golden tests on fixture files, plus Chapter 1 rendered as an end-to-end fixture |
| NFR-010 | Diagram quality | Diagrams stay vector-crisp at 200% zoom, fill the reading column (up to 900 px), and never overflow the screen at 320 px width | Layout checks at 320, 768 and 1280 px in light and dark (the theme's SVG, width up to 900 px and at least the column's, inside the screen, and at 200% zoom), with screenshots attached to the report (CR-0012) |
| NFR-011 | Responsive | No horizontal page scroll from 320 px to 1920 px wide | An overflow assertion on every screen at 9 widths from 320 to 1920 px, with screenshots attached to the report (CR-0012) |
| NFR-012 | Availability | No server of our own; the site is static files on the host's CDN, and any host outage is the host's | Monthly check by the author that the site loads; noted in operations.md |
| NFR-013 | Author-friendly errors | Every build error names the file, the line and the fix in plain words; a broken diagram embed blocks the publish, while an optional field that's missing only warns | Tests that seed each error and check the message |

## Success metrics
- Chapter 1 is live with both diagrams correct in light and dark mode, by the end of phase 1.
- The author publishes Chapter 2 without touching any code: push only, live within 10 minutes.
- Lighthouse scores ≥ 95 for Performance, Accessibility, Best Practices and SEO on the home, contents and chapter pages.
