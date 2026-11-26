---
id: FEAT-diagrams
title: Beautiful diagrams
paths: [src/features/diagrams/**]
---
# FEAT-diagrams: Beautiful diagrams

Signature feature 1: Excalidraw diagrams are the star of every chapter. They're large, vector-crisp, always in the right theme, never cropped on a phone, and can be opened full screen. The author designs each drawing in Obsidian's Excalidraw plugin, which writes the light and dark SVGs itself on save (ADR-0012). The site only displays those SVGs and never re-draws a diagram, so colours are exactly as designed.

## Requirements

### REQ-DIAG-001 Light and dark pairs become one figure
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN an entry embeds a diagram pair (`<base>-light.svg` and `<base>-dark.svg`, or the plugin's auto-export names `<base>.light.svg` and `<base>.dark.svg`, embedded one after the other or either one alone) THE SYSTEM SHALL render one figure that shows the light variant in light mode and the dark variant in dark mode.
- REQ-DIAG-001.AC1: Given Chapter 1's `![[01-light.svg]]` followed by `![[01-dark.svg]]`, when it's rendered, then exactly one figure appears.
- REQ-DIAG-001.AC2: Given a reader in dark mode, when the figure loads, then `01-dark.svg` is shown and `01-light.svg` isn't downloaded.
- REQ-DIAG-001.AC3: Given only `![[01-light.svg]]` is embedded but `01-dark.svg` exists next to it, when it's rendered, then the figure still follows the theme.
- REQ-DIAG-001.AC4: Given an SVG with no `-light`/`-dark` partner, when it's rendered, then it shows in both themes.
- REQ-DIAG-001.AC5: Given JavaScript is off, when the reader's system switches theme, then the figure switches too.
- REQ-DIAG-001.AC6: Given `![[02_moores-law.excalidraw.light.svg]]` with `02_moores-law.excalidraw.dark.svg` next to it, when it's rendered, then one figure follows the theme (exact auto-export names are confirmed by spike S-02).

### REQ-DIAG-002 Diagrams blend into the page
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN a diagram is shown THE SYSTEM SHALL place it on a page background that matches the background of the exported SVG (`#ffffff` light, `#121212` dark), with no frame, at full reading-column width up to 900 px, and never wider than the screen.
- REQ-DIAG-002.AC1: Given a 916 px wide SVG on a 1280 px screen, when it's shown, then it's 900 px wide and centred, breaking out of the 70-character text column.
- REQ-DIAG-002.AC2: Given a 490 px wide SVG, when it's shown on a 1280 px screen, then it's shown at its natural width or the text-column width, whichever is larger, and stays crisp.
- REQ-DIAG-002.AC3: Given a 320 px screen, when any diagram is shown, then it fits the screen width with no horizontal page scroll.

### REQ-DIAG-003 Full-screen view
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN a reader selects a diagram THE SYSTEM SHALL open it full screen on the theme background, where it can be zoomed with pinch, the wheel, or the + and − keys, and panned, and closed with Escape, the close button or a tap outside it.
- REQ-DIAG-003.AC1: Given a phone, when the reader taps a diagram, then it opens full screen and can be pinch-zoomed to 400%.
- REQ-DIAG-003.AC2: Given the full-screen view is open, when the reader presses Escape, then it closes and focus returns to the diagram.
- REQ-DIAG-003.AC3: Given JavaScript is off, when the reader selects a diagram, then the SVG opens on its own in the same tab.

### REQ-DIAG-004 Accessible diagrams
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN a diagram is rendered THE SYSTEM SHALL give it a text alternative from Obsidian's embed alias `![[01-light.svg|Alt text]]`, or else from the text inside the SVG's `<text>` elements (for example "Diagram: Disk, RAM, CPU, Cache, …"), and a caption when the alias is given.
- REQ-DIAG-004.AC1: Given `![[01-light.svg|How a computer is built]]`, when it's rendered, then the alt text and the caption are "How a computer is built".
- REQ-DIAG-004.AC2: Given no alias and an SVG whose text reads "Disk, RAM, CPU, Cache", when it's rendered, then the alt text names those words and the build prints a warning suggesting a caption.

### REQ-DIAG-005 Diagrams don't shift the page
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN a page with diagrams loads THE SYSTEM SHALL reserve each diagram's space from its `viewBox`, so text never jumps while diagrams arrive, and lazy-load diagrams below the first screen.
- REQ-DIAG-005.AC1: Given Chapter 1 on a slow connection, when its diagrams load, then the page's layout shift (CLS) stays ≤ 0.1.

### REQ-DIAG-006 Drawing sources stay private
Priority: must · Screens: none · Journeys: J5
WHEN the author saves Excalidraw drawings in the vault THE SYSTEM SHALL keep the drawing sources (`*.excalidraw.md`, `*.excalidraw`) out of git and off the website, and publish only the exported SVGs; an embed of a drawing resolves to those images (REQ-DIAG-007, CR-0005).
- REQ-DIAG-006.AC1: Given `part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md`, when `git status` runs after it's saved, then the file is ignored (`.gitignore` rule).
- REQ-DIAG-006.AC2: Given a chapter that embeds `![[01_computer-architecture.excalidraw]]`, when the build runs, then the drawing source is never read or published, and the embed resolves to its exported images (REQ-DIAG-007).
- REQ-DIAG-006.AC3: Given the built site, when its files are listed, then none is an Excalidraw source.

### REQ-DIAG-007 Drawing embeds become themed images
Priority: must · Screens: design/screens/chapter.md · Journeys: J1, J5
WHEN an entry embeds a drawing (`![[<name>.excalidraw]]`, with an optional `|caption`) THE SYSTEM SHALL render the `<name>-light.svg` / `<name>-dark.svg` pair from the vault's `diagram/` folders (closest to the entry first) as one themed figure, without reading the gitignored drawing source (CR-0005).
- REQ-DIAG-007.AC1: Given `![[01_computer-architecture.excalidraw|How a computer is put together]]` and `part-1_foundations/diagram/01_computer-architecture-light.svg` and `-dark.svg`, when it's rendered, then one figure follows the theme, with that caption.
- REQ-DIAG-007.AC2: Given a drawing embed with no images in any `diagram/` folder, when the build runs, then it stops with E-DRAWING-NOT-EXPORTED naming the entry, the line and the drawing, and saying to save it in Obsidian and run sync.
