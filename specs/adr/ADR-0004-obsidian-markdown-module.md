# ADR-0004: One general-purpose Obsidian Markdown module built from small unified plugins behind one function
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
REQ-CNT-005/006 and REQ-READ-004/006/008 all transform the same Markdown trees. The module must stay usable for any Obsidian note (general-purpose) and know nothing about books (special-general mixture red flag). Callers should learn one function, not plugin order.

## Options
1. **unified (remark/rehype) plugins behind `renderObsidian()`:** Six private plugins: wikilinks+embeds (with pair grouping), callouts, highlights+comments, footnotes to margin notes, heading demotion+numbering, KaTeX math; plus remark-gfm, remark-math and Shiki. One exported function takes a `RenderContext`. Pros: Matches Astro's own pipeline; each plugin is small and golden-tested; the interface hides plugin order and options. Cons: Several plugins to maintain.
2. **A markdown-it renderer with Obsidian plugins:** Replace Astro's pipeline with markdown-it and community plugins. Pros: Many community Obsidian plugins exist for markdown-it. Cons: A second Markdown engine next to Astro's; Shiki and heading data need extra glue; weaker positional info for errors.

## Decision
Option 1. The deep interface (`renderObsidian(source, ctx)`) hides every syntax decision; book rules arrive only through `ctx` (heading prefix, resolvers, figure renderer).

## Consequences
Heading numbering and margin-note markup are generic options, so articles reuse the same module with numbering off. Golden tests: one fixture per syntax plus Chapter 1.
