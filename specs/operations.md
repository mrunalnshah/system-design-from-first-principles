# Operations: System Design from First Principles (website)

The author runs everything alone, with an AI agent's help. There's no server to operate, so operations means publishing, rolling back and keeping dependencies healthy.

## Service levels
| SLO | Target | Measured by |
|---|---|---|
| Publish success | 95% of pushes to `main` that pass checks are live within 10 minutes (NFR-005) | Duration of the `publish` workflow runs (GitHub Actions history) |
| Site reachable | Best effort from GitHub Pages; no SLA on the free plan (NFR-012) | The author opens the site once a month (calendar reminder) |
| Build health | `main` is green after every push | Workflow status badge in README.md |

## Alerts
- A failed workflow run → GitHub's default notification email to the author. Nothing else; there's no runtime telemetry, by choice.
- Dependabot pull requests → a weekly email.

## Environments (ADR-0011)
| Environment | What | How |
|---|---|---|
| Development | Live reload while writing code | `npm --prefix .site run dev` |
| Staging | The exact production build, served under the real base path | `npm --prefix .site run build && npm --prefix .site run preview`, or download the Pages artifact from a CI run |
| Production | GitHub Pages | Automatic on push to `main` |

## Deploy
One workflow, `.github/workflows/publish.yml`, runs on every push to `main`, on a manual run (Actions → publish → Run workflow) and every Monday for new advisories (checks only), and on pull requests from this repository (checks only, without deploy; pull requests from forks don't run at all, security.md B2):
1. Check jobs in parallel: `checks` (lint + type check + boundary rules; unit and golden tests; plan checker, TOOL-03; `npm audit`, TOOL-14), `secrets` (gitleaks over the whole history) and `e2e` (the Playwright + axe screen suites, light and dark, JavaScript on and off, 320/768/1280 px).
2. `build` (needs all three): `astro build` (fails on any build error; the report then shows on the run page as "Build errors on the run page"), then the build-size check, the link check, Lighthouse CI (each page's median of three mobile runs, with a table in the job summary), and the timed build of a generated 60-chapter, 100-article vault (TOOL-16, ≤ 2 minutes, every page within the size budgets).
3. `deploy` (needs `build`; pushes to `main` and manual runs only): `actions/upload-pages-artifact` → `actions/deploy-pages`.

One-time setup (author): see `plan/launch-checklist.md` (Pages source, 2FA, branch protection, Enforce HTTPS).

## Rollback
- **Content or code mistake:** `git revert <commit>` and push. The previous state is live within 10 minutes.
- **Faster:** in GitHub → Actions, open the last good `publish` run and choose "Re-run all jobs". It rebuilds that commit and deploys it. (A later push will deploy `main` again, so revert as well.)

## Backups and restore
- Copies: the author's local vault, the GitHub repository and any clone. RPO = the last push. RTO ≤ 30 minutes (clone, `npm ci`, push).
- **Drawing sources (`*.excalidraw.md`) are gitignored and exist only on the author's computer.** The author keeps their own backup (CNF-007), for example the vault folder in a cloud drive. The exported SVGs are in git, so the website itself is always restorable; only re-editing a drawing needs its source.
- Restore drill (in the hardening phase, then yearly): clone the repository into an empty folder, run `npm --prefix .site ci && npm --prefix .site run build`, and compare page counts with the live sitemap.

## Runbooks
### R0 Making or changing a diagram
1. One-time: in Obsidian → Settings → Excalidraw → embedding and exporting, turn on **Auto-export SVG** and **Export both dark- and light-themed image** (settings `autoexportSVG` and `autoExportLightAndDark` in plugin 2.29.4).
2. Draw or edit in Excalidraw and save (Ctrl+S). The plugin writes the light and dark SVGs next to the drawing.
3. Embed the drawing itself in the chapter, ideally with a caption: `![[name.excalidraw|What it shows]]`. Obsidian shows the drawing; the website shows its themed images (REQ-DIAG-007).
4. Double-click `sync.cmd`. It moves the images into `diagram/`, checks every drawing is exported and current, builds the site, then commits and pushes. The drawing source stays out of git automatically (CR-0005).

### R1 The publish failed
1. Open the failed run (link in the email). If the build stopped on your content, the run's page shows "The build stopped, so nothing was published" with the build's messages (the job summary, from the step "Build errors on the run page"); the whole log is in the `build` job's Build step.
2. Each item names the file, the line where known, and the fix (contracts/build-messages.md). Fix it in Obsidian and push again. Nothing changed on the live site meanwhile.
3. If the Lighthouse step failed, its table in the job summary shows each page's median run: LCP, CLS, FCP, Speed Index, TBT and the four scores (each must be at least 95: performance, accessibility, best practices, SEO), then any element that shifted. Each page is judged on its median of three runs, so a single slow run doesn't fail it; a page that keeps failing needs a change, not a re-run.
4. If the failure is in a check rather than in content (lint, tests, audit), ask the AI agent: "Read AGENTS.md, then fix the failing publish run <link>."

### R2 The site shows GitHub's 404 for every page
Check Settings → Pages: Source must be "GitHub Actions", and the last `deploy` job must be green. Re-run the last good run.

### R3 A dependency update (Dependabot pull request)
Ask the AI agent to review and merge it only if every check is green. Major versions need an ADR (stack.md upgrade policy).

### R4 Renaming or renumbering a chapter
- Changing only the number (`chapter-3_` → `chapter-4_`) keeps the address (ADR-0009).
- Changing the slug part changes the address. Add the old slug to `moved_from: [old-slug]` in the renamed file, so old links redirect (REQ-BOOK-007). Changing only the displayed `title:` needs nothing.

### R5 Taking something offline quickly
Add `draft: true` to its frontmatter and push. It disappears from the site in the next publish. It stays visible in the public repository and its history (CNF-003).

### R6 Moving to a custom domain later
Change `site` and `base` in `.site/astro.config.ts` (ADR-0007), add the domain in Settings → Pages, and push. Every link follows automatically (REQ-SITE-013.AC2).

## Cost
$0 a month: GitHub Free, a public repository, GitHub Actions minutes for public repositories, and GitHub Pages. A custom domain would cost about $10–15 a year (not planned).

## Release readiness results (T-04.05, 2026-11-27)
Re-check these at each phase review and before any change to the hosting.

| Check | Result | How it was measured |
|---|---|---|
| Publish time (NFR-005: push to live ≤ 10 minutes at the 95th percentile) | **Pass**: 95th percentile 5.3 minutes, median 1.4, slowest 6.2, over 26 deployed pushes | GitHub's public Actions API, every push to `main` whose `deploy` job succeeded, from the first deploy (run 45867241897, 8a44f20, 2026-11-26) to the last (run 46012992820, 96533f3): from the push (the run's creation) to the end of its `deploy` job. The 95th percentile is the 25th of 26 by nearest rank (run 46012992820); the slowest is run 45872237199. Failed runs deploy nothing and aren't counted. The time grows with the suites: the first green push after R-15 (three Lighthouse runs per page, the full-size build) is to be re-measured here; the build job's own limit is 12 minutes |
| Cost (NFR-007: $0 a month) | **Pass** | The repository is public, on GitHub Free; Actions minutes are free for public repositories and Pages is free (stack.md); no paid service, domain or secret is used. Check at each phase review |
| Availability (NFR-012: no server of our own) | **Pass**, by design | The site is static files on GitHub Pages' CDN; there's nothing to run or keep up. The author opens the site once a month (launch checklist) and notes the date and result under "Monthly site check" below; an outage of GitHub Pages is GitHub's |
| Restore drill (Backups and restore) | **Pass**: 63 s against the 30-minute RTO | A fresh `git clone` from GitHub into an empty folder (at 02df6ba, the last push; its run failed Lighthouse, so the live site is still 96533f3, whose pages are the same), `npm --prefix .site ci` (849 packages, 47 s), `npm --prefix .site run build` (3 warnings, the same as the author's own build: no about.md, two diagrams without a caption). It built 4 indexed pages plus 404.html, the same 4 addresses as the live sitemap. Repeat yearly |
| Drawing sources | **Author** | Gitignored, so not in the drill: the author's own backup is in `plan/launch-checklist.md` |

## Monthly site check (NFR-012)
Once a month, open the site and a chapter, and add a line here: the date, what loaded, anything odd.

| Date | Result |
|---|---|
| 2026-11-27 | Loads: the live sitemap lists the homepage, contents, Chapter 1 and articles (checked in the restore drill, T-04.05) |
