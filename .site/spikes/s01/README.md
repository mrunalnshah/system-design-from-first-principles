# Spike S-01 (T-00.07): Astro 7 custom loader from the `.site/` dot folder (CNF-004)
Ran 2026-11-26 on Astro 7.4.13, Node 26.13.1, Windows 11. Time used: about 15 minutes of the 1-hour box.

## What was tried
`loader.ts` is a custom content loader registered from a temporary `src/content.config.ts`. It reads
`part-1_foundations/chapter-1_computer-architecture.md` (one folder above the Astro project, which
lives in the dot folder `.site/`), renders it with our own function (standing in for
`renderObsidian()`), passes a per-entry option (`chapterNumber: 1`), and stores the HTML in the
entry's `rendered` field. A temporary page calls `render(entry)` and shows `<Content />`.

## Results
| Question (CNF-004) | Result |
|---|---|
| `astro build` works with the project in a dot folder | yes: 2 pages built in 1.26 s |
| `astro dev` works from the dot folder | yes: HTTP 200 at `/system-design-from-first-principles/spike/` |
| A loader can read vault files one folder above the project | yes: plain `node:fs` read, no Vite file-access issue |
| `store.set({ rendered: { html } })` carries our own HTML to `render()` | yes: the page shows `<p data-spike="own-pipeline" …>` |
| Per-entry render options reach our pipeline | yes: `data-chapter="1"` from the loader's own call |
| `filePath` may point outside the project (`../part-1_…`) | accepted without warnings |

## Decision
Main path of ADR-0003 (custom loader rendering through our pipeline) and ADR-0002 (`.site/` dot
folder): confirmed. Neither fallback is needed. This folder is deleted in T-00.08.
