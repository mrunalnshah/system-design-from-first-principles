# ADR-0012: Let the Excalidraw plugin write light and dark SVGs on save; keep drawing sources out of git
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
At G4 the author asked to use their Excalidraw drawings to make the light and dark images, and to keep the `.excalidraw` sources out of the deployed site and out of git. The author designs with their own colours, and the dark variant is Excalidraw's own dark-mode export: comparing `01-light.svg` and `01-dark.svg` shows every colour mapped (`#e03131` → `#ff8383`, `#a5d8ff` → `#154162`, `#1e1e1e` → `#d3d3d3`). Whatever makes the images must reproduce exactly that look (signature feature 1). A gitignored file never reaches GitHub, so the CI build can't read the sources. The installed plugin (2.29.4) has the settings `autoexportSVG` and `autoExportLightAndDark`, both currently off (`.obsidian/plugins/obsidian-excalidraw-plugin/data.json`).

## Options
1. **The plugin's auto-export writes both SVGs on every save; SVGs are committed, sources gitignored.** Pros: the images are exactly what Excalidraw shows; no manual exporting; no new dependency or tooling; works with sources kept private. Cons: the author must turn two settings on once; the exact file names need a 2-minute check (S-02, CNF-008); sources rely on the author's own backup (CNF-007).
2. **Render SVGs from the sources at build time in CI (headless browser + Excalidraw's export library).** Pros: no exported files in the repository. Cons: the sources would have to be committed (the author wanted them out of git); it needs a browser-based renderer in CI (heavy, slow, fragile across Excalidraw versions); it risks subtle differences from what the author sees in Obsidian.
3. **Keep exporting by hand.** Pros: nothing to set up. Cons: easy to forget one variant or export a stale image; more work per diagram.

## Decision
Option 1. It's the only option that guarantees the website shows exactly what the author designed, keeps the sources private as asked, and adds no tooling. The site accepts both naming styles (`-light`/`-dark` from the existing manual exports, and the plugin's `.light`/`.dark`), so existing chapters keep working.

## Consequences
- Easier: making a diagram is "draw, save, embed" (runbook R0).
- Harder: the drawing sources exist only on the author's computer, so their backup is the author's job (launch checklist).
- Alt text comes from the SVG's own `<text>` elements, so the build never needs the sources (REQ-DIAG-004).
- Follow-up: spike S-02 confirms the auto-export names and folder; `.gitignore` gets the drawing rules (REQ-DIAG-006).

## Amendment (CR-0005, 2026-11-26)
The author embeds drawings directly (`![[<name>.excalidraw|Caption]]`), so Obsidian shows the live drawing. Sync moves the plugin's exports into the part's `diagram/` folder as `<name>-light.svg` / `<name>-dark.svg`, refusing missing or stale ones, and the build swaps each drawing embed for that image pair (REQ-DIAG-007). Chapter files are never rewritten.
