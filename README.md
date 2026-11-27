# System Design from First Principles

[![publish](https://github.com/mrunalnshah/system-design-from-first-principles/actions/workflows/publish.yml/badge.svg?branch=main)](https://github.com/mrunalnshah/system-design-from-first-principles/actions/workflows/publish.yml)

A book on how large systems work, from the hardware up, by Mrunal Nirajkumar Shah.
Read it at **https://mrunalnshah.github.io/system-design-from-first-principles/**.

This repository is the author's Obsidian vault. The chapters live in `part-<n>_<name>/`, the articles in `articles/` (made with the first article),
and the website's code in the hidden `.site/` folder. Every push to `main` is checked, built and published by the
`publish` workflow above; a build that finds a problem publishes nothing and says which file and line to fix.

## Writing and publishing
- How to write chapters, articles and diagrams, and what each build message means: [WRITING-GUIDE.md](WRITING-GUIDE.md).
- To publish: save in Obsidian, then double-click `sync.cmd`.
- When a publish fails, or to roll back, restore or take something offline: [specs/operations.md](specs/operations.md) (runbooks R0–R6).

## Working on the website
Node 26.13.1 or later, with npm 11.10.0 or later. The repository root has no `package.json`; the site's commands run through `.site`:

```
npm --prefix .site ci
npm --prefix .site run dev        # live reload while writing code
npm --prefix .site run build      # the production build into .site/dist
npm --prefix .site test           # unit and golden tests
npm --prefix .site run test:e2e   # the screen suites
npm --prefix .site run tools -- status
```

The plan, the specs and the rules for AI agents: [START-HERE.md](START-HERE.md), [AGENTS.md](AGENTS.md), `specs/`, `design/` and `plan/`; before launch, [plan/launch-checklist.md](plan/launch-checklist.md).

## Privacy and cost
The site sets no cookies, stores nothing in the browser and makes no request to any other site: fonts and scripts are
served from the site itself, and there's no analytics ([specs/security.md](specs/security.md)). Hosting and builds cost nothing (GitHub
Pages and Actions for a public repository).

© Mrunal Nirajkumar Shah.
