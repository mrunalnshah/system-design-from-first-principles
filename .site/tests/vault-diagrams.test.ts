import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildVault } from "../src/features/content/index.ts";
import { createFigureRenderer, diagramAssetPaths, getDiagramIndex } from "../src/features/diagrams/index.ts";

/** The vault loader with MOD-diagrams' real figure renderer, as content.config.ts joins them (CR-0007). */
const fixture = join(import.meta.dirname, "fixtures/vault");

describe("the loader and the diagram route together", () => {
  it("records every diagram a published entry draws, so the diagram route publishes exactly those", async () => {
    const vault = await buildVault({ vaultRoot: fixture, figures: async () => createFigureRenderer(await getDiagramIndex(fixture)) });
    expect(vault.issues).toEqual([]);
    const published = diagramAssetPaths(await getDiagramIndex(fixture)).map((p) => p.props.sourcePath).sort();
    // The fixture's 01-light.svg / 01-dark.svg pair is in the vault but no entry shows it, so it isn't published.
    expect(published).toEqual(["01_computer-architecture-dark", "01_computer-architecture-light", "02_moores-law-dark", "02_moores-law-light"].map((n) => `part-1_foundations/diagram/${n}.svg`));
  });
});
