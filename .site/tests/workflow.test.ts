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
    expect(job("build")).toMatch(/needs: \[checks, secrets, e2e\]/); // nothing deploys unless the screen tests pass too
    expect(job("deploy")).toMatch(/needs: build/);
    expect(job("deploy")).toMatch(/if: \(github\.event_name == 'push' \|\| github\.event_name == 'workflow_dispatch'\) && github\.ref == 'refs\/heads\/main'/);
    expect(workflow).not.toMatch(/dorny\/paths-filter|changed-files/);
  });

  // @req REQ-SITE-007.AC1
  // The 10-minute budget itself is measured on real pushes (R-09: 2 min 50 s from push to live, run 45907209109,
  // .blueprint/progress.md). This proves the path behind it: a push publishes by itself, through capped jobs only.
  it("publishes a pushed chapter with no manual step: push, then checks, build and deploy, each with a time limit", () => {
    expect(topLevel("on")).toMatch(/^  push:\n    branches: \[main\]/m);
    for (const name of ["checks", "secrets", "e2e", "build", "deploy"]) expect(job(name), `${name} has a time limit`).toMatch(/timeout-minutes: \d+/);
    expect(job("deploy")).toMatch(/needs: build/);
    expect(job("deploy")).not.toMatch(/environment:[\s\S]*?reviewers|wait-timer/); // no approval step before going live
  });

  it("grants write access only to the deploy job", () => {
    expect(topLevel("permissions")).toBe("  contents: read\n\n");
    expect(job("deploy")).toMatch(/permissions:\n      pages: write\n      id-token: write/);
    expect(job("checks")).not.toMatch(/permissions:/);
    expect(job("secrets")).not.toMatch(/permissions:/);
    expect(job("build")).not.toMatch(/permissions:/);
  });

  it("never puts a ${{ }} expression inside a shell command (values go through env instead)", () => {
    const runBlocks = [...workflow.matchAll(/^(\s+)run: (\|\n(?:\1  .*\n)+|.*\n)/gm)].map((m) => m[2]!);
    expect(runBlocks.length).toBeGreaterThan(0);
    for (const block of runBlocks) expect(block, block).not.toContain("${{");
  });

  it("pins every Action to a full commit SHA", () => {
    const uses = [...workflow.matchAll(/uses: (\S+)/g)].map((m) => m[1]!);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u, u).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40}$/);
  });
});
