# Stack: System Design from First Principles (website)
Decision: ADR-0001 · Verified on 2026-11-26 · Release-age cooldown: 7 days (every version below was released on or before 2026-11-19)

Changed by CR-0001 (2026-11-26): github-slugger, eslint-plugin-jsx-a11y and tsx removed after a maintenance audit.

Sources: the npm registry (`npm view <pkg> time --json`), nodejs.org (`dist/index.json`, `nodejs/Release/schedule.json`), and GitHub releases (`api.github.com/repos/<repo>/releases`). Each version is the newest stable release at least 7 days old.

## Runtime and build
| Component | Choice | Version | Channel | Verified on | Source | End of life | Why |
|---|---|---|---|---|---|---|---|
| Runtime | Node.js | 26.13.1 | LTS "Lithium" | 2026-11-26 | nodejs.org dist index (released 2026-11-10) | 2029-04-30 | Current LTS; meets every engine requirement below (highest: Astro ≥ 22.23.4) |
| Package manager | npm (bundled with Node 26.13.1) | 11.20.0 | stable | 2026-11-26 | nodejs.org dist index | follows Node | Simplest for a light coder; supports `min-release-age` (npm ≥ 11.10) |
| Site generator | astro | 7.4.13 | stable | 2026-11-26 | npm (2026-11-18) | — | ADR-0001: no JS by default, typed content collections, official GitHub Pages deploy |
| Markdown pipeline | @astrojs/markdown-remark | 7.3.10 | stable | 2026-11-26 | npm (2026-11-18) | — | Astro's peer (`^7.3.0`); hosts our remark/rehype plugins |
| Sitemap | @astrojs/sitemap | 3.7.6 | stable | 2026-11-26 | npm (2026-11-18) | — | REQ-SITE-005 |
| Type checking | @astrojs/check | 0.9.12 | stable | 2026-11-26 | npm (2026-10-21) | — | `astro check` in CI |
| Language | typescript | 6.0.3 | stable | 2026-11-26 | npm (2026-04-16) | — | **Not 7.0.2**: @astrojs/check needs `^5 \|\| ^6`, and typescript-eslint needs `<6.1.0` |
| Math parsing | remark-math | 6.0.0 | stable | 2026-11-26 | npm (2023-09-19) | — | Parses `$…$` and `$$…$$` |
| Math typesetting | katex | 0.19.1 | stable | 2026-11-26 | npm (2026-10-23) | — | Build-time HTML+MathML (REQ-READ-008). Called by our own small rehype step, **not rehype-katex**, which pins katex `^0.16` and can't report file/line build errors |
| Footnotes, tables, task lists | remark-gfm (bundled by Astro) | via @astrojs/markdown-remark | stable | 2026-11-26 | npm | — | REQ-CNT-005; footnotes feed the margin-note plugin |
| Code highlighting | shiki (bundled by Astro, `^4.6.0`) | via astro | stable | 2026-11-26 | npm | — | Build-time highlighting, light/dark themes (REQ-CNT-005.AC4) |
| Content schemas | zod (bundled by Astro as `astro/zod`, `^4.6.7`) | via astro | stable | 2026-11-26 | npm | — | Frontmatter validation → plain-language errors (REQ-CNT-007) |
| Tree walking | unist-util-visit | 5.2.0 | stable | 2026-11-26 | npm (2026-10-24) | — | Our remark/rehype plugins |
| Diagram zoom | @panzoom/panzoom | 4.6.2 | stable | 2026-11-26 | npm (2026-04-02) | — | Full-screen pinch/zoom/pan (REQ-DIAG-003); small, framework-free |
| Reading font | @fontsource-variable/source-serif-4 | 5.3.1 | stable | 2026-11-26 | npm (2026-10-11) | — | Self-hosted serif (OFL); no third-party font requests |
| UI font | @fontsource-variable/inter | 5.3.0 | stable | 2026-11-26 | npm (2026-07-19) | — | Self-hosted sans (OFL) |
| Code font | @fontsource-variable/jetbrains-mono | 5.3.0 | stable | 2026-11-26 | npm (2026-07-19) | — | Self-hosted mono (OFL) |

## Testing and quality
| Component | Choice | Version | Channel | Verified on | Source | End of life | Why |
|---|---|---|---|---|---|---|---|
| Unit and golden tests | vitest | 5.1.1 | stable | 2026-11-26 | npm (2026-11-18) | — | 5.1.2 (2026-11-25) is inside the cooldown |
| End-to-end and screenshots | @playwright/test | 1.65.1 | stable | 2026-11-26 | npm (2026-11-13) | — | Screens, states, JS-off tests, network/cookie checks |
| Accessibility | @axe-core/playwright | 4.14.0 | stable | 2026-11-26 | npm (2026-10-15) | — | NFR-003; 4.14.1 (2026-11-24) is inside the cooldown |
| Performance budgets | @lhci/cli | 0.16.1 | stable | 2026-11-26 | npm (2026-11-11) | — | NFR-001 in CI |
| Link check | linkinator | 8.1.0 | stable | 2026-11-26 | npm (2026-08-29) | — | REQ-SITE-013 base-path links |
| Lint | eslint | 10.15.0 | stable | 2026-11-26 | npm (2026-11-13) | — | |
| Lint (TS) | typescript-eslint | 8.73.0 | stable | 2026-11-26 | npm (2026-11-16) | — | 8.74.0 (2026-11-23) is inside the cooldown |
| Lint (Astro) | eslint-plugin-astro | 3.2.1 | stable | 2026-11-26 | npm (2026-09-17) | — | 3.2.2 (2026-11-26) is inside the cooldown |
| Format | prettier | 3.10.1 | stable | 2026-11-26 | npm (2026-11-12) | — | |
| Format (Astro) | prettier-plugin-astro | 1.1.2 | stable | 2026-11-26 | npm (2026-10-23) | — | |
| Boundary rules (TOOL-06) | dependency-cruiser | 18.8.0 | stable | 2026-11-26 | npm (2026-11-16) | — | Blocks imports of another module's internals; 18.9.0 (2026-11-22) is inside the cooldown |
| Script runner for project tools | Node.js built-in TypeScript type stripping | Node 26.13.1 | LTS | 2026-11-26 | verified locally (`node main.ts`) | 2029-04-30 | `npm run tools -- …` runs `node tools/cli.ts`; no tsx (CR-0001) |

