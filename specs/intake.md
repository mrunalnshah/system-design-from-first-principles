# Intake: System Design from First Principles (website)
Date: 2026-11-26 · Round budget: 8 points · Level: L3

## Understanding
The author is writing a book, *System Design from First Principles*, in an Obsidian vault and wants a website to publish it.
The homepage follows Substack's layout patterns (not its branding): a featured book a reader can open and read from the first chapter, featured chapters, and standalone articles that sit outside the book.
Chapters are Obsidian-flavoured Markdown: `![[file.svg]]` embeds, paired light and dark SVG diagrams exported from Excalidraw, and LaTeX math (`$\frac{1}{10^3}$`).
The book is organised into parts (`part-1_foundations/`) that hold chapters (`chapter-1_computer-architecture.md`).
One chapter exists today. More chapters and articles will follow, written by one author.

## Signature feature
Two, chosen together in interview round 1:
1. **Beautiful diagrams.** The Excalidraw diagrams are the star: large, crisp, and correct in light and dark mode.
2. **Calm, focused reading.** A distraction-free reader with strong typography.

How the plan protects them: diagrams render as inline SVG at full content width, swap light/dark with the theme, and can be opened full screen; the reader page has no sidebars, pop-ups or banners competing with the text; both get acceptance criteria and screenshot tests at phone and laptop width.

## Imagination
- The moment they pictured: open (not in the description)
- How it should feel: clean and technical (sans-serif, crisp whites and greys, code-friendly), calm
- Inspirations: Substack homepage layout (patterns only)

## Coverage map
| Topic | Status | Source or note |
|---|---|---|
| Idea and goal | answered | chat message, 2026-11-26 |
| Users and roles | confirmed | G-01, interview round 1 |
| Features | confirmed | chat message + G-04 to G-09; rounds 1–2: no newsletter, RSS deferred, plus About, Articles archive, 404 |
| Journeys | confirmed | G-10 |
| Platforms | confirmed | G-02 |
| Existing code | confirmed | G-03: no code; Obsidian vault is the source of truth |
| Data and compliance | answered | round 2: no accounts, no newsletter, cookieless analytics; the project stores no reader personal data |
| Team and timeline | answered | solo author and maintainer (G-01), light coding (round 2), ~10 h/week, no deadline |
| AI setup and rounds | answered | coding agent, Medium (8 points), ~10 h/week, no deadline |
| Look and feel | answered | clean and technical UI, serif reading text, airy, blueprint blue, light+dark, refs: Crafting Interpreters + Substack (design intake); WCAG 2.2 AA (ASM-001) |
| Scale and quality | assumed (ASM-003); NFR-001…013 approved at G2 | — |
| Integrations | answered | GitHub + GitHub Pages (G2); no analytics (G3, replaces round 2); no sign-in, payments or email |
| Tools and technology | assumed (ASM-006) | user said "you decide" at G3: Astro 7 (ADR-0001); public GitHub repo + GitHub Pages (G2) |
| Operations | answered | the author runs it alone; $0 a month (round 2); no analytics (G3); failures reported by GitHub Actions emails |

## Answers
### AI setup and rounds
Builds in a coding agent (Claude Code). Rounds are Medium (8 points). About 10 hours a week, no deadline.

