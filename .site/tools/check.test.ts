import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { check } from "./check.ts";
import { repoRoot } from "./cli.ts";
import { trace } from "./trace.ts";

const FIXTURE = join(import.meta.dirname, "../tests/fixtures/plan");
// Built at runtime so the real-repo scan never sees a fake tag in this file.
const TAG = "@" + "req";

const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** A fresh copy of the valid fixture plan. */
function plan(): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-check-"));
  tempRoots.push(root);
  cpSync(FIXTURE, root, { recursive: true });
  return root;
}
function edit(root: string, rel: string, from: string | RegExp, to: string) {
  const p = join(root, rel);
  const before = readFileSync(p, "utf8");
  const after = before.replace(from, to);
  if (after === before) throw new Error(`fixture edit didn't apply to ${rel}`);
  writeFileSync(p, after);
}
const problems = (root: string) => check(root).problems.join("\n");

describe("check", () => {
  it("passes on the valid fixture plan", () => {
    expect(check(plan())).toEqual({ ok: true, problems: [] });
  });

  // @req TOOL-03.AC1
  it("fails on a delivered ID that doesn't exist", () => {
    const root = plan();
    edit(root, "plan/tasks/T-01.01.md", "delivers: [REQ-DEMO-001.AC1,", "delivers: [REQ-XXX-999.AC1, REQ-DEMO-001.AC1,");
    expect(problems(root)).toContain("REQ-XXX-999.AC1");
  });

  // @req TOOL-03.AC2
  it("fails on a dependency cycle, naming it", () => {
    const root = plan();
    edit(root, "plan/tasks/T-00.01.md", "depends_on: []", "depends_on: [T-01.01]");
    expect(problems(root)).toMatch(/cycle.*T-00\.01.*T-01\.01|cycle.*T-01\.01.*T-00\.01/);
  });

  // @req TOOL-03.AC3
  it("fails on a round over its budget, naming the round", () => {
    const root = plan();
    edit(root, "plan/rounds.md", "Round budget: 8 points", "Round budget: 2 points");
    expect(problems(root)).toMatch(/R-02.*3 points.*budget of 2/);
  });

  // @req TOOL-03.AC4
  it("fails on a done task whose criterion has no tagged test, naming the criterion", () => {
    const root = plan();
    edit(root, "plan/tasks/T-01.01.md", "status: ready", "status: done");
    edit(root, ".site/tests/demo.tagged.ts", "export const demo", `// ${TAG} REQ-DEMO-001.AC1\n// ${TAG} NFR-001\nexport const demo`);
    const text = problems(root);
    expect(text).toContain("REQ-DEMO-001.AC2");
    expect(text).not.toMatch(/REQ-DEMO-001\.AC1 has no/);
  });

  // @req TOOL-03.AC5
  it("passes on the real plan as shipped", () => {
    expect(check(repoRoot)).toEqual({ ok: true, problems: [] });
  });

  it("fails on a tag that names no known criterion", () => {
    const root = plan();
    edit(root, ".site/tests/demo.tagged.ts", "export const demo", `// ${TAG} REQ-NOPE-001.AC9\nexport const demo`);
    expect(problems(root)).toMatch(/REQ-NOPE-001\.AC9.*demo\.tagged\.ts/);
  });

  it("fails on an undelivered criterion and an unserved requirement", () => {
    const root = plan();
    edit(root, "plan/tasks/T-01.01.md", "REQ-DEMO-001.AC2, ", "");
    edit(root, "specs/modules.md", "- Serves: REQ-DEMO-001", "- Serves: none");
    const text = problems(root);
    expect(text).toMatch(/REQ-DEMO-001\.AC2.*no task/);
    expect(text).toMatch(/REQ-DEMO-001.*no module/);
  });

  it("fails on points that don't match the size, a missing section, and an oversized task", () => {
    const root = plan();
    edit(root, "plan/tasks/T-01.01.md", "points: 3", "points: 4");
    edit(root, "plan/tasks/T-00.01.md", "## Done when", "## Finished when");
    edit(root, "plan/tasks/T-00.01.md", "size: S", "size: L");
    const text = problems(root);
    expect(text).toMatch(/T-01\.01.*4 points.*size M/);
    expect(text).toMatch(/T-00\.01.*Done when/);
    expect(text).toMatch(/T-00\.01.*size L/);
  });

  it("fails on two Careful tasks in a round, or a Careful task that isn't first", () => {
    const root = plan();
    edit(root, "plan/rounds.md", "| R-01 | 0 | Tool | T-00.01 | 2 |", "| R-01 | 0 | Tool | T-00.01, T-01.01 | 5 |");
    edit(root, "plan/rounds.md", /\| R-02 [^\n]*\n/, "");
    edit(root, "plan/tasks/T-01.01.md", "round: R-02", "round: R-01");
    edit(root, "plan/tasks/T-01.01.md", "care: standard", "care: careful");
    expect(problems(root)).toMatch(/R-01.*Careful task T-01\.01 isn't first/);
  });

  it("fails on more than one Careful task in a round", () => {
    const root = plan();
    edit(root, "plan/rounds.md", "| R-01 | 0 | Tool | T-00.01 | 2 |", "| R-01 | 0 | Tool | T-00.01, T-01.01 | 6 |");
    edit(root, "plan/rounds.md", /\| R-02 [^\n]*\n/, "");
    edit(root, "plan/tasks/T-01.01.md", "round: R-02", "round: R-01");
    edit(root, "plan/tasks/T-01.01.md", "care: standard", "care: careful");
    edit(root, "plan/tasks/T-00.01.md", "size: S\npoints: 2\ncare: standard", "size: M\npoints: 3\ncare: careful");
    expect(problems(root)).toMatch(/R-01 has 2 Careful tasks/);
  });

  it("applies the Careful rules whatever the capitalisation, and rejects unknown care levels", () => {
    const root = plan();
    edit(root, "plan/tasks/T-00.01.md", "care: standard", "care: Careful");
    edit(root, "plan/tasks/T-01.01.md", "care: standard", "care: relaxed");
    const text = problems(root);
    expect(text).toMatch(/T-00\.01 is Careful but sized S\/2/);
    expect(text).toMatch(/T-01\.01 has care "relaxed"/);
  });

  it("doesn't re-judge a finished round against a later, smaller budget", () => {
    const root = plan();
    edit(root, "plan/rounds.md", "Round budget: 8 points", "Round budget: 1 points");
    const text = problems(root);
    expect(text).not.toMatch(/R-01 has 2 points/); // R-01's only task is done
    expect(text).toMatch(/R-02 has 3 points, over the round budget of 1/);
  });

  it("only counts tags in tests as evidence", () => {
    const root = plan();
    writeFileSync(join(root, ".site/src.ts"), `// ${TAG} REQ-DEMO-001.AC2\n`);
    edit(root, "plan/tasks/T-01.01.md", "status: ready", "status: done");
    expect(problems(root)).toMatch(/REQ-DEMO-001\.AC2 has no test tagged/);
  });

  it("fails on an open conflict and an open coverage topic", () => {
    const root = plan();
    edit(root, "specs/conflicts.md", "- Status: resolved", "- Status: Open");
    edit(root, "specs/intake.md", "| Users and roles | confirmed |", "| Users and roles | open |");
    const text = problems(root);
    expect(text).toContain("CNF-001");
    expect(text).toContain("Users and roles");
  });
});

describe("trace", () => {
  // @req TOOL-03.AC6
  it("writes specs/trace.md listing every active criterion with its task", () => {
    const root = plan();
    const text = trace(root);
    expect(readFileSync(join(root, "specs/trace.md"), "utf8")).toBe(text);
    expect(text).toMatch(/\| REQ-DEMO-001\.AC1 \| T-01\.01 \| ready \|/);
    expect(text).toMatch(/\| REQ-DEMO-001\.AC2 \| T-01\.01 \| ready \|/);
    expect(text).toMatch(/\| NFR-001 \| T-01\.01 \| ready \|/);
    expect(text).toMatch(/\| TOOL-01\.AC1 \| T-00\.01 \| done \| \.site\/tests\/demo\.tagged\.ts \|/);
    expect(text).not.toContain("REQ-DEMO-002");
  });
});
