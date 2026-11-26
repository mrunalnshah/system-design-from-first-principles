# Conflicts and feasibility: System Design from First Principles (website)

Passes run at intake, after the specification, during the stack choice and after the architecture (2026-11-26). No impossible conflict found. Trade-offs CNF-001 and CNF-003 were decided by the user at G2; CNF-004 to CNF-006 are unverified facts with a scheduled check.

### CNF-001 Obsidian math commands the web renderer doesn't support
- Between: G-03 and NFR-009 (render vault files unchanged), REQ-READ-008.AC2, Chapter 1's `$\micro s$` (also used inside the Excalidraw source)
- Type: trade-off (was: unverified; checked 2026-11-26)
- Why: tested live. KaTeX 0.19.1 (the latest release, from the npm registry) fails `\micro s` with "Undefined control sequence: \micro", and renders `\mu s` and `\frac{1}{10^3}` correctly. Obsidian renders `\micro` through MathJax.
- Options:
  1. Keep KaTeX (build-time, no JavaScript in the browser, NFR-004) and define `\micro` as a site-wide macro for an upright µ, with no edit to the chapter. Cost: one line of configuration; any future Obsidian-only command needs its own macro, and the build reports unknown commands as build errors naming the file and line.
  2. Use MathJax at build time instead. Cost: heavier output, and it still needs checking for `\micro`.
  3. Change the chapter to `\mu s`. Cost: breaks G-03 (the author edits for the website's sake).
- Status: resolved
- Decision: option 3 (user, G2, 2026-11-26). The author changes Chapter 1 to `\mu s` themself; the site defines no macros. Until then, the build stops with a REQ-CNT-007 error naming the file and line and suggesting `\mu`. Unknown math commands are always build errors (REQ-READ-008.AC2). G-03 still holds otherwise. Done: the author changed Chapter 1 line 18 to `$\mu s$` (seen 2026-11-26).

### CNF-002 Substack-like homepage without copying Substack
- Between: the homepage feature, BLUEPRINT 4.3 rule 4
- Type: trade-off (minor)
- Why: Substack's layout and interaction patterns can be borrowed, but not its logo, brand colours, copy or other assets.
- Options:
  1. Borrow the layout pattern (hero featured item, post list, sidebar) with an original visual style.
- Status: accepted
- Decision: option 1, by blueprint rule.

### CNF-003 Free GitHub Pages needs a public repository, which publishes drafts
- Between: ASM-002 (one GitHub repository; push publishes), REQ-CNT-004 (drafts stay hidden), NFR-007 ($0 a month), the hosting answer (free host, free address)
- Type: trade-off
- Why: GitHub Pages on GitHub Free works only from public repositories ([GitHub's plans](https://docs.github.com/en/get-started/learning-about-github/githubs-plans), [Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits), checked 2026-11-26). A public repository shows every file in the vault on github.com: drafts, `draft: true` chapters, `%%comments%%`, the planning files. `draft: true` hides a file from the website, not from GitHub.
- Options:
  1. **Private GitHub repository + Cloudflare Pages (free)**: address `<name>.pages.dev`, 500 builds a month, works with private repositories ([Cloudflare Pages limits](https://developers.cloudflare.com/pages/platform/limits)). Drafts stay private. Cost: a free Cloudflare account to create and connect once.
  2. **Public GitHub repository + GitHub Pages**: address `mrunalnshah.github.io/<repo>/`, next to the portfolio. One account. Cost: every draft and note in the vault is publicly readable on GitHub.
  3. **Private vault repository + a second public repository that receives only the built site** (GitHub Pages). Drafts stay private, the address stays on github.io. Cost: two repositories and a deploy key to set up; more for a light coder to keep running.
  4. GitHub Pro (~$4 a month): breaks the $0 budget, and GitHub's docs disagree on whether Pro still allows Pages from private repositories.
- Status: resolved
- Decision: option 2 (user, G2, 2026-11-26): one **public** GitHub repository + GitHub Pages at `https://mrunalnshah.github.io/<repo>/`. The author accepts that every vault file, drafts included, is publicly readable on GitHub. Consequences: the site is built for a base path (REQ-SITE-013); no secret may ever be committed (a secret scanner runs in CI); GitHub Actions is free for public repositories (verify at G3).


### CNF-004 Astro 7 loader and dot-folder assumptions
- Between: ADR-0002 (`.site/` dot folder, content one level up), ADR-0003 (custom loader stores our own `rendered.html`, per-entry options), REQ-CNT-007 (exact positions)
- Type: unverified
- Why: Astro's docs (checked 2026-11-26) confirm custom loaders and `renderMarkdown()`, but not that a loader may store HTML rendered by our own pipeline in `rendered`, nor how Vite and Astro behave with a project in a dot folder reading files outside its root.
- Options:
  1. Spike S-01 early in phase 0: a 1-hour throwaway build of Chapter 1 through a custom loader from `.site/`. Fallbacks: render in `getStaticPaths` (ADR-0003), or `site/` + `userIgnoreFilters` (ADR-0002, by change request).
- Status: accepted (spike scheduled)
- Decision: spike S-01 = T-00.07 in round R-03, before any content code (T-01.03 depends on it).

### CNF-005 GitHub Pages 404 on a project site
- Between: REQ-SITE-004.AC1 (friendly page with HTTP 404 under the base path), CNF-003 (GitHub Pages project site)
- Type: unverified
- Why: GitHub's docs ([custom 404](https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-custom-404-page-for-your-github-pages-site)) describe a `404.html` at the publishing root, but not explicitly for an Actions-deployed project site under a sub-path.
- Options:
  1. Check it on the first live deploy of the walking skeleton (request an unknown address; expect status 404 and the friendly page). If it fails, accept GitHub's default 404 for now and log a change request.
- Status: accepted (checked in the walking skeleton)
- Decision: checked live in T-00.08 (round R-03), the first deploy; the styled 404 follows in T-03.04.

### CNF-006 Homepage hero diagram size versus the 4G speed budget
- Between: REQ-HOME-001 (hero diagram), NFR-001 (LCP ≤ 2.5 s on 4G), diagram 01 (~213 KB per variant)
- Type: unverified
- Why: the hero diagram is likely the homepage's largest element. Whether a 213 KB SVG meets the LCP budget under Lighthouse's mobile throttling has to be measured, not guessed.
- Options:
  1. Measure in phase 1 with Lighthouse CI. If it's over budget: preload the hero variant, or the author picks a lighter hero diagram (diagram 02 is ~10 KB), or we add lossless SVG optimisation at build time (a new dependency, needing an ADR).
- Status: accepted (measured in phase 1)
- Decision: Lighthouse CI (TOOL-10, built in T-01.20, R-10) measures it in T-02.05 (R-11) when the hero is built; the options above if it fails.

### CNF-007 Gitignored drawing sources versus backup
- Between: REQ-DIAG-006 (drawing sources never in git, the author's wish at G4), operations backups (GitHub as the backup copy)
- Type: trade-off
- Why: a file that's gitignored is never pushed, so GitHub keeps no copy of it.
- Options:
  1. Gitignore the sources; the author keeps their own backup. Cost: the author's backup is the only copy.
  2. Commit the sources (public, backed up); the site still never publishes them.
- Status: resolved
- Decision: option 1 (user, G4, 2026-11-26: "Yes, I'll back them up"). A launch-checklist item reminds the author.

### CNF-008 Excalidraw plugin auto-export file names
- Between: ADR-0012 (the plugin writes light/dark SVGs on save), REQ-DIAG-001 (pair naming)
- Type: unverified
- Why: the plugin's settings `autoexportSVG` and `autoExportLightAndDark` exist in the installed plugin 2.29.4 (read from `.obsidian/plugins/obsidian-excalidraw-plugin/data.json`), but the exact names and folder of the files it writes weren't observed.
- Options:
  1. Spike S-02 (2 minutes, with the author): turn both settings on, save one drawing, and record the file names; the pair rule already accepts `-light`/`-dark` and `.light`/`.dark`.
- Status: accepted (spike scheduled)
- Decision: S-02 = T-00.11 in round R-04, before the diagram index (T-01.12 depends on it).