## CI and hosting
| Component | Choice | Version | Channel | Verified on | Source | End of life | Why |
|---|---|---|---|---|---|---|---|
| Code host | GitHub, **public** repository `system-design-from-first-principles` | — | — | 2026-11-26 | CNF-003 decision | — | Free GitHub Pages needs a public repository |
| Hosting | GitHub Pages (project site, base path `/system-design-from-first-principles/`) | — | — | 2026-11-26 | docs.github.com | — | $0; address `https://mrunalnshah.github.io/system-design-from-first-principles/` (repo name chosen at G3) |
| CI | GitHub Actions | — | — | 2026-11-26 | docs.github.com | — | Builds, tests and deploys on push |
| Action | actions/checkout | v7.0.1 | stable | 2026-11-26 | GitHub releases (2026-07-20) | — | |
| Action | actions/setup-node | v7.1.0 | stable | 2026-11-26 | GitHub releases (2026-10-08) | — | |
| Action | actions/configure-pages | v6.0.0 | — | 2026-11-26 | GitHub releases (2026-03-25) | — | **Not used** (T-00.05): it only reports the base path, which astro.config.ts fixes, and would need extra Pages permissions in the build job |
| Action | actions/upload-pages-artifact | v5.0.0 | stable | 2026-11-26 | GitHub releases (2026-04-10) | — | |
| Action | actions/deploy-pages | v5.0.1 | stable | 2026-11-26 | GitHub releases (2026-09-01) | — | Deploys only when every check passed (REQ-SITE-007.AC2) |
| Secret scanner | gitleaks (binary) | v8.30.1 | stable | 2026-11-26 | GitHub releases (2026-03-21) | — | Runs the MIT-licensed binary directly, in pre-commit and CI; avoids the gitleaks-action licence question. The npm package named `gitleaks` is unrelated and must not be used |
| Analytics | none | — | — | 2026-11-26 | user's choice at G3 | — | REQ-SITE-006 deferred |

Actions are pinned to full commit SHAs in the workflow, with the tag in a comment (resolved live in T-00.05, 2026-11-26): checkout `3d3c42e5…`, setup-node `949feb24…`, upload-pages-artifact `fc324d35…`, deploy-pages `368f8252…`.

## Compatibility notes
- Node 26.13.1 meets every engine range found: astro `>=22.23.4`, vitest `^22.12 || ^24 || >=26`, @lhci/cli `>=22.19.0`, eslint `^22.13 || >=24`, eslint-plugin-astro `>=26.3.0`, dependency-cruiser `^22||^24||>=26`, @axe-core/playwright `>=22.12.0`, linkinator `>=22`.
- TypeScript is pinned to 6.0.3 because of @astrojs/check (`^5.0.0 || ^6.0.0`) and typescript-eslint (`>=4.8.4 <6.1.0`).
- eslint-plugin-astro 3.2.1 needs eslint `>=10` and typescript-eslint `>=8.61`: met. Its peers eslint-plugin-jsx-a11y and eslint-plugin-jsx-a11y-x are **optional** and not used: jsx-a11y 6.10.2 doesn't support ESLint 10 and has stalled since 2024-10 (CR-0001). Accessibility is guarded by axe (TOOL-09) and the contrast check (TOOL-08).
- Heading anchors use our own `slugify()` in MOD-obsidian-markdown instead of github-slugger, which has had no commits since 2023-09 (CR-0001).
- Project tools are plain TypeScript run by Node 26's native type stripping: erasable syntax only (`erasableSyntaxOnly`), and relative imports end in `.ts` (CR-0001).
- vitest 5.1.1 accepts Astro's vite `^8.3.8`.
- KaTeX 0.19.1 doesn't define `\micro` (tested). The author writes `\mu` (CNF-001), and unknown commands are build errors.
- Everything above is verified from registry metadata. T-00.01 re-verifies it by installing and running `npm ls` and a smoke build.

## Supply-chain settings
- `.npmrc`: `min-release-age=7` (unit: days, npm ≥ 11.10; [npm config docs](https://docs.npmjs.com/cli/v11/using-npm/config/)), plus `engine-strict=true` and `save-exact=true`. A security fix inside the window needs a recorded exception via `min-release-age-exclude` and a line in this file.
- `package-lock.json` is committed; CI uses `npm ci`.
- Dependabot (GitHub, free) groups weekly updates, with `cooldown: default-days: 7`. T-00.01 confirms the exact key in GitHub's docs.
- CI runs `npm audit --audit-level=high` and gitleaks on every push.

## Upgrade policy
- Monthly, or when Dependabot opens a pull request: the AI agent updates one group at a time, and every CI check must pass before merging.
- Major versions (Astro, Node, TypeScript) need an ADR and a phase-end review.
- Node moves to the next LTS line before 2029-04-30 (the end of life for Node 26).
