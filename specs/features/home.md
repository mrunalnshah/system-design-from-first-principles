---
id: FEAT-home
title: Homepage
paths: [src/features/home/**]
---
# FEAT-home: Homepage

The front door, after Crafting Interpreters' book hero and Substack's lists (patterns only): a hero that presents the book with "Read from the start", then featured chapters, then the latest standalone articles. Every reader starts here.

## Requirements

### REQ-HOME-001 Book hero
Priority: must · Screens: design/screens/home.md · Journeys: J1
WHEN a reader opens the homepage THE SYSTEM SHALL show the book's title, subtitle, author, pitch (the body of `book.md`), a hero diagram (`hero_image` in `book.md`), the chapter count and total reading time, a primary "Read from the start" button and a secondary "Contents" link.
- REQ-HOME-001.AC1: Given `book.md` with title "System Design from First Principles", when the homepage is built, then the hero shows that title as the page's only `h1`.
- REQ-HOME-001.AC2: Given Chapter 1 is the first published chapter, when a reader presses "Read from the start", then Chapter 1 opens.
- REQ-HOME-001.AC3: Given `hero_image: 01-light.svg` and a reader in dark mode, when the homepage loads, then the hero shows `01-dark.svg`.
- REQ-HOME-001.AC4: Given no `hero_image`, when the homepage is built, then the hero shows without an image and the layout doesn't leave a gap.

### REQ-HOME-002 Featured chapters
Priority: must · Screens: design/screens/home.md · Journeys: J2
WHEN the homepage is built THE SYSTEM SHALL show up to 6 published chapters with `featured: true`, in book order, as cards with chapter number, part, title, summary and reading time.
- REQ-HOME-002.AC1: Given Chapters 1 and 3 are featured, when the homepage is built, then two cards appear, Chapter 1 first.
- REQ-HOME-002.AC2: Given no chapter is featured, when the homepage is built, then the section shows the first three published chapters, titled "Start here" instead of "Featured chapters".
- REQ-HOME-002.AC3: Given 8 featured chapters, when the homepage is built, then the first 6 in book order show, followed by an "All chapters" link to the contents page.

### REQ-HOME-003 Latest articles
Priority: must · Screens: design/screens/home.md · Journeys: J3
WHEN the homepage is built THE SYSTEM SHALL list up to 5 published articles, featured ones first, then newest first, each with title, date, summary and reading time, followed by an "All articles" link.
- REQ-HOME-003.AC1: Given articles dated 2026-10-01 and 2026-11-01, when the homepage is built, then the November article comes first.
- REQ-HOME-003.AC2: Given an older article with `featured: true`, when the homepage is built, then it comes first, marked "Featured".
- REQ-HOME-003.AC3: Given no published articles, when the homepage is built, then the section and its link are left out entirely.

### REQ-HOME-004 Homepage stays light
Priority: must · Screens: design/screens/home.md · Journeys: J1
WHEN the homepage loads THE SYSTEM SHALL load no JavaScript at all.
- REQ-HOME-004.AC1: Given the built homepage, when its requests are listed, then none of them is a script.
