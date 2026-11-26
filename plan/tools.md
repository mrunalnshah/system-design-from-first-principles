# Project tools: System Design from First Principles (website)
Entry point: `<tools>` = `npm --prefix .site run tools --` · Language: TypeScript, run directly by Node 26's built-in type stripping (no tsx, CR-0001) · Decision: ADR-0001, ADR-0002, CR-0001

All tools live in `.site/tools/`, are reached through `.site/tools/cli.ts`, and have tests like any other code. Until a tool exists, agents do its job by hand as AGENTS.md describes. Known IDs for the plan checker are REQ criteria (`REQ-…-NNN.ACn`), `NFR-NNN`, and the `TOOL-NN.ACn` criteria below.

## Core tools

### TOOL-01 Context packer
- Commands: `<tools> pack <task-or-round> [--out FILE]`
- Does: bundles the task packets (all packets of a round), every `file.md#heading` section they `load`, the requirement sections their `delivers` name (from `specs/features/*.md`), their module entries (from `specs/modules.md`), the current contents of their `files` (if they exist), and the last 10 lines of `.blueprint/progress.md`. Prints a token estimate (characters ÷ 4) and warns when a bundle exceeds the packet's `context_budget_tokens` (summed per round).
- Builds on: custom (uses the plan parser from TOOL-02)
- Runs: locally
- Built in: T-00.03, before the first product task
- Acceptance:
  - TOOL-01.AC1: Given a packet that delivers REQ-CNT-001.AC1, when `pack` runs, then the bundle holds the REQ-CNT-001 section and the MOD-vault module entry.
  - TOOL-01.AC2: Given a bundle larger than the packet's budget, when `pack` runs, then it prints a warning with both numbers.
  - TOOL-01.AC3: Given `load: [specs/standards.md#testing]`, when `pack` runs, then only that heading's section is included, not the whole file.
  - TOOL-01.AC4: Given a round ID, when `pack R-05 --out R-05-pack.md` runs, then one file holds every packet of R-05 in order.

### TOOL-02 Plan tracker
- Commands: `<tools> status`, `<tools> next`, `<tools> done <task>`
- Does: `status` shows the phase, gates, task counts by status, open conflicts, the next tasks and the last 5 progress lines. `next` lists tasks whose dependencies are done, grouped by round, marking `parallel_safe` ones. `done` sets `status: done` in the packet, appends `<time> · <round> · <task> · done` to progress.md, and updates `build.last_done` in state.json.
- Builds on: custom; a small parser for the T9 frontmatter subset (no YAML dependency)
- Runs: locally
- Built in: T-00.02
- Acceptance:
  - TOOL-02.AC1: Given T-00.01 is done and T-00.02 depends on it, when `next` runs, then T-00.02 is listed under R-01.
  - TOOL-02.AC2: Given `done T-00.02`, when it runs, then the packet's status is `done`, progress.md gains one line, and state.json's `build.last_done` is `T-00.02`.
  - TOOL-02.AC3: Given an unknown task ID, when `done` runs, then it exits non-zero with "Unknown task".

### TOOL-03 Plan checker
- Commands: `<tools> check`, `<tools> trace`
- Does: `check` exits non-zero when: a requirement lacks criteria, a module or a task (unless deferred); a task delivers an unknown ID, depends on an unknown task, lacks a T9 section, is larger than M, or sits in a dependency cycle; a done task's criteria have no test tagged `@req`; an `@req` tag names no known criterion; a conflict is open, untyped or undecided; a coverage-map topic is open; a task's points don't match its size (S → 1 or 2, M → 3 or 5, Careful → at least 3); a round exceeds its budget or holds more than one Careful task, or the Careful task isn't first. `trace` writes `specs/trace.md` (criterion → task → test file).
- Builds on: custom (plan parser from TOOL-02)
- Runs: locally, pre-commit, CI
- Built in: T-00.04
- Acceptance:
  - TOOL-03.AC1: Given a seeded packet that delivers `REQ-XXX-999.AC1`, when `check` runs, then it fails naming that ID.
  - TOOL-03.AC2: Given two packets that depend on each other, when `check` runs, then it fails naming the cycle.
  - TOOL-03.AC3: Given a round whose points exceed the budget in rounds.md, when `check` runs, then it fails naming the round.
  - TOOL-03.AC4: Given a done task whose criterion has no `@req` test, when `check` runs, then it fails naming the criterion.
  - TOOL-03.AC5: Given the real plan as shipped, when `check` runs, then it passes (only `@req` checks for done tasks apply).
  - TOOL-03.AC6: Given `trace`, when it runs, then specs/trace.md lists every active criterion with its task.

