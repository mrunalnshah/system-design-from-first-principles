import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards for .github/workflows/publish.yml, read as text (the project has no YAML dependency).
 * The live proof is the workflow history on GitHub; these keep later edits from breaking it.
 */
const workflow = readFileSync(join(import.meta.dirname, "../../.github/workflows/publish.yml"), "utf8").replace(/\r\n/g, "\n");
const topLevel = (key: string) => new RegExp(`^${key}:\\n((?:[ #].*\\n|\\n)*)`, "m").exec(workflow)?.[1] ?? "";
const job = (name: string) => new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)*)`, "m").exec(workflow)?.[1] ?? "";

describe("publish workflow", () => {
  // @req REQ-SITE-007.AC3
  it("builds and deploys on every push to main, whatever files changed (only .obsidian/ included)", () => {
    const on = topLevel("on");
    expect(on).toMatch(/^  push:\n    branches: \[main\]/m);
    expect(on).not.toMatch(/paths(-ignore)?:/);
    expect(job("build")).toMatch(/needs: checks/);
    expect(job("deploy")).toMatch(/needs: build/);
    expect(job("deploy")).toMatch(/if: github\.event_name != 'pull_request' && github\.ref == 'refs\/heads\/main'/);
    expect(workflow).not.toMatch(/dorny\/paths-filter|changed-files/);
  });

  it("grants write access only to the deploy job", () => {
    expect(topLevel("permissions")).toBe("  contents: read\n\n");
    expect(job("deploy")).toMatch(/permissions:\n      pages: write\n      id-token: write/);
    expect(job("checks")).not.toMatch(/permissions:/);
    expect(job("build")).not.toMatch(/permissions:/);
  });

  it("pins every Action to a full commit SHA", () => {
    const uses = [...workflow.matchAll(/uses: (\S+)/g)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u, u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });
});
