# Writing guide: System Design from First Principles

Everything you need to write the book in Obsidian and publish it with one double-click. You only ever write
parts, chapters and articles, and draw diagrams; the system does the rest.

**Status key:** ✅ works now · 🔜 coming, with the round it arrives in (`plan/rounds.md`). Everything here already
works *in Obsidian*; the 🔜 marks say when the **website** starts showing it. The live site is a placeholder until
Chapter 1 goes live in R-09.

## The short version
1. Write a chapter in `part-<n>_<slug>/chapter-<n>_<slug>.md` (start from `templates/chapter.md`).
2. Draw diagrams in Excalidraw, save them (Ctrl+S), and embed them: `![[01_computer-architecture.excalidraw|Caption]]`.
3. When it's ready, set `draft: false`.
4. Double-click **`sync.cmd`** at the vault root. ✅ It collects your diagram images, checks everything, builds the
   site, asks for a one-line message, and publishes. The site updates a few minutes later.

## Where things go
```
book.md                                  ← the book's title, author and pitch (required; see below)
about.md                                 ← your About page (optional)
part-1_foundations/                      ← a part: part-<n>_<slug>
├── chapter-1_computer-architecture.md   ← a chapter: chapter-<n>_<slug>.md
├── excalidraw/                          ← your drawings (stay on your computer; never uploaded)
│   └── 01_computer-architecture.excalidraw.md
└── diagram/                             ← images sync puts here (don't edit them by hand)
    ├── 01_computer-architecture-light.svg
    └── 01_computer-architecture-dark.svg
articles/                                ← standalone articles, outside the book
└── why-a-disk-read-feels-slow.md
templates/                               ← starting points for new files (never published)
```
Naming rules (the website builds addresses from them):
- **Parts:** `part-<n>_<slug>`, e.g. `part-2_networks`. The part's title comes from the slug ("Networks") and is
  shown as "Part II · Networks". 🔜 R-06
- **Chapters:** `chapter-<n>_<slug>.md`. Chapter numbers run on across the whole book (part 2 may start at chapter
  5) and must be unique. The address is `/book/<slug>/`, so the number can change without breaking links. 🔜 R-06
- **Slugs:** lowercase words joined by `-` (`how-the-internet-moves-bytes`). No spaces, capitals or symbols.
- **Drawings:** name them `NN_slug`, e.g. `02_moores-law`, so they sort in order. Keep one drawing per diagram.
- **Articles:** `articles/<slug>.md`; the address is `/articles/<slug>/`. 🔜 R-13

## book.md and about.md
Copy `templates/book.md` to `book.md` at the vault root and fill it in. **The site won't build without it** (from
R-06 the build checks for it: E-BOOK-MISSING).
- `title:` the book's title (shown in the header and on the homepage).
- `subtitle:` one line under the title on the homepage.
- `author:` your name as readers should see it.
- `author_url:` your portfolio address; must start with `https://`.
- `hero_image:` the diagram image the homepage shows, e.g. `01_computer-architecture-light.svg`; its `-dark`
  partner is used in dark mode. 🔜 R-11
- The text below the frontmatter is the homepage pitch. 🔜 R-11

`about.md` (optional) becomes the About page; copy `templates/about.md`. Without it, your name in the header links to
your portfolio instead (W-ABOUT-MISSING). 🔜 R-13

## Writing a chapter
Start from `templates/chapter.md`. The frontmatter (the block between the `---` lines) controls how the chapter
appears:

| Field | What it does | Example | Site |
|---|---|---|---|
| `title:` | Overrides the title from the file name ("computer-architecture" → "Computer Architecture") | `title: "How Computers Work"` | 🔜 R-06 |
| `description:` | One sentence for cards and search results; without it, the first paragraph is used | `description: "The four parts every system is built from."` | 🔜 R-06 |
| `draft:` | `true` keeps it off the website entirely (contents, links, homepage). **It's still visible on GitHub**, because the repository is public | `draft: true` | 🔜 R-06 |
| `featured:` | `true` puts it on the homepage under "Featured chapters" (up to 6, in book order) | `featured: true` | 🔜 R-12 |
| `epigraph:` | An opening quote under the title | `epigraph: "Everything is a trade-off."` | 🔜 R-09 |
| `epigraph_source:` | Who said it (needs `epigraph:`) | `epigraph_source: "Anonymous"` | 🔜 R-09 |
| `moved_from:` | Old slugs that should forward to this chapter after a rename | `moved_from: [computer-architecture]` | 🔜 R-13 |