### TOOL-04 Code map
- Commands: `<tools> map [path] [--budget N]`
- Does: lists exported signatures (functions, types, components' props) in a folder using the TypeScript compiler API, trimmed to a token budget.
- Builds on: typescript 6.0.3 compiler API
- Runs: locally
- Built in: T-02.01, once several modules exist
- Acceptance:
  - TOOL-04.AC1: Given `.site/src/features/book`, when `map` runs, then it prints `contentsOf`, `neighbours`, `firstChapter`, `romanNumeral` with their signatures and no function bodies.
  - TOOL-04.AC2: Given `--budget 500`, when the output would be larger, then it's cut to about 500 tokens with "… (truncated)".

### TOOL-05 Impact analyzer
- Commands: `<tools> impact <paths…>`
- Does: maps changed paths to features (their `paths`), modules (their `Paths:`), requirements, tasks and `@req`-tagged tests, and flags changes that cross feature boundaries.
- Builds on: custom (plan parser)
- Runs: locally, used in change requests
- Built in: T-02.01
- Acceptance:
  - TOOL-05.AC1: Given `.site/src/features/diagrams/pairs.ts`, when `impact` runs, then it names MOD-diagrams, FEAT-diagrams, REQ-DIAG-001 and the tests tagged with its criteria.
  - TOOL-05.AC2: Given paths in two features, when `impact` runs, then it prints a cross-feature warning.

### TOOL-06 Boundary rules
- Commands: runs in CI and pre-commit as `npm --prefix .site run lint:boundaries`
- Does: blocks imports of another module's internals (only `src/features/<module>/index.ts` may be imported from outside the module) and enforces the dependency direction in specs/modules.md.
- Builds on: dependency-cruiser 18.8.0 (configured, not custom)
- Runs: pre-commit, CI
- Built in: T-00.10
- Acceptance:
  - TOOL-06.AC1: Given a seeded file in `features/home` importing `features/content/scan.ts`, when the check runs, then it fails naming both files.
  - TOOL-06.AC2: Given `features/markdown` importing `features/content/index.ts`, when the check runs, then it fails (the markdown module may not depend on the vault module).

## Project-specific tools

### TOOL-07 Token build
- Trigger: a UI with design tokens (design/tokens.json, ADR-0010)
- Commands: `<tools> tokens` (also runs before `astro build`)
- Does: turns design/tokens.json (DTCG 2025.10) into `.site/src/features/site/tokens.css`: custom properties for primitives, `theme-light` values on `:root`, `theme-dark` values under `@media (prefers-color-scheme: dark)`. Fails on a broken `{reference}`.
- Builds on: custom
- Runs: locally, CI
- Built in: T-01.01, before the first styled screen
- Acceptance:
  - TOOL-07.AC1: Given tokens.json, when `tokens` runs, then tokens.css defines `--color-text` as `#1b2230` on `:root` and `#e6e9ee` inside the dark media query.
  - TOOL-07.AC2: Given a token referencing `{color.missing}`, when `tokens` runs, then it exits non-zero naming the token path.

### TOOL-08 Contrast check
- Trigger: NFR-003, design tokens
- Commands: `<tools> contrast`
- Does: checks every text/background pair listed in the tool (text, text-muted, accent, accent-hover on bg, surface, code-bg; on-accent on accent) for both themes against WCAG 2.2 AA (4.5:1 normal text; 3:1 large text and UI).
- Builds on: custom (WCAG relative-luminance formula)
- Runs: CI
- Built in: T-01.01
- Acceptance:
  - TOOL-08.AC1: Given the shipped tokens, when `contrast` runs, then every pair passes and the lowest ratio is printed.
  - TOOL-08.AC2: Given `text-muted` changed to `#9aa3b0` in light mode, when `contrast` runs, then it fails naming the pair and its ratio.
  - TOOL-08.AC3: Given a `#1d5fbf`, `rgb(…)` or `hsl(…)` colour in a component's CSS or an `.astro` style block outside `tokens.css`, when `contrast` runs, then it fails naming the file and line (CR-0003: the standards' "no raw colour values" rule, with no new dependency).

