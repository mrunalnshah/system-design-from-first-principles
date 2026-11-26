---
id: FEAT-book
title: Book navigation
paths: [src/features/book/**]
---
# FEAT-book: Book navigation

How a reader finds their way through the book: the contents page, chapter addresses, and previous/next between chapters. After Crafting Interpreters' contents page (patterns only).

## Requirements

### REQ-BOOK-001 Contents page
Priority: must · Screens: design/screens/contents.md · Journeys: J2, J4
WHEN a reader opens the contents page THE SYSTEM SHALL list every published part, with a Roman numeral and title, and under each its published chapters, with chapter number, title, reading time and the chapter's top-level sections as small sub-items.
- REQ-BOOK-001.AC1: Given Part 1 "Foundations" with Chapter 1, when the contents page is built, then it shows "I. Foundations", then "1. Computer Architecture" with sub-items "Components", "Limitations", "Moore's Law".
- REQ-BOOK-001.AC2: Given a part whose chapters are all drafts, when the contents page is built, then that part isn't shown.
- REQ-BOOK-001.AC3: Given a sub-item, when a reader selects it, then the chapter opens scrolled to that section.

### REQ-BOOK-002 Stable chapter addresses
Priority: must · Screens: design/screens/chapter.md · Journeys: J1, J4
WHEN a chapter is published THE SYSTEM SHALL serve it at `/book/<chapter-slug>/`, and each section at `/book/<chapter-slug>/#<heading-slug>`, where the slug comes from the file name without its number.
- REQ-BOOK-002.AC1: Given `chapter-1_computer-architecture.md`, when it's published, then its address is `/book/computer-architecture/`.
- REQ-BOOK-002.AC2: Given the heading "Moore's Law", when it's published, then its anchor is `#moores-law`.
- REQ-BOOK-002.AC3: Given a chapter is renumbered from 1 to 2, when the site is rebuilt, then its address doesn't change.

### REQ-BOOK-003 Previous and next
Priority: must · Screens: design/screens/chapter.md · Journeys: J1, J4
WHEN a reader reaches the end of a chapter THE SYSTEM SHALL show links to the previous and next published chapters in book order, with their number and title, crossing part boundaries.
- REQ-BOOK-003.AC1: Given the last chapter of Part 1 and the first of Part 2, when the former is built, then "Next" shows the Part 2 chapter.
- REQ-BOOK-003.AC2: Given the first chapter, when it's built, then there's no "Previous" link, and "Contents" stands in its place.
- REQ-BOOK-003.AC3: Given the last chapter, when it's built, then "Next" is replaced by "Back to contents".

### REQ-BOOK-004 Continuous chapter numbers
Priority: must · Screens: design/screens/contents.md, design/screens/chapter.md · Journeys: J4
WHEN chapters are shown anywhere THE SYSTEM SHALL use the number from the file name, which runs continuously across parts, and show parts with Roman numerals.
- REQ-BOOK-004.AC1: Given `part-2_networks/chapter-5_tcp.md`, when it's shown, then it reads "Chapter 5" in "Part II".

### REQ-BOOK-005 Keyboard previous/next
Priority: should · Screens: design/screens/chapter.md · Journeys: J4
WHEN a reader on a chapter presses the left or right arrow key, with no text field focused and no modifier key held, THE SYSTEM SHALL open the previous or next chapter.
- REQ-BOOK-005.AC1: Given Chapter 1 with a next chapter, when the reader presses →, then the next chapter opens.
- REQ-BOOK-005.AC2: Given the full-screen diagram view is open, when the reader presses →, then nothing navigates.

### REQ-BOOK-006 Continue where I left off (deferred)
Not chosen as a signature feature in interview round 1; kept so the ID isn't reused.

### REQ-BOOK-007 Redirects from old addresses
Priority: must · Screens: none · Journeys: J4
WHEN a chapter or article lists old slugs in `moved_from` THE SYSTEM SHALL publish a small page at each old address that sends the reader to the current address at once (a meta refresh plus a visible link and a canonical link), is excluded from the sitemap and search indexing, and works without JavaScript.
- REQ-BOOK-007.AC1: Given `chapter-1_how-computers-work.md` with `moved_from: [computer-architecture]`, when a reader opens `<base>book/computer-architecture/`, then they arrive at `<base>book/how-computers-work/`.
- REQ-BOOK-007.AC2: Given a `moved_from` slug that's also a live chapter's slug, when the build runs, then it stops with E-REDIRECT-CLASH naming both files.
- REQ-BOOK-007.AC3: Given redirect pages, when the sitemap is built, then none of them is in it, and each has `<meta name="robots" content="noindex">`.
- REQ-BOOK-007.AC4: Given `moved_from` on an article, when it's built, then the redirect lives under `<base>articles/<old-slug>/`.
