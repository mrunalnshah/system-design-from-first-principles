# ADR-0005: Render diagram pairs as one `<picture>` with a dark-mode source
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
Signature feature 1. A pair must follow the theme without JavaScript (REQ-DIAG-001.AC5), download only one variant (REQ-DIAG-001.AC2, NFR-002), reserve space (REQ-DIAG-005) and never run code from SVG files. The Excalidraw SVGs embed their own fonts and paint solid backgrounds (#ffffff / #121212). Diagram 01 is about 213 KB per variant.

## Options
1. **`<picture>` with `<source media="(prefers-color-scheme: dark)">` + `<img>`:** Light SVG in `<img>`, dark SVG as the source; `width`/`height` from the viewBox; `loading="lazy"` below the fold; wrapped in a `<figure>` that's a link to the SVG (no JS) or a viewer button (JS). Pros: The browser downloads only the matching variant; SVG as an image can't run scripts; no ID clashes between variants; works without JS. Cons: Can't restyle SVG internals with page CSS (not needed: exports already match the theme backgrounds).
2. **Inline both SVGs in the HTML and toggle them with CSS:** Both `<svg>` trees in the page; `@media (prefers-color-scheme)` hides one. Pros: Text inside the SVG is selectable; no extra request. Cons: Every page carries both variants (~430 KB for diagram 01 alone, over NFR-002); duplicate IDs between variants break `<use>` references; inline SVG can carry scripts.

## Decision
Option 1. It meets REQ-DIAG-001 and NFR-002 with no JavaScript. Live switching when the system theme changes is browser behaviour, verified by a Playwright test that emulates the colour-scheme change.

## Consequences
MOD-diagrams owns the pair rule, sizes, alt text (alias, else Excalidraw text elements) and asset routes. The full-screen viewer (REQ-DIAG-003) is a `<dialog>` that loads the already-cached variant into @panzoom/panzoom.
