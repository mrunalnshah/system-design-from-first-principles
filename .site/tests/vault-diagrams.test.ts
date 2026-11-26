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
    const vault = await buildVault({ vaultRoot: fixture, figures: async () => createFigureRenderer(await getDiagramIndex(fixture)) });
    expect(vault.issues).toEqual([]);
    const published = diagramAssetPaths(await getDiagramIndex(fixture)).map((p) => p.props.sourcePath).sort();
    // The fixture's 01-light.svg / 01-dark.svg pair is in the vault but no entry shows it, so it isn't published.
    expect(published).toEqual(["01_computer-architecture-dark", "01_computer-architecture-light", "02_moores-law-dark", "02_moores-law-light"].map((n) => `part-1_foundations/diagram/${n}.svg`));
  });

  // @req NFR-009
  it("renders the real Chapter 1 from the vault, unedited and read-only, with no errors", async () => {
    const vault = await buildVault({ vaultRoot: realVault, figures: async () => createFigureRenderer(await getDiagramIndex(realVault)) });
    const chapter = vault.chapters.find((c) => c.sourcePath === "part-1_foundations/chapter-1_computer-architecture.md");
    expect(chapter, "Chapter 1 is published").toBeDefined();
    const mine = vault.issues.filter((i) => i.file === chapter!.sourcePath);
    expect(mine.filter((i) => i.severity === "error"), "errors in Chapter 1").toEqual([]);
    expect(chapter!.html).toContain('<figure class="diagram"');
    expect(chapter!.html).toContain('<annotation encoding="application/x-tex">\\mu s</annotation>');
    expect(chapter!.sections.slice(0, 3).map((s) => `${s.number} ${s.text}`)).toEqual(["1.1 Components", "1.1.1 Disk", "1.1.2 RAM (Random Access Memory)"]);
  });
});
