import { describe, expect, it } from "vitest";
import { parseArticleFile, parseChapterFile, parsePartFolder, slugify, titleFromSlug } from "./naming.ts";

describe("naming rules", () => {
  // @req REQ-CNT-002.AC1
  it("derives 'Computer Architecture' from chapter-1_computer-architecture.md", () => {
    expect(parseChapterFile("chapter-1_computer-architecture.md")).toEqual({ number: 1, slug: "computer-architecture" });
    expect(titleFromSlug("computer-architecture")).toBe("Computer Architecture");
  });

  // @req REQ-CNT-002.AC3
  it("derives the part title 'Foundations' from part-1_foundations", () => {
    expect(parsePartFolder("part-1_foundations")).toEqual({ number: 1, slug: "foundations" });
    expect(titleFromSlug("foundations")).toBe("Foundations");
  });

  it("keeps minor words lowercase inside a title, as title case does", () => {
    expect(titleFromSlug("how-the-internet-moves-bytes")).toBe("How the Internet Moves Bytes");
    expect(titleFromSlug("the-art-of-scaling")).toBe("The Art of Scaling");
    expect(titleFromSlug("what-to-build-on")).toBe("What to Build On");
  });

  it("reads near-miss names leniently instead of dropping them", () => {
    expect(parseChapterFile("chapter-3_Load Balancing.md")).toEqual({ number: 3, slug: "load-balancing" });
    expect(parsePartFolder("part-2_Networks")).toEqual({ number: 2, slug: "networks" });
    expect(parseArticleFile("Why Caches.md")).toEqual({ slug: "why-caches" });
    expect(slugify("Café — résumé")).toBe("cafe-resume");
  });

  it("needs a positive number and a slug with letters or digits", () => {
    expect(parseChapterFile("chapter-0_intro.md")).toBeUndefined();
    expect(parseChapterFile("chapter-x_intro.md")).toBeUndefined();
    expect(parseChapterFile("chapter-1_!!!.md")).toBeUndefined();
    expect(parseChapterFile("chapter-1_intro.txt")).toBeUndefined();
    expect(parsePartFolder("excalidraw")).toBeUndefined();
    expect(parseArticleFile("image.svg")).toBeUndefined();
  });
});
