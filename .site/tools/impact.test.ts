import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { loadSpecIndex } from "./check.ts";
import { formatImpact, impact, matches } from "./impact.ts";

/** These tests read the real plan: the criteria name real files, features and modules. */
const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

describe("matches", () => {
  it("treats ** as any folders, * as one name, and the rest literally", () => {
    expect(matches(".site/src/features/diagrams/**", ".site/src/features/diagrams/client/viewer.ts")).toBe(true);
    expect(matches("src/features/*.ts", "src/features/a.ts")).toBe(true);
    expect(matches("src/features/*.ts", "src/features/x/a.ts")).toBe(false);
    expect(matches(".site/src/pages/[slug].astro", ".site/src/pages/[slug].astro")).toBe(true);
    expect(matches(".site/src/pages/[slug].astro", ".site/src/pages/s.astro")).toBe(false);
  });
});

describe("impact", () => {
  // @req TOOL-05.AC1
  it("names MOD-diagrams, FEAT-diagrams, REQ-DIAG-001 and the tests tagged with its criteria for pairs.ts", () => {
    const report = impact(repoRoot, [".site/src/features/diagrams/pairs.ts"]);
    expect(report.features).toEqual(["FEAT-diagrams"]);
    expect(report.modules).toEqual(["MOD-diagrams"]);
    expect(report.requirements).toContain("REQ-DIAG-001");
    const spec = loadSpecIndex(repoRoot);
    const criteria = spec.requirements.find((r) => r.id === "REQ-DIAG-001")!.criteria;
    const tagged = [...new Set(criteria.flatMap((c) => spec.tags.get(c) ?? []))];
    expect(tagged).toContain(".site/tests/diagrams.test.ts");
    for (const file of tagged) expect(report.tests).toContain(file);
    expect(report.tasks.length).toBeGreaterThan(0);
    expect(report.warnings).toEqual([]);
    const text = formatImpact(report);
    for (const name of ["MOD-diagrams", "FEAT-diagrams", "REQ-DIAG-001", ...tagged]) expect(text).toContain(name);
    expect(text).not.toContain("Warning");
  });

  // @req TOOL-05.AC2
  it("warns when the paths belong to two features", () => {
    const report = impact(repoRoot, [".site/src/features/diagrams/pairs.ts", ".site/src/features/reader/reader.css"]);
    expect(report.features).toEqual(["FEAT-diagrams", "FEAT-reader"]);
    expect(formatImpact(report)).toMatch(
      /Warning: This change crosses feature boundaries \(FEAT-diagrams, FEAT-reader\)/,
    );
  });

  it("reads feature paths written relative to the root as well as to .site/", () => {
    const report = impact(repoRoot, ["sync.cmd"]);
    expect(report.features).toEqual(["FEAT-authoring"]);
    expect(report.modules).toEqual(["MOD-authoring"]);
  });

  it("names a path nothing claims", () => {
    expect(impact(repoRoot, ["nowhere/at-all.txt"]).warnings).toEqual([
      "nowhere/at-all.txt belongs to no feature and no module.",
    ]);
  });

  it("takes a folder for the files in it", () => {
    for (const folder of [".site/src/features/book", ".site/src/features/book/"]) {
      const report = impact(repoRoot, [folder]);
      expect(report.paths[0]!.features).toEqual(["FEAT-book"]);
      expect(report.paths[0]!.modules).toEqual(["MOD-book"]);
      expect(report.warnings).toEqual([]);
    }
  });
});
