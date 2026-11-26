# ADR-0010: Plain CSS with custom properties generated from design/tokens.json
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
Tokens are DTCG 2025.10 with light and dark themes (design/tokens.json). The look must match the approved design preview (GD), stay small (NFR-002) and switch theme without JS (REQ-SITE-002).

## Options
1. **A token build to `tokens.css` (custom properties, themes under `@media (prefers-color-scheme: dark)`), plus Astro-scoped component CSS:** A small project tool turns tokens into CSS and fails on broken references; components use `var(--…)` only. Pros: No extra dependency; the design system stays the single source; tiny CSS. Cons: We write the token build (a small tool, with tests).
2. **Tailwind CSS with a theme built from the tokens:** Utility classes in components. Pros: Fast to write; well known to AI agents. Cons: Another dependency and config; tokens get duplicated into Tailwind's theme format; long class strings make the components harder to read for a newcomer.

## Decision
Option 1.

## Consequences
The contrast tool (TOOL-08) checks the token pairs and also fails on any raw colour value outside `tokens.css` (CR-0003: no stylesheet-linter dependency).
