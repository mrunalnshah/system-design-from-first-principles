# Launch checklist: System Design from First Principles (website)

The release definition of done (AGENTS.md): NFRs measured, security review done, backup restore tested, runbooks
done, and this list ticked. Items marked **Author** are settings only you can change or check: an agent never
changes account or repository settings. Tick each one here when it's done, with the date.

## Your content (Author)
- [ ] **Write about.md** at the vault's top level: a title and a few paragraphs about you and the book. Until then the
      site has no About page and every build warns W-ABOUT-MISSING. Check book.md's fields too (title, subtitle,
      author, author_url, hero_image): the build names anything missing.

## Your GitHub account and repository (Author)
- [ ] **Two-factor authentication** on your GitHub account (security.md B1: stops someone who has your password
      from defacing the site). GitHub → your picture → Settings → Password and authentication → Enable two-factor
      authentication. Keep the recovery codes outside the vault.
- [ ] **Protect `main`** (security.md B1). Repository → Settings → Rules → Rulesets → New ruleset → New branch
      ruleset. Name it "main"; set **Enforcement status** to **Active** (it starts as Disabled); under Target
      branches choose **Add target → Include default branch**; turn on **Restrict deletions** and **Block force
      pushes**; save. Turn on nothing else: in particular not **Require status checks to pass** or **Require a pull
      request before merging**, because `sync.cmd` pushes straight to `main` and either rule would refuse every
      publish.
- [x] **Pages source: GitHub Actions** (operations.md R2). Repository → Settings → Pages → Source. Done 2026-11-26
      (R-03, T-00.05: the first deploy needed it).
- [ ] **Enforce HTTPS** is on (security.md B4). Repository → Settings → Pages → Enforce HTTPS. On by default for
      `github.io` addresses; just confirm the box is ticked.
- [ ] **Dependabot alerts** are on. Repository → Settings → Code security (on newer pages: Advanced Security) →
      Dependabot alerts. The weekly update pull requests come from `.github/dependabot.yml` (operations.md R3).

## Obsidian (Author)
Both done with you in R-04 (T-00.11); operations.md R0 has the steps if you ever set up another computer.
- [x] **Excalidraw: Auto-export SVG** on (setting `autoexportSVG`). Done 2026-11-26.
- [x] **Excalidraw: Export both dark- and light-themed image** on (setting `autoExportLightAndDark`). Done 2026-11-26.
      Keep Auto-export PNG off (WRITING-GUIDE.md).

## Your own backups (Author)
- [ ] **A backup of the drawing sources.** The `*.excalidraw.md` files are gitignored, so they're only on your
      computer (operations.md#backups-and-restore, CNF-007). Copy them to a cloud drive or another disk, or back up
      the vault folder without its `.git` and `.site/node_modules` folders (everything else is already on GitHub).
      Without them the site is still restorable (the SVGs are in git), but you couldn't edit a drawing.
- [ ] **A monthly reminder** in your calendar to open the site and a chapter (NFR-012). Add a line to the table
      "Monthly site check" in specs/operations.md, or ask the agent to.

## A pull request from someone else
The workflow skips pull requests from forks on purpose (security.md B2: their code never runs here), and GitHub shows
the skipped checks as passed. So before merging one: read its changes, then ask the agent to bring the branch into
this repository and open a pull request from it there, which runs every check.

## Checked by the agent (R-15)
- [x] Security review: specs/security.md, "Review results" (T-04.01).
- [x] Budgets at the book's planned size, measured locally: a 60-chapter, 100-article vault builds in about 12 s
      against 2 minutes, every page within the size budgets (T-04.02). In CI on every push from the first push
      after R-15, with Lighthouse on a median of three runs.
- [x] Every build message has a seeded test (T-04.03, CR-0011).
- [ ] Journeys, accessibility, no-JavaScript and responsive suites (T-04.04).
- [x] Restore drill from a fresh clone, publish time, cost and availability: specs/operations.md, "Release readiness
      results" (T-04.05).
- [ ] **The first green push after R-15.** Until then the live site is R-13's, and NFR-001 (Lighthouse) and NFR-006
      (the full-size build) haven't run in CI. If the homepage still fails Lighthouse, read its row in the run's
      table and raise a change request rather than re-running. Then re-measure the publish time in operations.md.
- [ ] Gate G6 for phase 4 (AGENTS.md, end of a roadmap phase).
