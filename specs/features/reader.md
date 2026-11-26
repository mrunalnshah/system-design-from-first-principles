---
id: FEAT-reader
title: Calm reading view
paths: [src/features/reader/**]
---
# FEAT-reader: Calm reading view

Signature feature 2: a distraction-free reading page for chapters and articles, with a serif reading line of about 70 characters and the chapter touches after Crafting Interpreters (patterns only): big chapter number, section numbers, epigraph, margin notes and a sticky chapter menu.

## Requirements

### REQ-READ-001 Reading typography
Priority: must · Screens: design/screens/chapter.md, design/screens/article.md · Journeys: J1–J3
WHEN a chapter or article is shown THE SYSTEM SHALL set the body in the serif reading font at 18–21 px (fluid with screen width), with a 1.6–1.7 line height, a 60–75 character line, and headings, navigation and UI in the sans-serif font.
- REQ-READ-001.AC1: Given a 1280 px wide screen, when a chapter is shown, then the text column is between 60 and 75 characters wide.
- REQ-READ-001.AC2: Given a 320 px wide screen, when a chapter is shown, then the body text is at least 18 px and there's no horizontal scroll.

### REQ-READ-002 Nothing competes with the text
Priority: must · Screens: design/screens/chapter.md, design/screens/article.md · Journeys: J1–J3
WHEN a reading page is shown THE SYSTEM SHALL show no pop-ups, banners, cookie notices, auto-playing media or animations beyond 200 ms, and shall honour `prefers-reduced-motion`.
- REQ-READ-002.AC1: Given a reader with reduced motion turned on, when they open the chapter menu, then it appears without animation.
- REQ-READ-002.AC2: Given any reading page, when it loads, then nothing overlays the text without the reader asking.

### REQ-READ-003 Big chapter number
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN a chapter is shown THE SYSTEM SHALL show its number large and faint beside the title, and its part name and reading time under the title.
- REQ-READ-003.AC1: Given Chapter 1, when it's shown, then a large "1" sits beside "Computer Architecture", hidden from screen readers, which hear "Chapter 1: Computer Architecture" from the heading instead.

### REQ-READ-004 Section numbers
Priority: must · Screens: design/screens/chapter.md · Journeys: J2
WHEN a chapter is shown THE SYSTEM SHALL number its headings automatically: the vault's `#` headings become `<chapter>.<n>` and `##` headings become `<chapter>.<n>.<m>`, shown right-aligned beside the heading; articles aren't numbered.
- REQ-READ-004.AC1: Given Chapter 1's headings "Components", "Disk", "RAM", "Limitations", when it's shown, then they read 1.1 Components, 1.1.1 Disk, 1.1.2 RAM, 1.2 Limitations.
- REQ-READ-004.AC2: Given a chapter, when it's rendered, then the chapter title is the only `h1`, and the vault's `#` headings are `h2`.
- REQ-READ-004.AC3: Given a heading, when a reader hovers over it or focuses it, then a link to that section appears for copying.

### REQ-READ-005 Epigraph
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN a chapter has `epigraph` in its frontmatter THE SYSTEM SHALL show it as an opening quote under the title, with `epigraph_source` as its attribution when present.
- REQ-READ-005.AC1: Given `epigraph: "Everything is a trade-off."` and `epigraph_source: "Anonymous"`, when the chapter is shown, then the quote and "— Anonymous" appear above the first paragraph.
- REQ-READ-005.AC2: Given no `epigraph`, when the chapter is shown, then no empty quote space appears.

### REQ-READ-006 Margin notes
Priority: must · Screens: design/screens/chapter.md, design/screens/article.md · Journeys: J1–J3
WHEN an entry has footnotes `[^n]` THE SYSTEM SHALL show each note in the right margin level with its reference on screens 1100 px or wider, and on narrower screens as a numbered marker that opens the note inline below the line when tapped.
- REQ-READ-006.AC1: Given a footnote on a 1280 px screen, when the page is shown, then the note's top is level with its reference line and doesn't overlap the previous note.
- REQ-READ-006.AC2: Given a 375 px screen, when the reader taps marker 1, then the note opens below that line; tapping again closes it.
- REQ-READ-006.AC3: Given JavaScript is off, when the page is shown on a phone, then the notes are listed at the end of the entry, and each marker links to its note.

### REQ-READ-007 Sticky chapter menu
Priority: must · Screens: design/screens/chapter.md · Journeys: J2, J4
WHEN a chapter is shown THE SYSTEM SHALL show a small panel that stays in view, with the book title (linking to the contents), this chapter's sections, with the current one highlighted while scrolling, and previous/next; on screens under 1100 px it collapses to a menu button in the top bar.
- REQ-READ-007.AC1: Given a 1280 px screen, when the reader scrolls into section 1.2, then "Limitations" is highlighted in the panel.
- REQ-READ-007.AC2: Given a 375 px screen, when the reader taps the menu button, then the panel opens, focus moves into it, and Escape closes it and returns focus to the button.
- REQ-READ-007.AC3: Given JavaScript is off, when a chapter is shown, then the section list appears as a plain list under the title, and still works.

### REQ-READ-008 Math
Priority: must · Screens: design/screens/chapter.md · Journeys: J1
WHEN an entry contains math THE SYSTEM SHALL typeset it at build time into HTML and CSS, needing no JavaScript in the reader's browser, and readable by screen readers.
- REQ-READ-008.AC1: Given `$\frac{1}{10^3}$`, when the page is shown with JavaScript off, then the fraction is typeset.
- REQ-READ-008.AC2: Given a command the math renderer doesn't support, such as Chapter 1's current `$\micro s$`, when the build runs, then it stops with a build error naming the file and line and suggesting `\mu` (CNF-001, decided at G2).
- REQ-READ-008.AC4: Given `$\mu s$`, when it's rendered, then it shows "μs".
- REQ-READ-008.AC3: Given display math wider than the screen, when it's shown at 320 px, then it scrolls sideways inside its own box, not the page.

### REQ-READ-009 Article header
Priority: must · Screens: design/screens/article.md · Journeys: J3
WHEN an article is shown THE SYSTEM SHALL show its title, date, reading time and, at the end, a link to "All articles" and a "Read the book" link to the contents page.
- REQ-READ-009.AC1: Given an article dated 2026-11-01, when it's shown, then the date reads "1 November 2026".
