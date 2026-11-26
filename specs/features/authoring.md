---
id: FEAT-authoring
title: Authoring workflow
paths: [.site/tools/sync.ts, sync.cmd, WRITING-GUIDE.md, templates/**]
---
# FEAT-authoring: Authoring workflow

How the author goes from writing in Obsidian to a live website with one action, and how they learn every feature the site offers. Added by CR-0005 at the author's request: "I will only write parts, chapters and draw diagrams."

The author's folders (per part): `chapter-<n>_<slug>.md` (written), `excalidraw/<name>.excalidraw.md` (drawn; gitignored), and `diagram/<name>-light.svg` / `-dark.svg` (put there by sync from Obsidian's auto-export).

## Requirements

### REQ-AUTH-001 One-step publish (sync)
Priority: must · Screens: none · Journeys: J5
WHEN the author runs sync (double-clicking `sync.cmd` at the vault root, or `npm --prefix .site run sync`) THE SYSTEM SHALL pull new remote commits (fast-forward only), collect the diagram images (REQ-AUTH-002), check that every drawing is exported and current, build the site, show what changed, ask for a one-line message, then commit and push to `main`; at the first problem it shall stop before committing, with a plain-language message.
- REQ-AUTH-001.AC1: Given a new chapter and its drawing's exported images, when sync runs and the author enters "Add chapter 2", then one commit with that message holds the chapter and its `diagram/` images, and it's pushed to `origin main`.
- REQ-AUTH-001.AC2: Given a drawing saved after its images were exported, when sync runs, then it stops before committing and names the drawing with "open it in Obsidian and save it (Ctrl+S)".
- REQ-AUTH-001.AC3: Given a site build that fails, when sync runs, then it stops before committing and shows the build's report.
- REQ-AUTH-001.AC4: Given nothing changed since the last sync, when sync runs, then it says "Nothing new to publish" and makes no commit.
- REQ-AUTH-001.AC5: Given new commits on GitHub (for example a merged Dependabot update), when sync runs, then it pulls them first; if a fast-forward isn't possible it stops and explains what to do.
- REQ-AUTH-001.AC6: Given the push succeeded, when sync ends, then it prints the link to the GitHub Actions run list and the site's address.

### REQ-AUTH-002 Diagram images collected into diagram/
Priority: must · Screens: none · Journeys: J5
WHEN sync runs THE SYSTEM SHALL move each `excalidraw/<name>.excalidraw.light.svg` and `.excalidraw.dark.svg` that Excalidraw wrote into the same part's `diagram/` folder as `<name>-light.svg` and `<name>-dark.svg`, replacing older copies, so `excalidraw/` holds only drawings; and it shall refuse a drawing whose images are missing, one-sided or older than the drawing.
- REQ-AUTH-002.AC1: Given `part-1_foundations/excalidraw/01_computer-architecture.excalidraw.light.svg` and `.dark.svg`, when sync runs, then `part-1_foundations/diagram/01_computer-architecture-light.svg` and `-dark.svg` hold their contents and the originals are gone.
- REQ-AUTH-002.AC2: Given a drawing with a light export but no dark one, when sync runs, then it stops, naming the drawing and the missing dark image.
- REQ-AUTH-002.AC3: Given a drawing with no exports and no images in `diagram/`, when sync runs, then it stops with "open it in Obsidian and save it (Ctrl+S)".

### REQ-AUTH-003 Writing guide and templates
Priority: must · Screens: none · Journeys: J5
WHEN the author sets out to write THE SYSTEM SHALL provide `WRITING-GUIDE.md` at the vault root and templates in `templates/` (chapter, article, `book.md`, `about.md`) covering every frontmatter key, every supported Obsidian syntax, diagrams, drafts, featured items, renaming with `moved_from`, sync, and what each build or sync message means, saying which features are live on the site and which are coming.
- REQ-AUTH-003.AC1: Given `specs/contracts/frontmatter.schema.json`, when the guide is checked, then every key in it is explained in the guide and appears in at least one template.
- REQ-AUTH-003.AC2: Given `specs/contracts/build-messages.md`, when the guide is checked, then every message code is explained in its "When sync or the build stops" section.
- REQ-AUTH-003.AC3: Given the `templates/` folder, when the content rules decide what to publish (REQ-CNT-003), then nothing in it is published: it's outside `part-*/` and `articles/`.
