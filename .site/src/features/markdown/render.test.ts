import { describe, expect, it } from "vitest";
import { renderObsidian } from "./render.ts";
import { CHAPTER_1, context, golden } from "./test-context.ts";


describe("Obsidian Markdown core", () => {
  // @req REQ-CNT-005.AC2
  it("renders [[chapter-1_computer-architecture|Chapter 1]] as a link to Chapter 1 with the text 'Chapter 1'", async () => {
    const { html, issues } = await renderObsidian("See [[chapter-1_computer-architecture|Chapter 1]].", context());
    expect(html).toBe(`<p>See <a href="${CHAPTER_1.href}">Chapter 1</a>.</p>`);
    expect(issues).toEqual([]);
  });

  // @req REQ-CNT-005.AC3
  it("leaves %%private note%% out of the HTML, inline or over several lines, but not inside code", async () => {
    const { html } = await renderObsidian("Before %%private note%% after.\n\n%%\nprivate\nlines\n%%\n\n`a %%b%% c`\n\n```\nx %%y%%\n```", context());
    expect(html).not.toContain("private");
    expect(html).toContain("<p>Before after.</p>");
    expect(html).toContain("<code>a %%b%% c</code>");
    expect(html).toContain("x %%y%%");
  });

  // @req REQ-CNT-005.AC4
  it("highlights a fenced python block at build time, with no JavaScript", async () => {
    const { html } = await renderObsidian("```python\ndef read(path):\n    return open(path)\n```", context());
    expect(html).toMatch(/^<pre class="astro-code[^"]*" [^>]*data-language="python"/);
    expect(html).toMatch(/<span style="--shiki-light:#[0-9A-Fa-f]{6};--shiki-dark:#[0-9A-Fa-f]{6}">def<\/span>/);
    expect(html).not.toContain("<script");
  });

  // @req REQ-CNT-005.AC5
  it("nests Chapter 1's tab-indented lists as Obsidian's reading view does", async () => {
    const { html } = await renderObsidian("- Measured in 100's of GB or TB\n\t- 1 Byte = 8 Bits\n- next\n\t- deeper\n\t\t- deepest", context());
    expect(html).toBe(
      "<ul>\n<li>Measured in 100's of GB or TB\n<ul>\n<li>1 Byte = 8 Bits</li>\n</ul>\n</li>\n<li>next\n<ul>\n<li>deeper\n<ul>\n<li>deepest</li>\n</ul>\n</li>\n</ul>\n</li>\n</ul>",
    );
  });

  it("matches the golden HTML for Chapter 1 and for every supported Obsidian syntax", async () => {
    const chapter = await golden("chapter-1", context({ filePath: "part-1_foundations/chapter-1_computer-architecture.md", headingNumbers: { prefix: "1" } }));
    expect(chapter.html).toBe(chapter.expected);
    expect(chapter.codes).toEqual([]);
    const syntax = await golden("obsidian", context());
    expect(syntax.html).toBe(syntax.expected);
    expect(syntax.codes).toEqual(["W-SYNTAX-UNKNOWN"]); // the mermaid block, shown as its text
  });

  it("turns an unresolved [[link]] into plain text with W-LINK-UNRESOLVED at its line and column", async () => {
    const { html, issues } = await renderObsidian("---\ntitle: X\n---\nFirst.\n\nSee [[draft-note|the draft]] now.", context({ filePath: "articles/a.md" }));
    expect(html).toContain("<p>See the draft now.</p>");
    expect(issues).toEqual([
      expect.objectContaining({ severity: "warning", code: "W-LINK-UNRESOLVED", file: "articles/a.md", line: 6, column: 5, fix: "Check the name, or publish that note." }),
    ]);
  });

  it("shows a mermaid block as its text, with W-SYNTAX-UNKNOWN", async () => {
    const { html, issues } = await renderObsidian("Text.\n\n```mermaid\ngraph TD; A-->B\n```", context());
    expect(html).toContain('<pre><code class="language-mermaid">graph TD; A-->B');
    expect(issues.map((i) => [i.code, i.line, i.fix])).toEqual([["W-SYNTAX-UNKNOWN", 3, "This shows as plain text on the website."]]);
  });

  it("renders callouts as labelled notes, folding ones as <details>", async () => {
    const { html } = await renderObsidian("> [!note]\n> Plain.\n\n> [!Warning] Mind **this**\n> Body.\n\n> [!faq]- Folded\n> Hidden.", context());
    expect(html).toContain('<div class="callout" data-callout="note" role="note"><p class="callout-title">Note</p><p>Plain.</p></div>');
    expect(html).toContain('<div class="callout" data-callout="warning" role="note"><p class="callout-title">Mind <strong>this</strong></p><p>Body.</p></div>');
    expect(html).toContain('<details class="callout" data-callout="faq"><summary class="callout-title">Folded</summary><p>Hidden.</p></details>');
  });

  it("marks ==highlights== (across inline nodes), keeps a === b, and hides block ids", async () => {
    const { html } = await renderObsidian("A ==lit **bold** text== and a === b. Ref ^block-1", context());
    expect(html).toBe("<p>A <mark>lit <strong>bold</strong> text</mark> and a === b. Ref</p>");
  });

  it("never treats %% inside code as a comment: in a callout's fence, under a tab-indented item, after an escaped backtick", async () => {
    const md = "> [!example]\n> ```python\n> print('100%%')\n> ```\n\n- item\n\t```\n\t'%d%%'\n\t```\n\nAn \\` escaped tick %%secret%% here.\n\n# Next";
    const { html, issues, sections } = await renderObsidian(md, context());
    const text = html.replace(/<[^>]+>/g, "");
    expect(text).toContain("print('100%%')");
    expect(text).toContain("'%d%%'");
    expect(html).toContain("escaped tick here.");
    expect(html).not.toContain("secret");
    expect(sections.map((s) => s.text)).toEqual(["Next"]);
    expect(issues).toEqual([]);
  });

  it("hides everything after a %% that's never closed, as Obsidian does, and warns W-COMMENT-UNCLOSED", async () => {
    const { html, issues } = await renderObsidian("Shown.\n\nAlso shown %% private\n\n# Hidden\n\nHidden too.", context());
    expect(html).toBe("<p>Shown.</p>\n<p>Also shown</p>");
    expect(issues.map((i) => [i.code, i.line, i.column])).toEqual([["W-COMMENT-UNCLOSED", 3, 12]]);
  });

  it("drops what a comment hides before anything else reads it: no link warning or math error from inside it", async () => {
    const { html, issues } = await renderObsidian("Text %% [[nowhere]] $\\micro$ ![[missing.svg]] %% end.", context());
    expect(html).toBe("<p>Text end.</p>");
    expect(issues).toEqual([]);
  });

  it("reports columns in the original source, after entities, quote markers and comments", async () => {
    const at = async (md: string) => (await renderObsidian(md, context())).issues.map((i) => [i.line, i.column]);
    expect(await at("&amp;&amp; [[nope]]")).toEqual([[1, 12]]);
    expect(await at("> a\n> b [[nope]]")).toEqual([[2, 5]]);
    expect(await at("a %%xxxxxxxx%% [[nope]]")).toEqual([[1, 16]]);
    expect(await at("[[nope]] and [[nope]]")).toEqual([[1, 1], [1, 14]]);
  });

  it("warns when a link has formatting inside its brackets, and links [[note#a#b]] to the last heading", async () => {
    const r = await renderObsidian("See [[chapter-1_computer-architecture|*Ch*]] and [[chapter-1_computer-architecture#Parts#Disk]].", context());
    expect(r.issues.map((i) => [i.code, i.column])).toEqual([["W-SYNTAX-UNKNOWN", 5]]);
    expect(r.html).toContain(`<a href="${CHAPTER_1.href}#disk">Computer Architecture > Disk</a>`);
  });

  it("keeps the spaces between a callout title's parts, and leaves an escaped \\[!note] as a quote", async () => {
    const { html } = await renderObsidian("> [!note] **A** *B*\n> Body.\n\n> \\[!note] Just a quote.", context());
    expect(html).toContain('<p class="callout-title"><strong>A</strong> <em>B</em></p>');
    expect(html).toContain("<blockquote>\n<p>[!note] Just a quote.</p>\n</blockquote>");
  });

  it("returns the plain text, section list and counts", async () => {
    const r = await renderObsidian("# One\nText with $x$.[^1]\n\n[^1]: A note.", context({ headingNumbers: { prefix: "2" } }));
    expect(r.plainText).toBe("One\nText with x.\nA note.");
    expect(r.sections).toEqual([{ depth: 2, text: "One", anchor: "one", number: "2.1" }]);
    expect(r.footnoteCount).toBe(1);
    expect(r.figureCount).toBe(0);
    expect((await renderObsidian("Title\\\nbody", context())).plainText).toBe("Title\nbody");
  });
});
