import { describe, expect, it } from "vitest";
import { renderObsidian } from "../render.ts";
import { context } from "../test-context.ts";

describe("footnotes as margin notes", () => {
  // @req REQ-READ-006.AC3
  it("lists the notes at the end of the entry, and each marker links to its note (works without JavaScript)", async () => {
    const { html } = await renderObsidian("Disks are slow.[^slow] RAM is fast.[^fast]\n\n[^slow]: About 10 ms a seek.\n[^fast]: About 100 ns.", context());
    expect(html).toContain('<a class="ref" href="#fn-1" data-note="1" id="ref-1" aria-label="Note 1"><sup>1</sup></a>');
    expect(html).toContain('<a class="ref" href="#fn-2" data-note="2" id="ref-2" aria-label="Note 2"><sup>2</sup></a>');
    const end = html.slice(html.lastIndexOf('<section class="endnotes"'));
    expect(html.trimEnd().endsWith("</section>")).toBe(true); // the end list closes the entry
    expect(end).toContain('<li id="fn-1">About 10 ms a seek. <a class="back" href="#ref-1" aria-label="Back to the text of note 1">↩︎</a></li>');
    expect(end).toContain('<li id="fn-2">About 100 ns.');
  });

  it("also puts each note inline, right after its marker, for the margin", async () => {
    const { html } = await renderObsidian("Text.[^1]\n\n[^1]: A **bold** note.\n\n    With a second paragraph.", context());
    expect(html).toContain(
      '<sup>1</sup></a><span class="sidenote" role="note" id="sn-1"><span class="sidenote-number">1</span> A <strong>bold</strong> note.<br>\nWith a second paragraph.</span>',
    );
    expect(html).toContain('<li id="fn-1">\n<p>A <strong>bold</strong> note.</p>\n<p>With a second paragraph. <a class="back"');
  });

  it("numbers notes by first reference, gives a repeated reference a marker only, and drops notes nothing refers to", async () => {
    const { html } = await renderObsidian("B[^b] then A[^a] then B again[^b].\n\n[^a]: Note A.\n[^b]: Note B.\n[^unused]: Never shown.", context());
    expect([...html.matchAll(/data-note="(\d)"/g)].map((m) => m[1])).toEqual(["1", "2", "1"]);
    expect(html.match(/class="sidenote"/g)).toHaveLength(2);
    expect(html).not.toContain("Never shown");
    expect(html).not.toContain("data-footnote"); // GitHub's own footnote markup is fully replaced
  });

  it("makes a note's reference to another note a plain marker in both copies, never GitHub's markup or a nested note", async () => {
    const { html } = await renderObsidian("Text.[^a]\n\n[^a]: Outer, see[^b].\n[^b]: Inner.", context());
    expect(html).not.toMatch(/data-footnote|user-content|footnote-label/);
    const sidenote = /<span class="sidenote"[^]*?<\/span><\/p>/.exec(html)![0];
    expect(sidenote.match(/class="sidenote"/g)).toHaveLength(1);
    expect(sidenote).toContain('<a class="ref" href="#fn-2" data-note="2" aria-label="Note 2"><sup>2</sup></a>');
    expect(html).toContain('<li id="fn-2">Inner.</li>'); // reached only from note 1: no back link to a marker that isn't there
  });

  it("gives a note in a heading only its marker, so the heading's name stays the heading", async () => {
    const { html } = await renderObsidian("# Disks[^1]\n\nText.\n\n[^1]: Spinning ones.", context());
    expect(html).toContain('<h2 id="disks">Disks<a class="ref" href="#fn-1" data-note="1" id="ref-1" aria-label="Note 1"><sup>1</sup></a></h2>');
    expect(html).not.toContain('class="sidenote"');
    expect(html).toContain('<li id="fn-1">Spinning ones.');
  });

  it("never lets a heading take a note's id", async () => {
    const { html } = await renderObsidian("# Fn 1\n\n# Ref 1\n\nText.[^1]\n\n[^1]: N.", context());
    expect(html.match(/id="fn-1"/g)).toHaveLength(1);
    expect(html.match(/id="ref-1"/g)).toHaveLength(1);
    expect(html).toContain('<h2 id="fn-1-1">');
  });

  it("typesets math and resolves links inside notes, in both copies", async () => {
    const { html } = await renderObsidian("See.[^1]\n\n[^1]: $\\mu s$ and [[chapter-1_computer-architecture|ch 1]].", context());
    expect(html.match(/<mi>μ<\/mi>/g)).toHaveLength(2);
    expect(html.match(/>ch 1<\/a>/g)).toHaveLength(2);
  });

  it("counts footnotes and adds nothing when there are none", async () => {
    const r = await renderObsidian("Plain text.", context());
    expect(r.html).toBe("<p>Plain text.</p>");
    expect((await renderObsidian("A[^1]\n\n[^1]: n", context())).footnoteCount).toBe(1);
  });
});
