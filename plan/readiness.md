# Readiness: System Design from First Principles (website)
Verdict: READY · Checked on 2026-11-26

| Check | Result | Notes |
|---|---|---|
| Every requirement has criteria, a module and a task | pass | 46 active requirements, 114 criteria; all served in modules.md and delivered by a task; 6 deferred (IDs kept) |
| Every task delivers a requirement or is enabling | pass | 49 tasks; the 3 with no deliveries (T-00.01, T-00.07, T-00.11) are `kind: enabling` with a reason in their Goal |
| No dependency cycles | pass | Checked by graph walk; no task depends on a later round, and no in-round order is inverted |
| Every task has points matching its size and a care level | pass | S → 1–2, M → 3–5; S ≤ 3 files, M ≤ 6; Careful tasks are M |
| Every round fits the budget with at most one Careful task; R-01 is 5 points or fewer | pass | 20 rounds, max 8 points; R-01 = 5; Careful tasks (T-00.05, T-04.01) open R-03 and R-19; calibration question in rounds.md and AGENTS.md |
| Versions verified, or T-00.01 scheduled | pass | All versions verified live on 2026-11-26 with the 7-day cooldown (stack.md); T-00.01 re-verifies by installing |
| Major modules have ADRs with two options | pass | ADR-0001 to ADR-0012; vault (0003), markdown (0004, 0008), diagrams (0005, 0012), reader (0006), site (0007, 0011), book (0009), styling (0010), layout (0002) |
| Each NFR has a design response and a test | pass | 13 NFRs, each in architecture.md's NFR table and delivered by a task (T-01.14, T-04.01 to T-04.05) |
| The threat model covers every trust boundary | pass | B1 push, B2 CI supply chain, B3 deploy, B4 reader (security.md) |
| Coverage map has no open topics | pass | 14 topics: answered, confirmed or assumed |
| Open assumptions reviewed with the user | pass | ASM-001 to ASM-007 accepted at G1, G3 and G4 |
| No open conflicts; decisions recorded; spikes scheduled | pass | CNF-001, 003, 007 resolved; CNF-002 accepted; CNF-004 → T-00.07, CNF-005 → T-00.08, CNF-006 → T-02.05, CNF-008 → T-00.11 |
| Every tool has a trigger, criteria and a build task before its first use | pass | 16 tools, 38 criteria; e.g. TOOL-09 (R-10) before the first e2e task (R-11), TOOL-10 (R-14) before the CNF-006 measurement (R-16) |
| Design preview approved at GD; every user-facing requirement shown; every screen built by a task | pass | Approved 2026-11-26; README lists what isn't visible and why; all 7 screens appear in some task's `screens` |

## Check results
- **Traceability:** a script (kept outside the package) read every `REQ-…AC` line in specs/features, every `TOOL-…AC` in plan/tools.md and every NFR in specs/product.md, and compared them with the `delivers` lists. Nothing was missing or unknown.
- **Packets:** every `load:` entry resolves to a real file and heading anchor (the format TOOL-01 will read). All packets use the exact T9 frontmatter.
- **Parallel safety:** two pairs of tasks marked `parallel_safe` shared a file (T-00.03/T-00.04 on `tools/cli.ts`, T-04.01/T-04.02 on `publish.yml`). T-00.04 and T-04.02 are now `parallel_safe: false`.
- **Spec change during sitting E:** MOD-home may use MOD-articles' `<ArticleRow>` (shared with the archive). Recorded in modules.md, with the dependency direction kept acyclic.
- **Calendar:** 20 rounds × 1–2 h = 20–40 h, about 2–4 weeks at 10 h a week. No deadline, so there's no over-time conflict.
- **Author-only steps** are named in START-HERE.md and in their tasks: GitHub repository, Pages, 2FA and branch protection (T-00.05); the Excalidraw auto-export settings (T-00.11); book.md and about.md; backing up the gitignored drawing sources.

## After the review
- 2026-11-26, after R-01: rounds regrouped from 8 to 13 points at the user's calibration ("easy, I could do more"). Same tasks, order, dependencies and phases; 15 rounds instead of 20. CR-0001 removed three stalled dependencies.

## Accepted risks
- Drafts, notes and git history are publicly readable on GitHub (CNF-003, accepted at G2).
- Drawing sources exist only in the author's own backup (CNF-007, accepted at G4).
- Astro's loader and dot-folder behaviour (CNF-004) is unproven until spike T-00.07; the fallbacks are documented in ADR-0002 and ADR-0003.
