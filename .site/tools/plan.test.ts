import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { main, repoRoot } from "./cli.ts";
import { loadPlan, markDone, nextTasks, parseFrontmatter, statusReport } from "./plan.ts";

const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Writes a two-task plan (T-00.01 done, T-00.02 ready and depending on it) into a temp folder. */
function fixturePlan(): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-plan-"));
  tempRoots.push(root);
  mkdirSync(join(root, "plan/tasks"), { recursive: true });
  mkdirSync(join(root, ".blueprint"), { recursive: true });
  mkdirSync(join(root, "specs"), { recursive: true });
  const packet = (id: string, status: string, deps: string, parallel: boolean) =>
    [
      "---", `id: ${id}`, `title: "Task ${id}"`, "feature: tooling", "module: tooling", "phase: 0", "round: R-01",
      "size: S", "points: 2", "care: standard       # quick, standard or careful", "kind: enabling",
      `depends_on: [${deps}]`, `parallel_safe: ${parallel}`, "screens: []", "delivers: [TOOL-02.AC1]",
      "files: [.site/src/pages/book/[slug].astro, .site/tools/x.ts]", "load: []", "context_budget_tokens: 15000",
      `status: ${status}`, "---", `# ${id}: Task`, "", "## Goal", "Example. The word status: here is body text.", "",
    ].join("\n");
  writeFileSync(join(root, "plan/tasks/T-00.01.md"), packet("T-00.01", "done", "", false));
  writeFileSync(join(root, "plan/tasks/T-00.02.md"), packet("T-00.02", "ready", "T-00.01", true));
  writeFileSync(join(root, "plan/rounds.md"), [
    "# Rounds", "", "| Round | Phase | Goal | Tasks | Points | Care | Ends with |", "|---|---|---|---|---|---|---|",
    "| R-01 | 0 | Scaffold and tracker | T-00.01, T-00.02 | 4 | Standard | build works |", "",
  ].join("\n"));
  writeFileSync(join(root, ".blueprint/state.json"), JSON.stringify({ gates: { G5: "approved" }, build: { current_round: null, last_done: null } }, null, 2));
  writeFileSync(join(root, ".blueprint/progress.md"), "# Progress log\n2026-11-26 · planning · package created\n");
  writeFileSync(join(root, "specs/conflicts.md"), "# Conflicts\n\n### CNF-001 Something\n- Type: unverified\n- Status: open\n- Decision: pending\n");
  return root;
}

function collect() {
  const out: string[] = [];
  const err: string[] = [];
  return { io: { log: (t: string) => out.push(t), error: (t: string) => err.push(t) }, out, err };
}

describe("parseFrontmatter", () => {
  it("reads the T9 subset, including lists whose items contain brackets", () => {
    const fm = parseFrontmatter(readFileSync(join(fixturePlan(), "plan/tasks/T-00.02.md"), "utf8"));
    expect(fm.title).toBe("Task T-00.02");
    expect(fm.points).toBe(2);
    expect(fm.parallel_safe).toBe(true);
    expect(fm.care).toBe("standard");
    expect(fm.depends_on).toEqual(["T-00.01"]);
    expect(fm.screens).toEqual([]);
    expect(fm.files).toEqual([".site/src/pages/book/[slug].astro", ".site/tools/x.ts"]);
  });

  it("reads a packet saved with a UTF-8 BOM", () => {
    const text = readFileSync(join(fixturePlan(), "plan/tasks/T-00.02.md"), "utf8");
    expect(parseFrontmatter("﻿" + text).id).toBe("T-00.02");
  });

  it("refuses to load a packet with no readable id", () => {
    const root = fixturePlan();
    writeFileSync(join(root, "plan/tasks/notes.md"), "Just some notes, no frontmatter.\n");
    expect(() => loadPlan(root)).toThrow(/notes\.md has no readable frontmatter id/);
  });
});

describe("next", () => {
  // @req TOOL-02.AC1
  it("lists T-00.02 under R-01 once T-00.01 is done", () => {
    const groups = nextTasks(loadPlan(fixturePlan()));
    expect(groups).toEqual([{ round: "R-01", tasks: [{ id: "T-00.02", title: "Task T-00.02", parallelSafe: true }] }]);
  });

  it("doesn't list a task whose dependency isn't done", () => {
    const root = fixturePlan();
    const p = join(root, "plan/tasks/T-00.01.md");
    writeFileSync(p, readFileSync(p, "utf8").replace("status: done", "status: ready"));
    const ids = nextTasks(loadPlan(root)).flatMap((g) => g.tasks.map((t) => t.id));
    expect(ids).toEqual(["T-00.01"]);
  });
});