Writing tips that use the site fully:
- **Don't add a title heading.** The title comes from the file name or `title:`. Start with a paragraph.
- **Headings become numbered sections.** `#` becomes 1.1, 1.2…; `##` becomes 1.1.1… (the chapter's number comes first).
  The section list in the chapter menu and on the contents page comes from your `#` headings, so make them short and
  clear. 🔜 R-07 (numbers), R-10 (menu), R-11 (contents)
- **Footnotes become margin notes.** Write `text.[^1]`, and `[^1]: The note.` at the end. On wide screens it sits
  beside its line; on phones it opens when tapped. 🔜 R-08 / R-10
- **Callouts** for things not to miss: `> [!note]`, `> [!tip]`, `> [!warning]` on the first line. 🔜 R-07
- **Highlights** `==like this==`, and **comments** `%%like this%%`, which are never published. 🔜 R-07
- **Links between chapters:** `[[chapter-2_memory|Chapter 2]]`. A link to a draft or a missing note shows as plain
  text (W-LINK-UNRESOLVED). 🔜 R-07
- **Code blocks** with a language get colours: start with ```` ```python ````. 🔜 R-07
- **Tables, task lists and bold/italic** work as in Obsidian. 🔜 R-07
- **Reading time** is worked out for you (230 words a minute). 🔜 R-06

## Math
Write `$…$` inline and `$$…$$` on its own lines. The site uses KaTeX, which covers almost everything Obsidian's MathJax
does, but not all of it. Use `\mu` for micro (not `\micro`); any command KaTeX doesn't know stops the build at that
line (E-MATH), so you'll never publish broken math. 🔜 R-07

## Diagrams
One-time setup (done ✅): in Obsidian → Settings → Excalidraw, **Auto-export SVG** and **Export both dark- and
light-themed image** are on; keep **Auto-export PNG** off.

For each diagram:
1. Create the drawing in the part's `excalidraw/` folder, named `NN_slug` (e.g. `03_cache-hierarchy`).
2. Draw it in your usual light-theme colours. Excalidraw makes the dark version itself, mapping your colours.
3. Save (Ctrl+S). Excalidraw writes `NN_slug.excalidraw.light.svg` and `.dark.svg` next to the drawing.
4. Embed the drawing in the chapter, **with a caption**: `![[03_cache-hierarchy.excalidraw|How the caches nest]]`.
   The caption is shown under the diagram and read out to screen-reader users; without one the build warns
   (W-DIAGRAM-NO-CAPTION).
5. Run sync. It moves the two images into `diagram/` as `03_cache-hierarchy-light.svg` and `-dark.svg`. ✅

On the website, each drawing shows in the reader's light or dark theme 🔜 R-08, fills the reading column (wide
drawings stretch up to 900 px) 🔜 R-08, and opens full screen with zoom when tapped 🔜 R-10.

Good to know:
- Edit a drawing → save it → sync. Sync refuses a drawing changed after its images were exported, and tells you which
  to re-save.
- Your drawings (`*.excalidraw.md`) are never uploaded: they exist only on this computer, so **keep your own backup**
  (for example the vault folder in a cloud drive).
- Older images embedded directly, like `![[01-light.svg]]`, still work: a `-light`/`-dark` pair is shown as one
  themed figure.
- Very large drawings (over 250 KB) slow phones down; the build warns (W-DIAGRAM-LARGE).

## Writing an article
Start from `templates/article.md` and save it in `articles/`. Articles use the same Markdown as chapters, but their
headings aren't numbered and they're not in the book's contents. 🔜 R-13
- `date:` the publish date as `yyyy-mm-dd`; articles are listed newest first. Without it the article is listed last
  and the build warns (W-ARTICLE-UNDATED).
- `title:`, `description:`, `draft:`, `featured:` (pins it to the top of "Latest articles") and `moved_from:` work as
  for chapters.

## Renaming and reordering
- **Renumbering** (`chapter-3_` → `chapter-4_`) is safe: addresses don't include numbers.
- **Changing a slug** changes the chapter's address. Add the old slug to the renamed file so old links forward:
  `moved_from: [old-slug]`. 🔜 R-13
- Prefer changing the displayed `title:` over renaming the file.

## Publishing with sync
Double-click `sync.cmd` (or run `npm --prefix .site run sync` in a terminal). ✅ It:
1. pulls anything new from GitHub (for example a merged dependency update);
2. moves Excalidraw's exports into each `diagram/` folder;
3. checks every drawing has current light and dark images;
4. builds the website exactly as GitHub will;
5. lists what changed and asks for a one-line message (Enter uses "Update <date>"; type `cancel` to stop);
6. commits and pushes. The secret scanner checks the commit first.

Then it prints where to watch the build and the site's address. The website updates a few minutes later. If anything
is wrong, sync stops **before** committing and says what to do; fix it and run sync again.

## When sync or the build stops
Sync's own stops:
- **"These drawings can't be published yet"**: a drawing has no images, only one of them, or was changed after
  exporting. Open it in Obsidian, save it (Ctrl+S), run sync again.
- **"GitHub has changes that can't combine automatically"**: something changed on GitHub and on this computer at
  once. Ask the AI agent for help.
- **"Couldn't reach GitHub"**: check your internet connection.
- **"The commit was refused"**: the secret scanner found something that looks like a password or key. Remove it.
- **"Committed … but couldn't push"**: you're offline; run sync again later.

The build's messages (🔜 from R-06) always name the file and line. **Errors (E-) stop the publish; warnings (W-) don't.**

| Code | What it means | What to do |
|---|---|---|
| E-BOOK-MISSING | There's no `book.md` at the vault root | Copy `templates/book.md` to `book.md` and fill it in |
| E-FRONTMATTER-YAML | The frontmatter isn't valid | Check that line for a missing colon or quote |
| E-FRONTMATTER-FIELD | A field has the wrong format (e.g. `author_url` not https, `date` not yyyy-mm-dd) | Fix that field as the message says |
| E-CHAPTER-DUPLICATE | Two chapters have the same number | Renumber one of them |
| E-SLUG-CLASH | Two files would get the same address, or a reserved name was used | Rename one file |
| E-EMBED-MISSING | `![[file]]` names a file that doesn't exist | Check the spelling, or add the file |
| E-DRAWING-NOT-EXPORTED | A drawing is embedded but has no images in `diagram/` | Open the drawing, save it, run sync |
| E-REDIRECT-CLASH | A `moved_from` slug is still in use by another file | Remove it from one `moved_from` list |
| E-MATH | KaTeX can't read a formula (e.g. `\micro`) | Use a supported command (`\mu`) |
| W-LINK-UNRESOLVED | `[[note]]` doesn't match a published entry | Check the name, or publish that note |
| W-ARTICLE-UNDATED | An article has no `date:` | Add `date: yyyy-mm-dd` |
| W-DIAGRAM-NO-CAPTION | A diagram has no caption | Add one: `![[name.excalidraw|Caption]]` |
| W-DIAGRAM-LARGE | A diagram image is over 250 KB | Simplify the drawing if you can |
| W-ABOUT-MISSING | There's no `about.md` | Optional: copy `templates/about.md` |
| W-SYNTAX-UNKNOWN | Obsidian syntax the site doesn't support yet | It shows as plain text on the site |
| W-DIAGRAM-UNPAIRED | A light image has no dark partner, or the other way round | Save the drawing again in Obsidian |
| W-EMPTY-BOOK | No chapter is published yet | Set `draft: false` on a chapter |

## Using the templates in Obsidian
Turn on Settings → Core plugins → **Templates**, and set its "Template folder location" to `templates`. Then, in a new
note, run "Templates: Insert template" from the command palette (Ctrl+P) and pick one. The article template fills in
today's date for you.

## Things to remember
- **The repository is public.** Everything you sync can be read on GitHub, drafts included. Never put passwords,
  keys or private notes in the vault; the secret scanner blocks keys it recognises, but not everything.
- Don't edit the hidden `.site/` folder, `specs/` or `plan/`: that's the website's code and plan. Ask the AI agent.
- Keep a backup of your drawings: they're the only files not on GitHub.