### Features and journeys (interview round 1)
All guesses G-01 to G-10 below were confirmed by the user ("All correct").
- Newsletter or email subscription: **not in v1** (user's choice).
- Look and feel: **clean and technical**.

### Interview round 2
- Coding experience: **light coding**; the AI writes nearly all code, the author mostly writes content. The stack must be simple to keep running, and publishing must need no coding.
- Analytics: **privacy-friendly, cookieless** page-view counts (e.g. Cloudflare Web Analytics or GoatCounter): no cookie banner, and the project stores no personal data. The chosen provider's data handling is verified at G3.
- Hosting: **free static hosting on a free address** (e.g. `<name>.github.io` or `<name>.pages.dev`); $0 a month.
- Extra v1 pages: **About the author, All-articles archive, friendly 404.**
- RSS feed: **not ticked in round 2**, so it's deferred out of v1, although round 1 mentioned it. Confirmed at G1 (the user approved without adding RSS).

### Design intake (2026-11-26)
- References: Crafting Interpreters (home, contents, chapter) and Substack, patterns only.
- Density: **airy** (~70-character reading line).
- Accent: **blueprint blue**.
- Header: **book title + author name + portfolio link**. Name: "Mrunal Nirajkumar Shah"; link: https://mrunalnshah.github.io/ (user-supplied, public).
- Body text: **serif for reading, sans-serif for headings, navigation and UI**, monospace for code. This refines "clean and technical": the UI stays clean and technical, and long reading gets a serif.
- Footnotes `[^n]` render as **margin notes** on wide screens and as tap-to-open notes on phones.
- Chapter touches (all chosen): **big chapter number, auto section numbers (1.1, 1.1.1), optional epigraph from frontmatter, sticky chapter menu** (collapses to a button on phones).
- Homepage order: **book hero → featured chapters → latest articles → link to all articles.**
- Diagram facts read from the vault: Excalidraw SVGs paint solid backgrounds (`#ffffff` light, `#121212` dark), embed their own fonts, and are up to ~213 KB per variant. Obsidian's MathJax renders `\micro` inside the Excalidraw source.
- No brand assets (logo) supplied; the site uses a text wordmark.

### Data and compliance
No reader accounts, no email collection, no cookies. The only data about readers is the analytics provider's aggregate page-view counts. The About page shows whatever the author chooses to publish about themself.

## Guesses confirmed in interview round 1
| ID | Guess | Why |
|---|---|---|
| G-01 | One author (you) writes and publishes; readers are anonymous with no accounts in v1 | A personal book site; accounts add personal data and cost |
| G-02 | A website that reads well on phone and laptop; no app | "website" |
| G-03 | The Obsidian vault stays the single source of truth: you keep writing in Obsidian, and the site is generated from these files without you rewriting them | You already write here, and the chapter uses Obsidian syntax |
| G-04 | Book structure is Parts → Chapters, ordered by the number in the folder and file names | `part-1_…/chapter-1_…` naming |
| G-05 | "Read from the start" opens Part 1, Chapter 1; every chapter has previous/next links and a table of contents for the book | Book reading flow |
| G-06 | Standalone articles live in their own folder (e.g. `articles/`) and never appear in the book's table of contents | They're separate from the book |
| G-07 | You mark featured chapters and articles with a frontmatter flag (`featured: true`); unfinished pieces stay hidden with `draft: true` | Lets you control the homepage without code |
| G-08 | Light and dark mode, following the reader's system setting; each diagram shows its light or dark SVG to match | You already export both versions |
| G-09 | Out of v1: comments, likes, paid tiers, search. Search is a nice-to-have later | Keeps v1 small |
| G-10 | Journeys: J1 open the homepage and start the book from Chapter 1; J2 open a featured chapter from the homepage; J3 read a standalone article; J4 move chapter to chapter with previous/next; J5 you publish a new chapter by writing it in Obsidian and pushing | Follows from the features |

## Design references
| File or link | Shows | Confirmed reading |
|---|---|---|
| Substack homepage (named in chat) | Layout pattern: featured post, post lists | Patterns only: no logos, colours or copy |
| https://craftinginterpreters.com/ | Book landing: big hero (title, author, illustration), short pitch | Homepage hero pattern; user chose "hero, then featured chapters, then latest articles" |
| https://craftinginterpreters.com/contents.html | Contents: parts with Roman numerals, chapters numbered continuously, small sub-items | Contents page pattern |
| https://craftinginterpreters.com/introduction.html | Chapter: big faint chapter number, epigraph, numbered sections (1.1, 1.1.1), right-margin asides, sticky title/menu panel | User chose all four touches + margin notes; serif body with sans UI |

## Assumptions
| ID | Assumption | Why | Accepted by the user |
|---|---|---|---|
| ASM-001 | Accessibility target WCAG 2.2 AA | Blueprint default; a reading site must be readable for everyone | yes (G1, 2026-11-26) |
| ASM-002 | The vault and site code live in one GitHub repository; publishing = push to GitHub, which builds and deploys the site automatically | Free, and matches J5 ("write in Obsidian and push") for a light coder | yes (G1, 2026-11-26) |
| ASM-003 | Up to a few thousand readers a month in year one; a static site handles far more at $0 | A new technical book site | yes (G1, 2026-11-26) |
| ASM-004 | English only; no translations | The book is written in English | yes (G1, 2026-11-26) |
| ASM-006 | Stack A: Astro 7 with custom Obsidian plugins (ADR-0001) | The user said "you decide"; it's the conventional option and the only one with zero JS and typed content errors by default | yes (G3, 2026-11-26) |
| ASM-007 | Diagrams are made by the Excalidraw plugin's auto-export (light + dark on save); the site only displays the SVGs | The user asked us to "see what we can do"; it keeps their colours exactly and needs no new tooling | yes (G4, 2026-11-26) |
| ASM-005 | One book in v1; the content model leaves room for a second book later without a rewrite | "a featured book" | yes (G1, 2026-11-26) |

## Conflicts
CNF-001 resolved at G2 (the author writes `\mu`); CNF-002 accepted; CNF-003 resolved at G2 (public repository + GitHub Pages). See specs/conflicts.md.

## Open questions
None. Every topic is settled (readiness review, 2026-11-26).

## Decisions so far
- Gate G5 approved on 2026-11-26: plan frozen.
- Sitting E (2026-11-26): roadmap, 49 task packets, 20 Medium rounds, 16 project tools; readiness review READY.
- Gate GD approved on 2026-11-26 (design/preview/index.html, no changes).
- Gate G4 approved on 2026-11-26 (ADR-0002 to ADR-0012).
- G4 changes (2026-11-26): diagrams come from the Excalidraw plugin's auto-export (light + dark on save, ASM-007, ADR-0012); drawing sources are gitignored and backed up by the author (CNF-007); redirects via `moved_from` added to v1 (REQ-BOOK-007).
- Gate G3 approved on 2026-11-26. Repository: `system-design-from-first-principles` (public); site: https://mrunalnshah.github.io/system-design-from-first-principles/ (base path `/system-design-from-first-principles/`).
- G3 answers (2026-11-26): stack "you decide" → Astro 7 (ASM-006); no analytics (REQ-SITE-006 deferred).
- Gate G2 approved on 2026-11-26. CNF-001: the author writes `\mu`. CNF-003: public repository + GitHub Pages; drafts are visible on GitHub (accepted).
- Gate G1 approved on 2026-11-26.
- Package slug: `sdfp-website`.
