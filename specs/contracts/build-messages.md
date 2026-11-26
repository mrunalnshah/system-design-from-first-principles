# Contract: build messages

Every problem the build finds is a `BuildIssue` with a code, a file, a line where known, a message and a fix in plain words (REQ-CNT-007, NFR-013). Errors stop the publish; warnings don't. The build prints all issues together at the end, errors first, in this form:

```
✖ ERROR E-EMBED-MISSING  part-1_foundations/chapter-1_computer-architecture.md:3
  The diagram "01-ligth.svg" can't be found in the vault.
  Fix: check the spelling, or export the diagram from Excalidraw into a diagram/ folder.
```

| Code | Severity | When | Fix text (start) |
|---|---|---|---|
| E-BOOK-MISSING | error | no `book.md` at the vault root | "Create book.md with at least a title, an author and author_url. Example: …" |
| E-FRONTMATTER-YAML | error | frontmatter isn't valid YAML | "Check for a missing colon or quote on this line." |
| E-FRONTMATTER-FIELD | error | a field has the wrong type or format (e.g. `author_url` not https, `date` not yyyy-mm-dd) | "Change <field> to …" |
| E-CHAPTER-DUPLICATE | error | two chapters share a number | "Renumber one of them: <file A>, <file B>." |
| E-SLUG-CLASH | error | two entries resolve to the same address, or a reserved slug is used | "Rename one file." |
| E-EMBED-MISSING | error | `![[file]]` names no file in the vault | "Check the spelling, or add the file." |
| E-DRAWING-NOT-EXPORTED | error | an entry embeds a drawing (`![[name.excalidraw]]`) but no `name-light.svg` / `name-dark.svg` exists in a `diagram/` folder | "Open the drawing in Obsidian, save it (Ctrl+S), then run sync so its images are collected." (CR-0005) |
| E-REDIRECT-CLASH | error | a `moved_from` slug is also a live slug or another entry's old slug | "Remove it from moved_from in one of: <file A>, <file B>." |
| E-MATH | error | KaTeX can't parse a formula (e.g. `\micro`) | "Use a supported command; for micro, write \mu." |
| W-LINK-UNRESOLVED | warning | `[[note]]` matches no published entry | "Check the name, or publish that note." (rendered as plain text) |
| W-ARTICLE-UNDATED | warning | an article has no `date` | "Add date: yyyy-mm-dd to sort it." |
| W-DIAGRAM-NO-CAPTION | warning | a diagram has no alias, so alt text came from the SVG's own text (or is generic) | "Add a caption: ![[file.svg\|Caption]]." |
| W-DIAGRAM-LARGE | warning | an SVG is over 250 KB | "Large diagrams load slowly on phones; consider simplifying." |
| W-ABOUT-MISSING | warning | no `about.md` | "Create about.md to get an About page." |
| W-COMMENT-UNCLOSED | warning | a `%%` comment is never closed, so the rest of the entry is hidden (as in Obsidian) | "Close it with %% where the private note ends." (R-07 review) |
| W-SYNTAX-UNKNOWN | warning | Obsidian syntax the site doesn't support (shown as text) | "This shows as plain text on the website." |
| W-DIAGRAM-UNPAIRED | warning | a `-light`/`.light` SVG has no dark partner (or the reverse) | "Turn on 'Export both light and dark' in the Excalidraw plugin and save the drawing again." |
| W-EMPTY-BOOK | warning | no published chapters | "Publish a chapter by removing draft: true." |
