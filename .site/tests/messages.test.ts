import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * TOOL-15 Build-message harness (plan/tools.md, NFR-013, specs/contracts/build-messages.md).
 * Each message code has a small broken vault in `tests/fixtures/broken/<code>/`, with an `expected.json`
 * naming the file and line the issue must point at. The harness reads each fixture through the vault
 * reader and checks it produces exactly that one issue, with the contract's severity and fix text, and that
 * an error fails the build while a warning doesn't.
 *
 * Codes arrive with the task that introduces them (plan/tools.md: "one case added by each task that
 * introduces a message code"), so a code without a fixture fails only once its task is done.
 */
const root = join(import.meta.dirname, "../..");
const brokenDir = join(import.meta.dirname, "fixtures/broken");
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");

/** Codes the plan gives no task yet; each needs a packet before the phase ends (AGENTS.md, phase end). */
const UNOWNED = new Set(["W-EMPTY-BOOK"]);

type ContractRow = { code: string; severity: "error" | "warning"; fixStart: string };

/** The table in build-messages.md. `fixStart` is the fixed opening of the fix text, before any `<placeholder>` or `…`. */
export function contractRows(markdown: string): ContractRow[] {
  return [...markdown.matchAll(/^\| ([EW]-[A-Z-]+) \| (error|warning) \|[^|]*(?:\\\|[^|]*)*\| "((?:[^"\\]|\\.)*)"/gm)].map((m) => ({
    code: m[1]!,
    severity: m[2] as "error" | "warning",
    fixStart: m[3]!.replace(/\\\|/g, "|").split(/<|…/)[0]!.trim(),
  }));
}

/** Problems with the fixtures for `codes`: one line per code that has no fixture although it should. */
export function fixtureProblems(codes: string[], dir: string, mayWait: (code: string) => string | undefined): string[] {
  return codes.flatMap((code) => {
    if (existsSync(join(dir, code, "expected.json"))) return [];
    const waiting = mayWait(code);
    return waiting ? [] : [`${code} has no fixture: add tests/fixtures/broken/${code}/ with an expected.json`];
  });
}

/** Why `code` may still lack a fixture (its task isn't done, or it has no task yet), or undefined if it may not. */
function waitingFor(code: string): string | undefined {
  if (UNOWNED.has(code)) return "no task yet";
  const tasks = readdirSync(join(root, "plan/tasks"))
    .filter((f) => f.endsWith(".md"))
    .map((f) => read(`plan/tasks/${f}`))
    .filter((t) => t.includes(code));
  const open = tasks.filter((t) => !/^status: done$/m.test(t)).map((t) => /^id: (\S+)/m.exec(t)?.[1]);
  return tasks.length && open.length === tasks.length ? `waits for ${open.join(", ")}` : undefined;
}

/** Fixture folders present now, each named after its code. */
function fixtures(): string[] {
  return existsSync(brokenDir) ? readdirSync(brokenDir).filter((d) => statSync(join(brokenDir, d)).isDirectory()) : [];
}

describe("build-message harness (TOOL-15)", () => {
  const rows = contractRows(read("specs/contracts/build-messages.md"));

  it("reads every code from the contract", () => {
    expect(rows.length).toBe([...read("specs/contracts/build-messages.md").matchAll(/^\| [EW]-[A-Z-]+ \|/gm)].length);
    expect(rows.find((r) => r.code === "E-FRONTMATTER-FIELD")?.fixStart).toBe("Change");
    expect(rows.find((r) => r.code === "W-DIAGRAM-NO-CAPTION")?.fixStart).toBe("Add a caption: ![[file.svg|Caption]].");
  });

  // @req TOOL-15.AC2
  it("fails, naming the code, when a contract code has no fixture", () => {
    expect(fixtureProblems(["E-NO-SUCH-FIXTURE"], brokenDir, () => undefined)).toEqual([
      "E-NO-SUCH-FIXTURE has no fixture: add tests/fixtures/broken/E-NO-SUCH-FIXTURE/ with an expected.json",
    ]);
  });

  it("has a fixture for every code whose task is done", () => {
    expect(fixtureProblems(rows.map((r) => r.code), brokenDir, waitingFor)).toEqual([]);
    for (const code of UNOWNED) expect(waitingFor(code), `${code} now has a task: remove it from UNOWNED`).toBe("no task yet");
  });

  it("names only contract codes as fixtures", () => {
    for (const f of fixtures()) expect(rows.map((r) => r.code), `fixture ${f}`).toContain(f);
  });
});
