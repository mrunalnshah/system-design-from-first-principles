# ADR-0006: Build reader enhancements as CSS-first HTML with small vanilla scripts, without a UI framework
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
NFR-004 (reading works without JS), REQ-HOME-004 (no JS on home), NFR-002 (≤ 60 KB JS). The interactive parts are the chapter menu (sticky panel / phone sheet / scrollspy), margin notes (margin on wide screens, tap on phones), keyboard previous/next and the diagram viewer. There is no shared client state. This ADR also records the frontend state-management choice (BLUEPRINT 7.6).

## Options
1. **CSS-first HTML + vanilla TypeScript modules:** The menu is a CSS `position: sticky` `<nav>`; scripts add the phone sheet (`<dialog>`) and an IntersectionObserver scrollspy. Margin notes are rendered twice by the markdown module: an inline `<span class="sidenote">` floated into the margin by CSS at 1100 px and wider, and the standard end list shown below 1100 px; on narrow screens a script turns each marker into an `aria-expanded` toggle for its inline note. No client state beyond the DOM. Pros: Works without JS by construction; a few KB of JS; no framework runtime. Cons: Hand-written focus management (dialogs, Escape) needs careful tests.
2. **Astro islands with a UI framework (e.g. Preact):** Hydrated components for the menu, notes and viewer. Pros: Component state model; familiar patterns. Cons: A framework runtime on every reading page; server and client markup to keep in sync; no-JS fallbacks still have to be built separately.

## Decision
Option 1, vanilla progressive enhancement. State management: none. The DOM is the state, and nothing is stored in the browser (NFR-008).

## Consequences
Each script binds to `data-*` hooks, does nothing when its markup is absent, honours `prefers-reduced-motion`, and is tested with JS on and off.
