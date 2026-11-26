# ADR-0003: Load the vault with a custom Astro content loader that owns all book knowledge
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
Design it twice for the overall architecture (architecture.md): option A, a content-loader monolith, versus option B, a pre-compile pipeline. Errors must name the original file and line (REQ-CNT-007). Chapters need per-entry render options, such as the heading-number prefix (REQ-READ-004). Astro 7 documents custom loaders and `LoaderContext.renderMarkdown()` ([Astro Content Loader API](https://docs.astro.build/en/reference/content-loader-reference/), checked 2026-11-26), but not per-entry plugin options.

## Options
1. **Custom loader that renders each entry with MOD-obsidian-markdown:** `vaultLoader()` scans the vault, validates frontmatter with zod, orders the book, calls `renderObsidian()` per entry with the entry's context, and stores `rendered: { html, metadata }` for Astro's `render()`. Pros: Sees original files, so positions are exact; per-entry options are trivial; all book rules in one deep module; one build step. Cons: We call our unified pipeline ourselves instead of `renderMarkdown()`, so Shiki configuration is ours (via @astrojs/markdown-remark's processor); depends on the loader's `rendered` field (spike S-01).
2. **Pre-compile the vault to standard Markdown, then use Astro's `glob()` loader:** A script converts embeds, pairs, callouts and footnotes into plain Markdown/HTML in a generated folder before `astro build`. Pros: Uses Astro's stock loader. Cons: Temporal decomposition (two steps that must run in order); loses original positions unless we add source maps; Obsidian knowledge split across the script and Astro config; duplicated content on disk.

## Decision
Option 1. It keeps Obsidian and book knowledge in two deep modules (vault, markdown), with errors that point at the author's own lines. Fallback inside option 1, if S-01 shows `rendered` can't carry our HTML: render in `getStaticPaths` from the loader's raw body. Same modules, different call site.

## Consequences
Easier: one build; exact error positions; tests run the loader against a fixture vault. Harder: we maintain the Shiki setup. Follow-up: spike S-01 in phase 0 (custom loader, `rendered` field, a dot-folder root and content outside the root).
