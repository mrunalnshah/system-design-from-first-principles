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
One workflow, `.github/workflows/publish.yml`, runs on every push to `main` (and checks only, without deploy, on pull requests):
1. `checks` jobs in parallel: lint + type check + boundary rules; unit and golden tests; gitleaks; `npm audit`; plan checker (TOOL-03).
2. `build`: `astro build` (fails on any build error and prints the grouped issue summary), then the link check, the build-size check and the Playwright + axe suites against `astro preview`, then Lighthouse CI.
3. `deploy` (needs all of the above): `actions/upload-pages-artifact` → `actions/deploy-pages`.

One-time setup (author, in the launch checklist): repository Settings → Pages → Source: **GitHub Actions**; 2FA on the account; branch protection on `main`.

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
1. Open the failed run (link in the email) → the `build` job → the "Build report" step at the end of the log.
2. Each item names the file, the line and the fix (contracts/build-messages.md). Fix it in Obsidian and push again.
3. If the failure is in a check rather than in content (lint, tests, audit), ask the AI agent: "Read AGENTS.md, then fix the failing publish run <link>."

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
