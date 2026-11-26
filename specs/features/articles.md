---
id: FEAT-articles
title: Standalone articles
paths: [src/features/articles/**]
---
# FEAT-articles: Standalone articles

Writing that sits outside the book: each article has its own page, and an archive lists them all. Article pages use the calm reading view (FEAT-reader) without chapter numbering or the chapter menu.

## Requirements

### REQ-ART-001 Article addresses
Priority: must · Screens: design/screens/article.md · Journeys: J3
WHEN an article is published THE SYSTEM SHALL serve it at `/articles/<slug>/`, where the slug is the file name without `.md`.
- REQ-ART-001.AC1: Given `articles/why-caches.md`, when it's published, then its address is `/articles/why-caches/`.

### REQ-ART-002 All-articles archive
Priority: must · Screens: design/screens/articles.md · Journeys: J3
WHEN a reader opens "All articles" THE SYSTEM SHALL list every published article, newest first, grouped by year, each with title, date, summary and reading time.
- REQ-ART-002.AC1: Given articles from 2025 and 2026, when the archive is built, then a "2026" group comes before "2025".
- REQ-ART-002.AC2: Given no published articles, when the archive is built, then it says "No articles yet. Start with the book." with a link to Chapter 1.
- REQ-ART-002.AC3: Given 200 articles, when the archive is built, then they're all on one page (no pagination needed for a static list this size), and the page stays within the NFR-002 budget.

### REQ-ART-003 Articles stay out of the book
Priority: must · Screens: design/screens/contents.md · Journeys: J4
WHEN the contents page or previous/next links are built THE SYSTEM SHALL never include articles.
- REQ-ART-003.AC1: Given three articles, when the contents page is built, then none of them is listed.
