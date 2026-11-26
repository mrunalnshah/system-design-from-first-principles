# Standards: System Design from First Principles (website)

## Structure
```
<repo root = Obsidian vault>
├── book.md  about.md  part-*/  articles/          author content (never written by tools)
├── AGENTS.md  CLAUDE.md  START-HERE.md  specs/  design/  plan/  .blueprint/  .claude/
├── .github/workflows/publish.yml
└── .site/                                          all code (ADR-0002)
    ├── package.json  package-lock.json  .npmrc  astro.config.ts  tsconfig.json
    ├── src/content.config.ts
    ├── src/pages/**                                thin routes only
    ├── src/features/<module>/index.ts              one public interface per module
    ├── src/features/<module>/**                    internals (private)
    ├── tests/fixtures/vault/**                     fixture vault for golden and e2e tests
    ├── tests/e2e/**                                Playwright
    └── tools/**                                    project tools (plan/tools.md)
```
- `.gitignore` at the root includes `*.excalidraw.md`, `*.excalidraw`, `.site/node_modules/`, `.site/dist/`, `.site/.astro/` and `.obsidian/workspace*.json` (REQ-DIAG-006), plus `sdfp-website-architecture.zip` and `.obsidian/plugins/*/main.js` and `styles.css` (the user's choice after R-01).
- Feature folders map to modules: `content` = MOD-vault, `markdown` = MOD-obsidian-markdown, `diagrams`, `book`, `reader`, `home`, `articles`, `site`.
- **Boundary rule:** code outside a module imports only `src/features/<module>/index.ts` (or its `.astro` components re-exported there). dependency-cruiser (TOOL-06) enforces this and the dependency direction in specs/modules.md.

## Naming
- Glossary terms are mandatory (specs/glossary.md): `Chapter`, not "post" or "lesson"; `DiagramPair`, not "image set"; `MarginNote`, not "sidenote" in code names (the CSS class `sidenote` is allowed).
- TypeScript: `camelCase` functions and variables, `PascalCase` types and components, `kebab-case` file names except `.astro` components (`PascalCase.astro`).
- CSS: component-scoped classes; custom properties come only from `tokens.css` (`--color-text`, `--space-4`, …).

## Errors
- Content problems are never thrown: they're returned as `BuildIssue` values (code from contracts/build-messages.md) and added to `buildIssues`. The build-report integration prints them grouped and exits non-zero on any error.
- Programmer errors (impossible states) throw `Error` with a message that names the invariant.
- New message codes are added to build-messages.md in the same task, with a seeded-error test.

## Comments
Interface comments first, on every exported function and component, before the code. Comments carry intent, units, invariants and reasons (for example "number is unique across the book"), never a paraphrase of the code.

## Testing
- Vitest for unit and golden tests: `*.test.ts` next to the code. Golden fixtures live in `tests/fixtures/` as `name.md` → `name.html` pairs.
- Playwright for end-to-end: `tests/e2e/<screen>.spec.ts`; projects for light/dark × JS on/off; viewports 320, 768 and 1280; `@axe-core/playwright` in every screen test; screenshot baselines are approved at the end of each screen task.
- Every test that proves a criterion carries `// @req REQ-XXX-NNN.ACn`.
- Never mock MOD-obsidian-markdown in MOD-vault tests: use the fixture vault. Never hit the network in tests.

## Logging and observability
Build-time only: Astro's logger for progress, and the build report for issues. No runtime logging or telemetry.

## Security checklist
- [ ] Input validated at the boundary (frontmatter via zod schemas from contracts/frontmatter.schema.json)
- [ ] Authorization: not applicable on the site; workflow permissions least-privilege (security.md)
- [ ] No secrets in code or logs (gitleaks)
- [ ] Output encoded: Markdown HTML comes only from our pipeline; no `set:html` with unchecked strings outside it
- [ ] Any new dependency verified and recorded (stack.md, ADR, cooldown)
- [ ] No third-party requests; CSP meta present

## Red flags
| Red flag | Quick test |
|---|---|
| Shallow module | Is the interface nearly as complex as what it does? |
| Information leakage | Would one design change force edits in several modules? |
| Temporal decomposition | Is code split by the order things happen rather than by what each part knows? |
| Overexposure | Must common callers learn rare options? |
| Pass-through method | Does the method only forward to another with a similar signature? |
| Repetition | Would one fix have to be made in two places? |
| Special-general mixture | Does a general mechanism know about one specific feature? |
| Conjoined methods | Must you read both to understand either? |
| Comment repeats code | Does the comment add intent, units, invariants or a reason? |
| Implementation in the interface | Do interface docs describe internals callers don't need? |
| Vague name | Could the name mean several things? |
| Hard to pick a name | Does the struggle show the thing lacks one clear purpose? |
| Hard to describe | Can a short comment describe it completely? |
| Non-obvious code | Can a newcomer tell what it does, and why, at a glance? |

## Tooling
ESLint 10 (typescript-eslint, eslint-plugin-astro; no jsx-a11y plugin, CR-0001; a rule against raw `/…` link literals); raw colour values outside `tokens.css` are caught by `<tools> contrast` (TOOL-08.AC3, CR-0003), Prettier 3 with prettier-plugin-astro, `astro check` (TypeScript 6.0.3), dependency-cruiser, linkinator, Lighthouse CI, gitleaks, `npm audit`. The project tools are in plan/tools.md, reached through `npm --prefix .site run tools -- <command>`, and run with Node's native TypeScript support: erasable syntax only, `.ts` import extensions (CR-0001).
