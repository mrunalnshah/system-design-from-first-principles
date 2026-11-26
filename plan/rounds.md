# Rounds: System Design from First Principles (website)
Round budget: 13 points (between Medium and Large) · Builds in: Claude Code (coding agent) · Last calibrated: 2026-11-26 after R-01 ("easy, I could do more": 8 → 13)

One round per conversation. A Careful task always comes first in its round; before it starts, switch to your tool's most careful option if it has one. R-01 (done) kept its original grouping; R-02 onwards were regrouped at 13 points, keeping task order, dependencies and phase boundaries.

| Round | Phase | Goal | Tasks | Points | Care | Ends with |
|---|---|---|---|---|---|---|
| R-01 | 0 | Project scaffold and tracker | T-00.01, T-00.02 | 5 | Standard | `npm --prefix .site run build` works; `<tools> status` runs |
| R-02 | 0 | Packer and plan checker | T-00.03, T-00.04 | 8 | Standard | `<tools> check` passes on the real plan |
| R-03 | 0 | Publish pipeline, secrets, spike S-01, first live slice | T-00.05, T-00.06, T-00.07, T-00.08 | 13 | Careful | CI green; placeholder live on GitHub Pages; CNF-004 and CNF-005 recorded |
| R-04 | 0 | Boundaries, audit, Excalidraw check | T-00.09, T-00.10, T-00.11 | 6 | Standard | Boundary and audit jobs green; CNF-008 recorded |
| R-05 | 1 | Tokens, build report, vault scan | T-01.01, T-01.02, T-01.03 | 11 | Standard | tokens.css generated; fixture vault classified and ordered |
| R-06 | 1 | Vault validation, summaries, Markdown core, embeds | T-01.04, T-01.05, T-01.06, T-01.07 | 13 | Standard | Golden tests for frontmatter, core Obsidian syntax and embeds pass |
| R-07 | 1 | Math, headings, footnotes, harness, diagram index | T-01.08, T-01.09, T-01.10, T-01.11, T-01.12 | 13 | Standard | Chapter 1 golden HTML has math and numbered sections; Playwright harness in CI |
| R-08 | 1 | Figures, Chapter 1 live, site shell | T-01.13, T-01.14, T-01.15 | 13 | Standard | Chapter 1 live with both diagrams in light and dark, inside the site shell |
| R-09 | 1 | Reader layout, menu, margin notes, viewer | T-01.16, T-01.17, T-01.18, T-01.19 | 11 | Standard | Chapter 1 matches the preview with JS on and off |
| R-10 | 1 | Performance and link guards | T-01.20 | 3 | Standard | Lighthouse, size and link checks green; phase 1 demo |
| R-11 | 2 | Tools, book navigation, contents, keyboard, hero | T-02.01, T-02.02, T-02.03, T-02.04, T-02.05 | 13 | Standard | Contents page and homepage hero live; CNF-006 measured |
| R-12 | 2 | Featured chapters and latest articles | T-02.06 | 3 | Standard | Homepage matches the preview; phase 2 demo |
| R-13 | 3 | Articles, About, 404, redirects, private drawings | T-03.01, T-03.02, T-03.03, T-03.04, T-03.05, T-03.06 | 13 | Standard | Article, archive, About, 404 and redirects live |
| R-14 | 3 | Base path and failed-build proofs | T-03.07 | 2 | Standard | Base `/` link check passes; a failed build never deploys; phase 3 demo |
| R-15 | 4 | Hardening and launch readiness | T-04.01, T-04.02, T-04.03, T-04.04, T-04.05 | 13 | Careful | Security review, budgets at scale, messages, journeys, restore drill and launch checklist done |

## Calibration
After R-01, after any round that ends with a task unfinished, and whenever the user says rounds feel too long or too short, ask: "How did that round feel? a) easy, I could do more b) about right c) too much, or I ran out". Move one step on the ladder 3 · 5 · 8 · 13 · 20, regroup only the rounds not yet started, and log the change.

| Date | Budget | Reason |
|---|---|---|
| 2026-11-26 | 8 | starting size: Medium (user's choice) |
| 2026-11-26 | 13 | after R-01: "easy, I could do more" (one step up) |

## Calendar estimate
135 points left in 14 rounds. At the planned pace of 1–2 hours per 8 points, that's about 17–34 hours: roughly **2–3½ weeks** at 10 hours a week, plus the author's one-time GitHub and Obsidian setup (T-00.05, T-00.11, launch checklist). No deadline is set. Recomputed after each calibration.

## Parallel rounds (L3 only)
Rounds run one at a time by default, because each phase builds on the last. Inside a round, tasks marked `parallel_safe: true` touch different files and may run in parallel subagents.
