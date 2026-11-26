# Constitution: System Design from First Principles (website)

## Precedence
1. Correctness and security. 2. The APoSD complexity test. 3. SOLID and the heuristics. 4. Style.

## Principles for this project
- **The vault is sacred.** No code, tool or agent writes to the author's content files (`book.md`, `about.md`, `part-*/**`, `articles/**`, `.obsidian/**`). If content must change, tell the author with a build message (CNF-001 is the model).
- **Deep modules.** `renderObsidian(source, ctx)` hides all Obsidian syntax; `getBook()` hides all book rules; `url(route)` hides all address rules. Callers never learn plugin order, naming rules or the base path.
- **Information hiding.** The `-light`/`-dark` naming rule lives only in MOD-diagrams. The `part-<n>_`/`chapter-<n>_` rules live only in MOD-vault. Route shapes live only in MOD-site.
- **General versus special.** MOD-obsidian-markdown knows nothing about books; book rules enter only through `RenderContext`.
- **Pull complexity down.** The content module handles missing titles, missing dates and lone diagram variants itself, so pages never check for them.
- **Define errors out of existence.** A diagram without a partner just shows in both themes. A part with only drafts just isn't shown. An undated article sorts last. Only genuinely broken content (a missing file, invalid YAML, bad math) is an error.
- **Errors in one place.** Every problem is a `BuildIssue` collected by MOD-site and printed once, in the author's words.
- **Progressive enhancement.** HTML first; CSS second; JavaScript only to improve something that already works (ADR-0006).
- **Signature features first.** In any trade-off, beautiful diagrams and calm reading win over new features.
- **YAGNI.** One book, no client framework, no runtime services. The second book, redirects, search and RSS stay deferred until asked for.

## Testing stance
Interface first; tests before the implementation; a failing test first for every bug fix; tests through public interfaces only. Golden tests (input Markdown → expected HTML) for every Obsidian syntax and for Chapter 1, using a fixture vault in `.site/tests/fixtures/vault/`. Playwright end-to-end tests for every journey (J1–J4, J6), every screen state, JS on and off, light and dark, at 320, 768 and 1280 px, with axe checks and screenshot comparisons against approved baselines. Lighthouse CI for NFR-001. Content files of the real vault are a read-only end-to-end fixture.

## Definition of done
- **Task:** every acceptance test passes with `@req` tags; both reviews pass; lint, type, boundary, link and size checks are green; committed with `Refs: <task>`; marked done.
- **Phase:** every task done; `<tools> check` clean; the demo passes on `astro preview` and then on the live site; G6 approved.
- **Release:** NFRs measured (Lighthouse, axe, sizes, publish time); the security checklist is done; the restore drill passed; runbooks are current; the author has enabled 2FA and branch protection.

## Non-negotiables
- WCAG 2.2 AA (ASM-001); ASVS L1.
- No cookies, no browser storage of personal data, no third-party requests (NFR-008).
- Reading works without JavaScript (NFR-004).
- $0 a month (NFR-007).
- Supported browsers: the last two versions of Chrome, Edge, Firefox and Safari (desktop, iOS and Android).
- No secrets in the repository; it's public (CNF-003).

## Changing this document
Only through an ADR the user approves.