describe("done", () => {
  // @req TOOL-02.AC2
  it("marks the packet done, logs one progress line and records last_done", () => {
    const root = fixturePlan();
    const before = readFileSync(join(root, ".blueprint/progress.md"), "utf8").trimEnd().split("\n").length;
    markDone(root, "T-00.02", new Date("2026-11-26T16:45:00Z"));
    const packet = readFileSync(join(root, "plan/tasks/T-00.02.md"), "utf8");
    expect(parseFrontmatter(packet).status).toBe("done");
    expect(packet).toContain("The word status: here is body text.");
    const lines = readFileSync(join(root, ".blueprint/progress.md"), "utf8").trimEnd().split("\n");
    expect(lines.length).toBe(before + 1);
    expect(lines.at(-1)).toBe("2026-11-26T16:45Z · R-01 · T-00.02 · done");
    const state = JSON.parse(readFileSync(join(root, ".blueprint/state.json"), "utf8"));
    expect(state.build.last_done).toBe("T-00.02");
    expect(state.build.current_round).toBe("R-01");
    expect(state.gates.G5).toBe("approved");
  });

  it("keeps CRLF line endings in the packet, progress.md and state.json", () => {
    const root = fixturePlan();
    for (const f of ["plan/tasks/T-00.02.md", ".blueprint/progress.md", ".blueprint/state.json"]) {
      const p = join(root, f);
      writeFileSync(p, readFileSync(p, "utf8").replace(/\n/g, "\r\n"));
    }
    markDone(root, "T-00.02", new Date("2026-11-26T16:45:00Z"));
    for (const f of ["plan/tasks/T-00.02.md", ".blueprint/progress.md", ".blueprint/state.json"]) {
      const text = readFileSync(join(root, f), "utf8");
      expect(text.replace(/\r\n/g, ""), `${f} has a bare LF`).not.toContain("\n");
    }
    expect(readFileSync(join(root, "plan/tasks/T-00.02.md"), "utf8")).toContain("status: done\r\n");
  });

  it("refuses a packet without a status line instead of logging it as done", () => {
    const root = fixturePlan();
    const p = join(root, "plan/tasks/T-00.02.md");
    writeFileSync(p, readFileSync(p, "utf8").replace("status: ready\n", ""));
    expect(() => markDone(root, "T-00.02")).toThrow(/no 'status:' line/);
    expect(readFileSync(join(root, ".blueprint/progress.md"), "utf8")).not.toContain("T-00.02");
  });

  // @req TOOL-02.AC3
  it("exits non-zero with 'Unknown task' for an unknown ID", () => {
    const { io, err } = collect();
    const code = main(["done", "T-99.99"], fixturePlan(), io);
    expect(code).not.toBe(0);
    expect(err.join("\n")).toContain("Unknown task");
  });
});

describe("status and the CLI", () => {
  it("reports gates, counts, open conflicts and next tasks", () => {
    const report = statusReport(loadPlan(fixturePlan()));
    expect(report).toContain("G5: approved");
    expect(report).toContain("done 1");
    expect(report).toContain("ready 1");
    expect(report).toContain("CNF-001");
    expect(report).toContain("T-00.02");
  });

  it("prints usage and fails for an unknown command", () => {
    const { io, err } = collect();
    expect(main(["frobnicate"], fixturePlan(), io)).not.toBe(0);
    expect(err.join("\n")).toContain("Usage");
  });

  it("reads the real plan shipped in the repository (read-only smoke test)", () => {
    const plan = loadPlan(repoRoot);
    expect(plan.packets.length).toBeGreaterThan(0);
    expect(plan.rounds.length).toBeGreaterThan(0);
    const ids = new Set(plan.packets.map((p) => p.id));
    for (const r of plan.rounds) for (const t of r.tasks) expect(ids.has(t), `${r.id} lists ${t}`).toBe(true);
    for (const p of plan.packets) expect(p.round).toMatch(/^R-\d\d$/);
  });
});