### TOOL-09 Screen test harness (screenshots, axe, JS off)
- Trigger: screens with specified states (design/screens/*.md), NFR-003, NFR-004, NFR-010, NFR-011
- Commands: `npm --prefix .site run test:e2e` (Playwright), `npm --prefix .site run test:e2e -- --update-snapshots` to approve baselines
- Does: Playwright projects for light/dark × JS on/off at 320, 768 and 1280 px against `astro preview` of a fixture vault; helpers `expectNoA11yViolations(page)` (axe), `expectNoHorizontalScroll(page)`, `expectOnlySameOriginRequests(page)` (NFR-008) and `expectNoCookies(context)`.
- Builds on: @playwright/test 1.65.1, @axe-core/playwright 4.14.0
- Runs: CI
- Built in: T-01.14, before the first screen task
- Acceptance:
  - TOOL-09.AC1: Given a page with an image missing alt text, when the harness runs, then the axe helper fails naming the rule.
  - TOOL-09.AC2: Given a page wider than 320 px, when `expectNoHorizontalScroll` runs at 320 px, then it fails.
  - TOOL-09.AC3: Given a page that requests a third-party URL, when `expectOnlySameOriginRequests` runs, then it fails naming the URL.

### TOOL-10 Lighthouse budgets
- Trigger: NFR-001 (Core Web Vitals budget)
- Commands: `npm --prefix .site run test:lighthouse`
- Does: Lighthouse CI (mobile preset) on home, contents and Chapter 1 from `astro preview`; fails when LCP > 2.5 s, CLS > 0.1, or any category < 95.
- Builds on: @lhci/cli 0.16.1
- Runs: CI
- Built in: T-01.20
- Acceptance:
  - TOOL-10.AC1: Given the budgets file, when the run finishes, then the report lists LCP and CLS for each page and fails the job if a budget is exceeded.

### TOOL-11 Build-size check
- Trigger: NFR-002
- Commands: `<tools> size`
- Does: reads `dist/`; per page sums compressed (gzip) HTML, CSS, fonts and JS it references; fails when JS > 60 KB or HTML+CSS+fonts > 250 KB for any page; warns per SVG over 250 KB (W-DIAGRAM-LARGE).
- Builds on: custom (node:zlib)
- Runs: CI
- Built in: T-01.20
- Acceptance:
  - TOOL-11.AC1: Given a page referencing 70 KB of compressed JS, when `size` runs, then it fails naming the page and the number.
  - TOOL-11.AC2: Given the homepage, when `size` runs, then it reports 0 KB of JS.

### TOOL-12 Link check
- Trigger: REQ-SITE-013 (base path), contracts/routes.md
- Commands: `<tools> links`
- Does: runs linkinator over `astro preview` under the real base path; fails on any broken internal link or asset, and on any internal `href`/`src` that doesn't start with the base path.
- Builds on: linkinator 8.1.0
- Runs: CI
- Built in: T-01.20
- Acceptance:
  - TOOL-12.AC1: Given a built page with `href="/book/x/"` (no base path), when `links` runs, then it fails naming the page.
  - TOOL-12.AC2: Given the full site, when `links` runs, then every internal link resolves.

### TOOL-13 Secret scanner
- Trigger: a public repository (CNF-003); almost every project
- Commands: pre-commit hook `.site/tools/hooks/pre-commit` (installed by `npm --prefix .site run setup-hooks`) and a CI job
- Does: runs the gitleaks 8.30.1 binary on staged changes (hook) and on the whole history (CI).
- Builds on: gitleaks 8.30.1 (MIT binary)
- Runs: pre-commit, CI
- Built in: T-00.06
- Acceptance:
  - TOOL-13.AC1: Given a staged file containing a fake AWS-style key from gitleaks' own test fixtures, when committing, then the hook blocks the commit.
  - TOOL-13.AC2: Given the CI job, when it runs on the repository, then it passes on a clean history.

### TOOL-14 Dependency audit
- Trigger: third-party dependencies; the 7-day cooldown (specs/stack.md)
- Commands: `<tools> audit`
- Does: runs `npm audit --audit-level=high`; checks every version in package-lock.json was published at least 7 days before the lockfile change (registry `time` data); writes a CycloneDX SBOM with `npm sbom --sbom-format cyclonedx` for each release; checks licences against an allow-list (MIT, ISC, BSD-2/3, Apache-2.0, OFL-1.1, 0BSD, BlueOak-1.0.0).
- Builds on: npm 11.20.0 built-ins
- Runs: CI (weekly scheduled run as well)
- Built in: T-00.06
- Acceptance:
  - TOOL-14.AC1: Given a lockfile entry published 2 days before the change, when `audit` runs, then it fails naming the package.
  - TOOL-14.AC2: Given a dependency with licence GPL-3.0, when `audit` runs, then it fails naming the package.

### TOOL-15 Build-message harness
- Trigger: NFR-013, REQ-CNT-007, contracts/build-messages.md
- Commands: `npm --prefix .site run test:messages`
- Does: builds small broken fixture vaults (`.site/tests/fixtures/broken/<code>/`) through the real loader and asserts each produces exactly its message code, file, line and fix text, and that errors exit non-zero while warnings don't.
- Builds on: vitest 5.1.1
- Runs: CI
- Built in: T-01.02 (harness), with one case added by each task that introduces a message code
- Acceptance:
  - TOOL-15.AC1: Given the fixture `broken/E-BOOK-MISSING`, when the harness runs, then the build fails with E-BOOK-MISSING and the fix text from build-messages.md.
  - TOOL-15.AC2: Given a code listed in build-messages.md with no fixture, when the harness runs, then it fails naming the code.

### TOOL-16 Fixture vault generator
- Trigger: NFR-006 (build time at 60 chapters and 100 articles)
- Commands: `<tools> gen-vault <dir> --chapters 60 --articles 100`
- Does: writes a realistic vault (parts, chapters with headings, footnotes, math, diagram pairs copied from test fixtures, articles with dates) for timing the build.
- Builds on: custom
- Runs: CI (hardening)
- Built in: T-04.02
- Acceptance:
  - TOOL-16.AC1: Given `--chapters 60 --articles 100`, when it runs, then the folder builds without errors and contains 60 chapters and 100 articles.
