# ADR-0009: Use the chapter slug without its number as the address
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
REQ-BOOK-002: stable addresses. Chapters may be renumbered as the book grows (a new chapter 3 pushes the rest down), and parts may be reorganised.

## Options
1. **`/book/<slug>/` from `chapter-<n>_<slug>.md`:** The number and part are display data, not part of the address. Pros: Renumbering and moving chapters between parts keep every link (REQ-BOOK-002.AC3). Cons: Renaming the slug part of the file name changes the address; `moved_from` redirect pages keep old links working (REQ-BOOK-007, added at G4).
2. **`/book/part-1/chapter-1/` from the numbers:** Addresses mirror the book's structure. Pros: Predictable, sortable addresses. Cons: Every insertion renumbers and breaks links for all later chapters.

## Decision
Option 1.

## Consequences
Slugs must be unique across chapters (E-SLUG-CLASH).
