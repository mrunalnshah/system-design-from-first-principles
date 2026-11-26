# Rounds: System Design from First Principles (website)
Round budget: 13 points (between Medium and Large) · Builds in: Claude Code (coding agent) · Last calibrated: 2026-11-26 after R-01 ("easy, I could do more": 8 → 13)

One round per conversation. A Careful task always comes first in its round; before it starts, switch to your tool's most careful option if it has one. R-01 (done) kept its original grouping; R-02 onwards were regrouped at 13 points, keeping task order, dependencies and phase boundaries.

| Round | Phase | Goal | Tasks | Points | Care | Ends with |
|---|---|---|---|---|---|---|
| R-01 | 0 | Project scaffold and tracker | T-00.01, T-00.02 | 5 | Standard | `npm --prefix .site run build` works; `<tools> status` runs |
| R-02 | 0 | Packer and plan checker | T-00.03, T-00.04 | 8 | Standard | `<tools> check` passes on the real plan |
| R-03 | 0 | Publish pipeline, secrets, spike S-01 | T-00.05, T-00.06, T-00.07 | 11 | Careful | CI green on GitHub; secrets blocked locally and in CI; CNF-004 recorded |
| R-04 | 0 | First live slice, boundaries, audit, Excalidraw check | T-00.08, T-00.09, T-00.10, T-00.11 | 10 | Standard | Placeholder live on GitHub Pages; CNF-005 and CNF-008 recorded; boundary and audit jobs green |
| R-05 | 1 | Sync command, writing guide, design tokens | T-01.22, T-01.21, T-01.01 | 11 | Careful | `sync.cmd` publishes a real change end to end; WRITING-GUIDE.md and templates ready; tokens.css with contrast and raw-colour checks |
| R-06 | 1 | Build report and vault model | T-01.02, T-01.03, T-01.04, T-01.05 | 13 | Standard | Build report fails on seeded errors; fixture vault classified, ordered, validated and summarised |
| R-07 | 1 | Markdown core, embeds, math, headings | T-01.06, T-01.07, T-01.08, T-01.09 | 13 | Standard | Chapter 1 golden HTML: core syntax, embeds (drawing embeds included), math, numbered sections |
| R-08 | 1 | Footnotes, test harness, diagram index, figures | T-01.10, T-01.11, T-01.12, T-01.13 | 11 | Standard | Playwright harness in CI; drawings and image pairs become themed figures |
| R-09 | 1 | Chapter 1 live, site shell, reader layout | T-01.14, T-01.15, T-01.16 | 13 | Standard | Chapter 1 live in the site shell, matching the preview |
| R-10 | 1 | Menu, margin notes, viewer, performance guards | T-01.17, T-01.18, T-01.19, T-01.20 | 11 | Standard | Chapter interactions with JS on and off; Lighthouse, size and link checks green; phase 1 demo |
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
| 2026-11-26 | 13 | CR-0002: T-00.06 resized S/2 → M/3; T-00.08 moved from R-03 to R-04 (budget unchanged) |
| 2026-11-26 | 13 | CR-0003: T-00.09 resized S/2 → M/3 (R-04 = 10 points); TOOL-08.AC3 (no raw colours) added to T-01.01 |
| 2026-11-26 | 13 | CR-0005: sync (T-01.22) and the writing guide (T-01.21) added; R-05..R-10 regrouped, phase 1 still ends at R-10 |

## Calendar estimate
116 points left in 11 rounds. At the planned pace of 1–2 hours per 8 points, that's about 15–29 hours: roughly **1½–3 weeks** at 10 hours a week, plus the author's one-time GitHub and Obsidian setup (T-00.05, T-00.11, launch checklist). No deadline is set. Recomputed after each calibration.

## Parallel rounds (L3 only)
Rounds run one at a time by default, because each phase builds on the last. Inside a round, tasks marked `parallel_safe: true` touch different files and may run in parallel subagents.
