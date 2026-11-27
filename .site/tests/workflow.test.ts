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

/**
 * Guards for the NFRs that are measured rather than coded (CR-0013). The measurements themselves are in
 * specs/operations.md ("Release readiness results", T-04.05); these keep a later change from undoing what makes them
 * true, and keep the measurement recorded.
 */
describe("measured NFRs", () => {
  const operations = readFileSync(join(import.meta.dirname, "../../specs/operations.md"), "utf8").replace(/\r\n/g, "\n");
  const row = (label: string) => operations.split("\n").find((l) => l.startsWith(`| ${label}`)) ?? "";

  // @req NFR-005
  it("publishes a push by itself through to deploy, and records a measured 95th percentile of at most 10 minutes", () => {
    expect(job("deploy")).toMatch(/needs: build\n/);
    expect(job("deploy")).not.toMatch(/reviewers|wait-timer/);
    expect(job("deploy")).toMatch(/concurrency:\n      group: pages\n      cancel-in-progress: false/); // a deploy is never cancelled mid-way
    const p95 = /95th percentile (\d+(?:\.\d+)?) minutes/.exec(row("Publish time (NFR-005"))?.[1];
    expect(p95, "operations.md records the measured publish time").toBeDefined();
    expect(Number(p95)).toBeLessThanOrEqual(10);
  });

  // @req NFR-007
  it("costs nothing: no secret, no paid runner, only GitHub's own Actions, and the cost check recorded", () => {
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./);
    for (const [, runner] of workflow.matchAll(/runs-on: (\S+)/g)) expect(runner, "a standard GitHub-hosted runner").toMatch(/^ubuntu-\d\d\.\d\d$/);
    for (const [, action] of workflow.matchAll(/uses: ([\w.-]+)\//g)) expect(action, "an Action from GitHub itself").toBe("actions");
    expect(row("Cost (NFR-007")).toMatch(/\*\*Pass\*\*/);
  });

  // @req NFR-012
  it("runs no server of its own: static files, published only as the Pages artifact, with the monthly check kept", () => {
    const config = readFileSync(join(import.meta.dirname, "../astro.config.ts"), "utf8");
    expect(config).toMatch(/output: "static"/);
    expect(config).not.toMatch(/adapter:/);
    expect(job("build")).toMatch(/upload-pages-artifact@[0-9a-f]{40}.*\n\s+with:\n\s+path: \.site\/dist\n/);
    const monthly = operations.slice(operations.indexOf("## Monthly site check"));
    expect(monthly.split("\n").filter((l) => /^\| \d{4}-\d{2}-\d{2} \|/.test(l)).length, "at least one dated check").toBeGreaterThan(0);
  });
});
