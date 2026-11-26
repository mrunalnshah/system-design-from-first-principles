# ADR-0001: Build the site with Astro 7 and custom Obsidian plugins, hosted on GitHub Pages
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
- The author writes in Obsidian, is a light coder, and has an AI agent write nearly all code (intake round 2).
- Vault files must render unchanged (G-03, NFR-009): embeds, light/dark SVG pairs, math, footnotes as margin notes, callouts.
- Reading must work without JavaScript, and the homepage ships none (NFR-004, REQ-HOME-004). Fast on a 4G phone (NFR-001, NFR-002).
- $0 a month (NFR-007). Public repository + GitHub Pages under a base path (CNF-003, REQ-SITE-013).
- Bad frontmatter or a broken embed must give a plain-language error naming the file and line (REQ-CNT-007, NFR-013).
- The user said "you decide" at G3, so this is logged as ASM-006.

## Options
1. **Astro 7.4.13 with ~6 custom remark/rehype plugins:** a static generator that renders pages to HTML at build time and ships no JavaScript unless a component asks for it. Content collections validate frontmatter with zod schemas. Pros: matches NFR-004 by default; typed schemas give REQ-CNT-007's errors almost for free; the official GitHub Pages deploy supports a base path; build-time Shiki; well known to AI coding agents. Cons: our plugins (embeds, diagram pairs, margin notes, section numbers, math errors, callouts) are ours to maintain; Astro releases a major version roughly yearly.
2. **Eleventy 3.1.8 with markdown-it plugins:** a minimal generator with templates in Nunjucks or JavaScript. Pros: very simple and close to plain HTML; no client JS. Cons: no typed content schemas, so frontmatter validation and error messages are hand-written; fewer maintained plugins for Obsidian syntax.
3. **Quartz 5 (Obsidian publishing framework):** Pros: embeds, wikilinks, callouts and LaTeX work out of the box. Cons: its "digital garden" layout and Preact components would need a heavy fork for the Substack + Crafting Interpreters homepage and reader; it ships client-side JS (SPA routing, graph view), which works against NFR-004; forks are hard to update; its newest release (5.2.2, 2026-11-22) was inside the cooldown.

## Decision
Option 1, Astro. It is the only option that meets NFR-004 and REQ-CNT-007 by default rather than by extra work, keeps all content as plain Obsidian Markdown (low lock-in), and is the conventional choice that an AI agent will build most reliably for a light-coding maintainer.

## Consequences
- Easier: zero-JS pages; schema-checked frontmatter; one `base` setting for the GitHub Pages path; build-time math and code highlighting.
- Harder: we own about six small Markdown plugins, each needing golden tests against fixture files and Chapter 1.
- Follow-up: T-00.01 verifies and pins the versions in specs/stack.md by installing them; the architecture (ADR-0002 onwards) designs the content module and plugins twice before choosing.
