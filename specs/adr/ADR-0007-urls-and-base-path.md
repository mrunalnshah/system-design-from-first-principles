# ADR-0007: Build every internal address through one `url()` function on top of Astro's `base` setting
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
The site lives under `/system-design-from-first-principles/` (CNF-003) and may move to a custom domain root later (REQ-SITE-013). Addresses are a public contract (contracts/routes.md). Links come from layouts, components and rendered Markdown (wikilinks).

## Options
1. **Astro `site` + `base` config, one `url(route)` helper, and a link check on `dist/`:** Every link, including those the markdown module resolves, goes through `url()`, which reads `import.meta.env.BASE_URL`. linkinator checks `dist/` in CI. Pros: One place knows the base path and the route shapes; moving to a custom domain changes one setting. Cons: Every link must use the helper (enforced by an ESLint rule against string literals starting with `/` in components, and by the link check).
2. **Relative links everywhere (`../book/x/`):** Compute relative paths from each page. Pros: Works under any base. Cons: Relative paths depend on page depth (change amplification); canonical/Open Graph URLs still need absolute addresses; easy to get wrong in Markdown links.

## Decision
Option 1.

## Consequences
The `Route` type makes invalid routes unrepresentable; the link check catches anything that bypasses it.
