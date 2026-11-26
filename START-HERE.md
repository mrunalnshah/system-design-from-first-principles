# Start here: System Design from First Principles (website)

This package is the complete plan for your book's website: what to build, how it's designed and the order to build it in. The building is split into rounds. The first round was 8 points (Medium); after it you said it was easy, so the rest are 13 points each (plan/rounds.md).

## What's inside
`specs/` requirements, architecture, decisions and standards · `design/` the design system and `design/preview/`, the approved picture of the finished product · `plan/` roadmap, rounds and task packets · `AGENTS.md` rules for any AI agent · `plan/tools.md` the tools phase 0 builds for this project, including one that loads only what each task needs.

## See it first
Open `design/preview/index.html` in any browser to see what you're building before round R-01.

## Put the package in place (once)
1. Move everything inside `sdfp-website-architecture/` (including the hidden `.blueprint/` and `.claude/` folders) to your vault root, next to `part-1_foundations/`. Or unzip `sdfp-website-architecture.zip` there. Then delete the empty `sdfp-website-architecture/` folder.
2. In that folder, run `git init` if it isn't a repository yet. Your vault root becomes the repository; the website's code will live in a hidden `.site/` folder that Obsidian never shows.
3. Remember that the repository will be **public** on GitHub (you chose this at G2): drafts and notes will be readable there. Drawing sources (`*.excalidraw.md`) are gitignored, so **back them up yourself**, for example by keeping the vault in a cloud drive.

## Things only you can do (the AI will ask at the right time)
- **R-03 (T-00.05):** create the public GitHub repository `system-design-from-first-principles`, push, then in its Settings → Pages set Source to **GitHub Actions**. Turn on two-factor authentication for your GitHub account and protect the `main` branch.
- **R-04 (T-00.11):** in Obsidian → Settings → Excalidraw, turn on **Auto-export SVG** and **Export both dark- and light-themed image**, then save one drawing so the AI can record the file names.
- **Before launch:** write `book.md` (title, author, author_url, hero_image) and `about.md` in Obsidian. The build tells you exactly what's missing.

## Rounds and care levels
- A round is one conversation's worth of work. Run one round, check the result, then start a fresh conversation for the next.
- After round R-01, and whenever a round runs out, your AI asks how it felt and makes the remaining rounds one step bigger or smaller. You can also say "rounds feel too long" or "too short" at any time.
- Tasks are Quick, Standard or Careful. Before a Careful task, switch to your tool's most careful option if it has one, such as a thinking mode or a stronger model. R-03 and R-15 start with a Careful task.

## Build with a coding agent (best for building)
1. Do "Put the package in place" above.
2. Start your agent in the vault folder and send `Read AGENTS.md, then run round R-01.` In Claude Code you can also type `/round R-01`.
3. After each round, answer how it felt if asked, check the result, start a fresh conversation (`/clear` in Claude Code) and run the next round.

## Build with a chat AI (Claude.ai and similar)
1. In Claude.ai, create a Project and add these files to its knowledge: AGENTS.md, specs/constitution.md, specs/standards.md, specs/architecture.md, specs/modules.md, plan/roadmap.md, plan/rounds.md. Project files are cached, which makes reusing them cheaper. In other chat AIs, attach the same files to each new chat.
2. For each round, run `npm --prefix .site run tools -- pack R-xx --out R-xx-pack.md` on your computer, start a new chat, attach `R-xx-pack.md`, and send `Run round R-xx.` The pack is temporary; don't commit it. Until phase 0 has built the packer, attach the round's task packets and the files they list.
3. Save the files your AI produces into your repository, run the Verify commands from the task packets, and paste back any failures.
4. Mark each finished task: `npm --prefix .site run tools -- done T-xx.yy`.

## Round plan at a glance
| Round | Phase | Goal | Points | Care |
|---|---|---|---|---|
| R-01 | 0 | Project scaffold and tracker | 5 | Standard |
| R-02 | 0 | Packer and plan checker | 8 | Standard |
| R-03 | 0 | Publish pipeline, secrets, spike S-01, first live slice | 13 | Careful |
| R-04 | 0 | Boundaries, audit, Excalidraw check | 6 | Standard |
| R-05 | 1 | Tokens, build report, vault scan | 11 | Standard |
| R-06 | 1 | Vault validation, summaries, Markdown core, embeds | 13 | Standard |
| R-07 | 1 | Math, headings, footnotes, harness, diagram index | 13 | Standard |
| R-08 | 1 | Figures, Chapter 1 live, site shell | 13 | Standard |
| R-09 | 1 | Reader layout, menu, margin notes, viewer | 11 | Standard |
| R-10 | 1 | Performance and link guards | 3 | Standard |

… and 5 more (R-11 to R-15 in `plan/rounds.md`). About 17–34 hours of building are left, roughly 2–3½ weeks at 10 hours a week.

## If a round runs out
Progress is logged after every step, so you lose at most one step. Start a fresh conversation and send `Resume round R-xx from .blueprint/progress.md.` Your AI finishes that task first and makes the following rounds one step smaller, unless you say it was a one-off.

## Changing the plan
Ask your agent for a change request (AGENTS.md explains how). Don't edit the frozen specs directly. Changing the round size isn't a change request: just tell your agent.
