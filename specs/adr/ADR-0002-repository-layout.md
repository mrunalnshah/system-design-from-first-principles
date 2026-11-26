# ADR-0002: Keep the site code in a `.site/` dot folder inside the vault repository
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
The repository root is the Obsidian vault (ASM-002, CNF-003). The Astro project brings `node_modules` (tens of thousands of files). Obsidian reliably skips dot-prefixed folders such as `.obsidian` and `.git`, but forum reports say its "Excluded files" setting doesn't stop indexing a large `node_modules` tree ([Obsidian forum](https://forum.obsidian.md/t/ignore-exclude-completely-files-or-a-folder-from-all-obsidian-indexers-and-parsers/52025), checked 2026-11-26). The author is a light coder and should never see code in Obsidian. The planning package (AGENTS.md, specs/, design/, plan/) also sits at the root, as the blueprint requires.

## Options
1. **`.site/` dot folder in the vault repository:** `.site/package.json`, `.site/src/`, `.site/tests/`, `.site/tools/`; content stays at the root; `.github/workflows/` at the root. Pros: Obsidian never indexes it (same rule as `.obsidian`); one repository, so a push publishes (J5); the author's file tree is unchanged. Cons: Dot folders are hidden by default in macOS Finder; Astro/Vite reading content one level above the project root needs a spike (S-01).
2. **`site/` folder + Obsidian `userIgnoreFilters`:** A visible `site/` folder; `.obsidian/app.json` lists `site/` in the ignore filters. Pros: Conventional, visible name. Cons: Relies on a setting that reports say doesn't stop indexing; edits the author's Obsidian config; code shows up in the vault if the setting is lost.
3. **Separate code repository with the vault as a git submodule:** Code in its own repo; the vault is pulled in at build. Pros: Clean separation. Cons: Two repositories and submodule commands for a light coder; J5 becomes two pushes or a cross-repo trigger.

## Decision
Option 1, `.site/`. It's the only option where Obsidian is guaranteed never to index code, and it keeps one repository and one push. If spike S-01 shows Astro can't build from a dot folder with content outside its root, fall back to option 2 and record it in a change request.

## Consequences
Agents and tools always work in `.site/` (`npm --prefix .site …`). The tools entry point is `npm --prefix .site run tools -- <command>`. `.gitignore` covers `.site/node_modules`, `.site/dist` and `.site/.astro`.
