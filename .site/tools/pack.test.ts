import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { pack, sectionByAnchor, slugify } from "./pack.ts";

const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

function put(root: string, rel: string, text: string) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
}

/** A tiny repository: two packets in round R-05, feature and module specs, standards, progress. */
function fixtureRepo(budget = 30000): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-pack-"));
  tempRoots.push(root);
  const packet = (id: string, deliver: string, load: string, files: string) =>
    ["---", `id: ${id}`, `title: "Task ${id}"`, "feature: FEAT-content", "module: MOD-vault", "phase: 1", "round: R-05",
      "size: M", "points: 3", "care: standard", "kind: feature", "depends_on: []", "parallel_safe: false", "screens: []",
      `delivers: [${deliver}]`, `files: [${files}]`, `load: [${load}]`, `context_budget_tokens: ${budget}`, "status: ready",
      "---", `# ${id}: Task ${id}`, "", "## Goal", `Goal of ${id}.`, ""].join("\n");
  put(root, "plan/tasks/T-01.03.md", packet("T-01.03", "REQ-CNT-001.AC1", "specs/standards.md#testing", ".site/src/features/content/scan.ts, .site/tests/fixtures/vault/**"));
  put(root, "plan/tasks/T-01.04.md", packet("T-01.04", "REQ-CNT-001.AC2", "specs/standards.md#testing", ".site/src/features/content/missing.ts"));
  put(root, "plan/rounds.md", ["| Round | Phase | Goal | Tasks | Points | Care | Ends with |", "|---|---|---|---|---|---|---|",
    "| R-05 | 1 | Vault | T-01.04, T-01.03 | 6 | Standard | done |", ""].join("\n"));
  put(root, ".blueprint/state.json", "{}");
  put(root, ".blueprint/progress.md", "# Progress log\n" + Array.from({ length: 12 }, (_, i) => `line ${i + 1}`).join("\n") + "\n");
  put(root, "specs/features/content.md", ["# FEAT-content", "", "## Requirements", "", "### REQ-CNT-001 Find the book's parts and chapters",
    "WHEN the build runs THE SYSTEM SHALL find chapters.", "- REQ-CNT-001.AC1: Given a part, then chapters.", "- REQ-CNT-001.AC2: Given numbers, then order.", "",
    "### REQ-CNT-002 Titles", "WHEN no title THE SYSTEM SHALL derive one.", "- REQ-CNT-002.AC1: Given a slug, then a title.", ""].join("\n"));
  put(root, "specs/modules.md", ["# Modules", "", "## MOD-vault", "- Purpose: turn the vault into a book.", "", "## MOD-site", "- Purpose: shared shell.", ""].join("\n"));
  put(root, "specs/standards.md", ["# Standards", "", "## Testing", "Vitest for unit tests.", "```md", "## Not a heading (inside a code fence)", "```", "",
    "## Errors", "Never thrown for content problems.", ""].join("\n"));
  put(root, ".site/src/features/content/scan.ts", "export const scan = 1; // current contents\n");
  return root;
}

describe("slugify and sectionByAnchor", () => {
  it("makes GitHub-style anchors", () => {
    expect(slugify("MOD-site (`.site/src/features/site/index.ts`)")).toBe("mod-site-sitesrcfeaturessiteindexts");
    expect(slugify("TOOL-09 Screen test harness (screenshots, axe, JS off)")).toBe("tool-09-screen-test-harness-screenshots-axe-js-off");
    expect(slugify("R0 Making or changing a diagram")).toBe("r0-making-or-changing-a-diagram");
  });

  it("ignores headings inside code fences", () => {
    const s = sectionByAnchor(readFileSync(join(fixtureRepo(), "specs/standards.md"), "utf8"), "testing")!;
    expect(s).toContain("Not a heading (inside a code fence)");
    expect(s).not.toContain("## Errors");
  });
});

describe("pack", () => {
  // @req TOOL-01.AC1
  it("includes the delivered requirement's section and the module entry", () => {
    const { text } = pack("T-01.03", { root: fixtureRepo() });
    expect(text).toContain("### REQ-CNT-001 Find the book's parts and chapters");
    expect(text).toContain("- REQ-CNT-001.AC2: Given numbers, then order.");
    expect(text).not.toContain("### REQ-CNT-002 Titles");
    expect(text).toContain("## MOD-vault");
    expect(text).not.toContain("## MOD-site");
  });

  // @req TOOL-01.AC2
  it("warns with both numbers when the bundle is over budget", () => {
    const { tokens, warnings } = pack("T-01.03", { root: fixtureRepo(50) });
    expect(tokens).toBeGreaterThan(50);
    expect(warnings.join("\n")).toMatch(new RegExp(`${tokens}.*50|50.*${tokens}`));
  });

  it("doesn't warn when the bundle fits", () => {
    expect(pack("T-01.03", { root: fixtureRepo() }).warnings).toEqual([]);
  });

  // @req TOOL-01.AC3
  it("includes only the loaded heading's section, not the whole file", () => {
    const { text } = pack("T-01.03", { root: fixtureRepo() });
    expect(text).toContain("Vitest for unit tests.");
    expect(text).not.toContain("Never thrown for content problems.");
  });

  // @req TOOL-01.AC4
  it("bundles every packet of a round, in the round's order, into one file", () => {
    const root = fixtureRepo();
    const out = join(root, "R-05-pack.md");
    const { text } = pack("R-05", { root, out });
    expect(readFileSync(out, "utf8")).toBe(text);
    const a = text.indexOf("# T-01.04: Task T-01.04"), b = text.indexOf("# T-01.03: Task T-01.03");
    expect(a).toBeGreaterThan(-1);
    expect(b).toBeGreaterThan(a);
    expect(text.split("Vitest for unit tests.").length - 1).toBe(1); // shared section appears once
  });

  it("adds current file contents, notes missing files and folders, and the last 10 progress lines", () => {
    const { text } = pack("R-05", { root: fixtureRepo() });
    expect(text).toContain("export const scan = 1; // current contents");
    expect(text).toMatch(/content\/missing\.ts\s+\(doesn't exist yet/);
    expect(text).toMatch(/fixtures\/vault\/\*\*\s+\(a folder of files/);
    expect(text).toContain("line 12");
    expect(text).toContain("line 3");
    expect(text).not.toContain("line 2\n");
  });

  it("doesn't repeat a file that's both loaded whole and changed, and names a missing module", () => {
    const root = fixtureRepo();
    const p = join(root, "plan/tasks/T-01.03.md");
    writeFileSync(p, readFileSync(p, "utf8")
      .replace("load: [specs/standards.md#testing]", "load: [specs/standards.md#testing, specs/modules.md]")
      .replace("files: [", "files: [specs/modules.md, ")
      .replace("module: MOD-vault", "module: MOD-ghost"));
    const { text } = pack("T-01.03", { root });
    expect(text.split("- Purpose: shared shell.").length - 1).toBe(1);
    expect(text).toContain("## MOD-ghost\n(not found in specs/modules.md)");
  });

  it("keeps accented letters in anchors", () => {
    expect(slugify("Café résumé")).toBe("café-résumé");
    expect(slugify("Café")).toBe("café");
  });

  it("refuses an unknown target", () => {
    expect(() => pack("T-99.99", { root: fixtureRepo() })).toThrow("Unknown task or round: T-99.99");
  });
});
