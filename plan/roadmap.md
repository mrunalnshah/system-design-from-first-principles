# Roadmap: System Design from First Principles (website)

Phases are vertical slices ordered by risk. The riskiest assumptions (Astro's loader from a dot folder, Obsidian fidelity, diagrams in both themes) are tested first. 52 tasks, 152 points (CR-0002, CR-0003, CR-0005, CR-0006); R-01 at the original 8-point budget, then 14 rounds at 13 points after the R-01 calibration (plan/rounds.md).

| Phase | Goal | Requirements | Exit criteria | Demo |
|---|---|---|---|---|
| 0 | Walking skeleton and core tools (R-01 to R-04) | REQ-SITE-007.AC3, REQ-SITE-013.AC1; TOOL-01, 02, 03, 06, 13, 14 | CI green with every check (lint, types, tests, boundaries, plan checker, secrets, audit); TOOL-01 to TOOL-03 built and tested; the placeholder page live at `https://mrunalnshah.github.io/system-design-from-first-principles/`; spikes S-01 (CNF-004) and S-02 (CNF-008) recorded; CNF-005 checked live | Push a one-word change and watch it go live; open an unknown address and see the 404; run `<tools> status` and `<tools> check` |
| 1 | Sync and the writing guide first, then Chapter 1, faithfully: content pipeline, diagrams, calm reader, site shell (R-05 to R-10) | REQ-AUTH-001…003; REQ-DIAG-007; REQ-CNT-001…009, 011; REQ-DIAG-001…005, 006.AC2; REQ-READ-001…008; REQ-BOOK-002; REQ-SITE-001, 002, 005, 007.AC1, 008; NFR-009 | Chapter 1 is live and matches the approved preview at phone and laptop width in light and dark; both diagrams switch theme with JS off and only one variant downloads; menu, margin notes and viewer work with JS on and off; Lighthouse, size and link checks green | Open Chapter 1 on a phone and a laptop, switch the system theme, open diagram 01 full screen, tap Sections; then add a sample footnote in a fixture and see it in the margin |
| 2 | Book navigation and the homepage (R-11 to R-12) | REQ-BOOK-001, 003, 004, 005; REQ-HOME-001…004; REQ-CNT-004.AC1, AC3; REQ-ART-003; TOOL-04, 05 | Contents and homepage live and matching the preview; previous/next across parts with drafts skipped; homepage ships 0 KB JS; CNF-006 measured and resolved | J1 and J2 end to end: Home → Read from the start → Chapter 1 → Contents → a section; Home → featured card |
| 3 | Articles, About, 404 and redirects (R-13 to R-14) | REQ-ART-001, 002; REQ-READ-009; REQ-SITE-003, 004, 007.AC2, 013.AC2; REQ-BOOK-007; REQ-DIAG-006.AC1, AC3 | Article, archive, About and 404 live and matching the preview; `moved_from` redirects work; a broken embed on a branch never deploys; no drawing source in `dist/` | J3 and J6: Home → article → All articles; header name → About → portfolio; open an old address and arrive at the new one |
| 4 | Hardening (R-15) | NFR-001…008, 010…013 | Security review recorded (ASVS L1 checklist); budgets met on a generated 60-chapter/100-article vault; every build message has a seeded test; journey, axe, no-JS and responsive suites green; restore drill passed; runbooks and launch checklist done | Fresh clone → `npm ci` → build → identical page count to the live sitemap; walk the launch checklist with the author |

## Spikes and live checks
- **S-01 (T-00.07, R-03):** Astro 7 custom loader storing our own `rendered.html`, from the `.site/` dot folder with content one level up (CNF-004). Fallbacks are in ADR-0002 and ADR-0003.
- **S-02 (T-00.11, R-04):** with the author, the Excalidraw plugin's auto-export file names (CNF-008), before the diagram index (T-01.12).
- **CNF-005 (T-00.08, R-04):** GitHub Pages 404 for the project site, checked on the first live deploy.
- **CNF-006 (T-02.05, R-11):** hero diagram LCP measured with Lighthouse CI (TOOL-10 from T-01.20).

## Critical path
T-00.01 → T-00.05 → T-00.08 → T-01.02 → T-01.03 → T-01.04 → T-01.14 → T-01.15 → T-01.16 → T-02.02 → T-02.05 → T-02.06 → T-03.02 … T-03.05 → T-03.07 → T-04.01 → T-04.05.
In parallel to the vault work, the Markdown chain is T-01.06 → T-01.07 → T-01.13 → T-01.14.

## Parallel work
Within a round, tasks marked `parallel_safe: true` touch different files (for example T-01.08, T-01.09 and T-01.10 in the Markdown plugins; T-00.03 and T-00.04 in the tools). Tool tasks (T-01.01, T-01.11, T-01.20, T-02.01) never touch product files and can run alongside product work at L3.
