import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVault } from "../src/features/content/index.ts";
import { createFigureRenderer, diagramAssetPaths, getDiagramIndex } from "../src/features/diagrams/index.ts";

/** The vault loader with MOD-diagrams' real figure renderer, as content.config.ts joins them (CR-0007). */
const fixture = join(import.meta.dirname, "fixtures/vault");
/** The author's own vault, read and never written. */
const realVault = join(import.meta.dirname, "../..");

describe("the loader and the diagram route together", () => {
  it("records every diagram a published entry draws, so the diagram route publishes exactly those", async () => {
    const vault = await buildVault({
      vaultRoot: fixture,
      figures: async () => createFigureRenderer(await getDiagramIndex(fixture)),
    });
    expect(vault.issues).toEqual([]);
    const published = diagramAssetPaths(await getDiagramIndex(fixture))
      .map((p) => p.props.sourcePath)
      .sort();
    // Chapter 1's two pairs, and the fixture's 01-light.svg / 01-dark.svg pair, which no chapter shows but book.md
    // names as hero_image: the loader draws the hero too, so the homepage's images are published (CR-0007).
    expect(published).toEqual(
      [
        "01-dark",
        "01-light",
        "01_computer-architecture-dark",
        "01_computer-architecture-light",
        "02_moores-law-dark",
        "02_moores-law-light",
      ].map((n) => `part-1_foundations/diagram/${n}.svg`),
    );
  });

  it("publishes no diagram that nothing shows", async () => {
    // Without hero_image, the 01-light / 01-dark pair isn't shown anywhere, so it stays off the site.
    const copy = mkdtempSync(join(tmpdir(), "sdfp-nohero-"));
    cpSync(fixture, copy, { recursive: true });
    writeFileSync(
      join(copy, "book.md"),
      readFileSync(join(copy, "book.md"), "utf8").replace(/^hero_image:.*\r?\n/m, ""),
    );
    try {
      const vault = await buildVault({
        vaultRoot: copy,
        figures: async () => createFigureRenderer(await getDiagramIndex(copy)),
      });
      expect(vault.book?.heroImagePath).toBeUndefined();
      const published = diagramAssetPaths(await getDiagramIndex(copy)).map((p) => p.props.sourcePath);
      expect(published.some((p) => /\/01-(light|dark)\.svg$/.test(p))).toBe(false);
    } finally {
      rmSync(copy, { recursive: true, force: true });
    }
  });

  // @req NFR-009
  it("renders the real Chapter 1 from the vault, unedited and read-only, with no errors", async () => {
    const vault = await buildVault({
      vaultRoot: realVault,
      figures: async () => createFigureRenderer(await getDiagramIndex(realVault)),
    });
    const chapter = vault.chapters.find(
      (c) => c.sourcePath === "part-1_foundations/chapter-1_computer-architecture.md",
    );
    expect(chapter, "Chapter 1 is published").toBeDefined();
    const mine = vault.issues.filter((i) => i.file === chapter!.sourcePath);
    expect(
      mine.filter((i) => i.severity === "error"),
      "errors in Chapter 1",
    ).toEqual([]);
    expect(chapter!.html).toContain('<figure class="diagram"');
    expect(chapter!.html).toContain('<annotation encoding="application/x-tex">\\mu s</annotation>');
    expect(chapter!.sections.slice(0, 3).map((s) => `${s.number} ${s.text}`)).toEqual([
      "1.1 Components",
      "1.1.1 Disk",
      "1.1.2 RAM (Random Access Memory)",
    ]);
  });
});
