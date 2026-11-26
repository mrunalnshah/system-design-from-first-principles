---
id: FEAT-content
title: Content from the vault
paths: [src/features/content/**]
---
# FEAT-content: Content from the vault

Reads the Obsidian vault at build time and turns its Markdown files into structured, rendered entries (book, parts, chapters, articles, pages) for every other feature. The author keeps writing in Obsidian and never edits files for the website's sake.

## Requirements

### REQ-CNT-001 Find the book's parts and chapters
Priority: must · Screens: design/screens/contents.md · Journeys: J1, J4, J5
WHEN the build runs THE SYSTEM SHALL treat every folder named `part-<n>_<slug>` at the vault root as a part, and every `chapter-<n>_<slug>.md` inside it as a chapter, ordered by part number and then chapter number.
- REQ-CNT-001.AC1: Given `part-1_foundations/chapter-1_computer-architecture.md` and `part-2_networks/chapter-2_tcp.md`, when the build runs, then the book lists Part 1 "Foundations" with Chapter 1, then Part 2 "Networks" with Chapter 2.
- REQ-CNT-001.AC2: Given `chapter-10_x.md` and `chapter-2_y.md`, when the build runs, then Chapter 2 comes before Chapter 10 (numeric, not text, order).
- REQ-CNT-001.AC3: Given two chapter files with the same number anywhere in the book, when the build runs, then it stops with a build error naming both files.

### REQ-CNT-002 Titles without extra work
Priority: must · Screens: design/screens/chapter.md · Journeys: J5
WHEN a part or chapter has no `title` in its frontmatter THE SYSTEM SHALL derive the title from the slug in its name, in title case.
- REQ-CNT-002.AC1: Given `chapter-1_computer-architecture.md` without a `title`, when the build runs, then its title is "Computer Architecture".
- REQ-CNT-002.AC2: Given `title: "How Computers Work"` in the frontmatter, when the build runs, then its title is "How Computers Work".
- REQ-CNT-002.AC3: Given the folder `part-1_foundations`, when the build runs, then the part's title is "Foundations".

### REQ-CNT-003 Find articles and pages
Priority: must · Screens: design/screens/articles.md, design/screens/about.md · Journeys: J3, J6
WHEN the build runs THE SYSTEM SHALL treat every `.md` file in `articles/` as an article and `about.md` at the vault root as the About page, and ignore every other file and folder (`.obsidian/`, `excalidraw/`, `BLUEPRINT.md`, `FEATURE-DESCRIPTION.md`, planning folders).
- REQ-CNT-003.AC1: Given `articles/why-caches.md`, when the build runs, then an article with slug `why-caches` exists.
- REQ-CNT-003.AC2: Given `BLUEPRINT.md`, `.obsidian/app.json` and `part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md`, when the build runs, then none of them is published.
- REQ-CNT-003.AC3: Given an article without `date`, when the build runs, then it publishes, sorts after dated articles, shows no date, and the build prints a warning naming the file.

### REQ-CNT-004 Drafts stay hidden
Priority: must · Screens: all · Journeys: J5
WHEN an entry's frontmatter has `draft: true` THE SYSTEM SHALL leave it out of every page, list, contents entry, previous/next link and sitemap.
- REQ-CNT-004.AC1: Given Chapter 2 is a draft and Chapters 1 and 3 are not, when Chapter 1 is built, then its "Next" link points to Chapter 3.
- REQ-CNT-004.AC2: Given a draft article, when the build runs, then no page exists at its address and it's in no list.
- REQ-CNT-004.AC3: Given a draft is also `featured: true`, when the homepage is built, then it doesn't appear.

### REQ-CNT-005 Render Obsidian Markdown faithfully
Priority: must · Screens: design/screens/chapter.md, design/screens/article.md · Journeys: J1–J3
WHEN an entry is rendered THE SYSTEM SHALL render CommonMark plus Obsidian's extensions used in the vault: `![[file]]` embeds, `[[note]]` and `[[note|label]]` links, `$…$` and `$$…$$` math, footnotes `[^n]`, callouts `> [!note]`, tables, task lists, highlights `==text==`, comments `%%…%%` (hidden) and fenced code with syntax highlighting.
- REQ-CNT-005.AC1: Given Chapter 1 (after the author's `\mu` edit, CNF-001), when it's rendered, then `$\frac{1}{10^3}$` and `$\mu s$` appear as typeset math, not raw text.
- REQ-CNT-005.AC2: Given `[[chapter-1_computer-architecture|Chapter 1]]` in an article, when it's rendered, then it's a link to Chapter 1's page with the text "Chapter 1".
- REQ-CNT-005.AC3: Given `%%private note%%`, when it's rendered, then the text doesn't appear in the HTML.
- REQ-CNT-005.AC4: Given a fenced `python` code block, when it's rendered, then it's highlighted at build time, with no JavaScript needed.
- REQ-CNT-005.AC5: Given Obsidian's tab-indented nested lists (as in Chapter 1), when they're rendered, then the nesting matches Obsidian's reading view.
- REQ-CNT-005.AC6: Given a highlighted code block, when it's shown in the light and in the dark theme, then its colours follow the theme and its text keeps at least 4.5:1 against the code background (NFR-003, CR-0006).

### REQ-CNT-006 Resolve embeds the way Obsidian does
Priority: must · Screens: design/screens/chapter.md · Journeys: J1, J5
WHEN an entry embeds `![[name]]` THE SYSTEM SHALL find the file by name anywhere in the vault, preferring the match closest to the entry, as Obsidian does.
- REQ-CNT-006.AC1: Given `![[01-light.svg]]` in `part-1_foundations/chapter-1_…md` and the file at `part-1_foundations/diagram/01-light.svg`, when it's rendered, then the diagram appears.
- REQ-CNT-006.AC2: Given `![[missing.svg]]`, when the build runs, then it stops with a build error naming the entry, the line and the missing file name.
- REQ-CNT-006.AC3: Given two files named `01-light.svg` in different folders, when one is embedded from a chapter, then the one in the chapter's own part folder is used.

### REQ-CNT-007 Plain-language build errors
Priority: must · Screens: none · Journeys: J5
WHEN the build finds a problem THE SYSTEM SHALL report the file, the line, what's wrong and how to fix it in one plain sentence; errors stop the publish and warnings don't.
- REQ-CNT-007.AC1: Given invalid YAML in a chapter's frontmatter, when the build runs, then it stops with "part-1_foundations/chapter-1_…md line 3: the frontmatter isn't valid YAML. Check for a missing colon or quote."
- REQ-CNT-007.AC2: Given one error and two warnings, when the build runs, then all three are listed together at the end of the log, errors first, and the exit code is non-zero.

### REQ-CNT-008 Summaries for cards
Priority: must · Screens: design/screens/home.md, design/screens/articles.md · Journeys: J2, J3
WHEN a card needs an entry's summary THE SYSTEM SHALL use its `description` frontmatter, or else the first paragraph of plain text, cut at a word boundary to at most 200 characters.
- REQ-CNT-008.AC1: Given Chapter 1 without `description`, when its card is built, then the summary starts "Before we can learn how to design large-scale distributed system".
- REQ-CNT-008.AC2: Given a first paragraph of 500 characters, when the summary is built, then it's at most 200 characters, ends at a word boundary and ends with "…".

### REQ-CNT-009 Reading time
Priority: must · Screens: design/screens/home.md, design/screens/chapter.md · Journeys: J1–J3
WHEN an entry is built THE SYSTEM SHALL compute its reading time at 230 words a minute, rounded up to whole minutes, minimum 1.
- REQ-CNT-009.AC1: Given a 700-word chapter, when it's built, then it shows "4 min read".

### REQ-CNT-010 A second book (deferred)
Waits for a second book. The content model keeps book data in one `Book` value so that a second one can be added later without a rewrite (ASM-005).

### REQ-CNT-011 Book settings in book.md
Priority: must · Screens: design/screens/home.md · Journeys: J1, J5, J6
WHEN the build runs THE SYSTEM SHALL read the book's settings from the frontmatter of `book.md` at the vault root (`title`, `subtitle`, `author`, `author_url`, `hero_image`) and its body as the pitch, so that the author changes them in Obsidian, not in code.
- REQ-CNT-011.AC1: Given `book.md` with `title`, `author` and `author_url`, when the build runs, then the header, hero and footer use them.
- REQ-CNT-011.AC2: Given no `book.md`, when the build runs, then it stops with "book.md is missing at the vault root. Create it with at least a title and an author." and an example.
- REQ-CNT-011.AC3: Given `author_url` that isn't an https address, when the build runs, then it stops with an error naming the field.
