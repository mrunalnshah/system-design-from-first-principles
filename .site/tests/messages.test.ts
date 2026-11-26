import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readVault } from "../src/features/content/index.ts";
import { createFigureRenderer, getDiagramIndex } from "../src/features/diagrams/index.ts";
import { createFileResolver, renderObsidian } from "../src/features/markdown/index.ts";
import { buildReport, createIssueCollector } from "../src/features/site/index.ts";

/**
 * TOOL-15 Build-message harness (plan/tools.md, NFR-013, specs/contracts/build-messages.md).
 * Each message code has a small broken vault in `tests/fixtures/broken/<code>/`, with an `expected.json`
 * naming the file and line the issue must point at. The harness reads each fixture through the vault
 * reader, renders every published entry as the loader will (T-01.14 takes this over), and checks it produces
 * exactly that one issue, with the contract's severity and fix text, and that
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

/**
 * Every issue a fixture vault produces: the vault's own, then each published entry's render, with the context the
 * loader (T-01.14) will give: links to published entries, embeds over the vault's files, chapter numbering, and
 * MOD-diagrams' figure renderer over the fixture's own diagram index.
 */
async function issuesOf(vaultDir: string) {
  const vault = readVault(vaultDir);
  const files = allFiles(vaultDir);
  const entries = [...vault.chapters, ...vault.articles, ...vault.pages];
  const figure = createFigureRenderer(await getDiagramIndex(vaultDir));
  const notes = new Map(entries.map((e) => [e.sourcePath.split("/").pop()!.replace(/\.md$/, ""), { href: `/${e.kind}/${e.slug}/`, title: e.title }]));
  const rendered = await Promise.all(
    entries.map((e) =>
      renderObsidian(readFileSync(join(vaultDir, e.sourcePath), "utf8"), {
        filePath: e.sourcePath,
        resolveFile: createFileResolver(files),
        resolveNote: (target) => notes.get(target),
        headingNumbers: e.kind === "chapter" ? { prefix: String(e.number) } : false,
        figure,
      }),
    ),
  );
  return [...vault.issues, ...rendered.flatMap((r) => r.issues)];
}

/** Vault-relative paths of every file under `dir`. */
function allFiles(dir: string, prefix = ""): string[] {
  return readdirSync(join(dir, prefix), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? allFiles(dir, `${prefix}${e.name}/`) : [`${prefix}${e.name}`],
  );
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

  // @req TOOL-15.AC1
  it("fails the fixture broken/E-BOOK-MISSING with E-BOOK-MISSING and the contract's fix text", () => {
    const [issue, ...rest] = readVault(join(brokenDir, "E-BOOK-MISSING")).issues;
    expect(rest).toEqual([]);
    expect(issue).toMatchObject({ severity: "error", code: "E-BOOK-MISSING", file: "book.md" });
    expect(issue!.fix.startsWith(rows.find((r) => r.code === "E-BOOK-MISSING")!.fixStart)).toBe(true);
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

  it("gets exactly its own message from each fixture, with the contract's severity and fix text", async () => {
    expect(fixtures().length).toBeGreaterThan(0);
    for (const code of fixtures()) {
      const expected = JSON.parse(readFileSync(join(brokenDir, code, "expected.json"), "utf8")) as { file: string; line?: number };
      const row = rows.find((r) => r.code === code)!;
      const issues = await issuesOf(join(brokenDir, code));
      expect(issues.map((i) => i.code), `fixture ${code}`).toEqual([code]);
      const [issue] = issues;
      expect({ severity: issue!.severity, file: issue!.file, line: issue!.line }, `fixture ${code}`).toEqual({ severity: row.severity, file: expected.file, line: expected.line });
      expect(issue!.fix.startsWith(row.fixStart), `fixture ${code}: fix "${issue!.fix}" should start "${row.fixStart}"`).toBe(true);
      expect(issue!.message.length, `fixture ${code} explains what's wrong`).toBeGreaterThan(10);
    }
  });

  it("fails the build for an error fixture and not for a warning fixture", async () => {
    for (const code of fixtures()) {
      const collector = createIssueCollector();
      (await issuesOf(join(brokenDir, code))).forEach((i) => collector.add(i));
      const exits: number[] = [];
      const hook = buildReport({ issues: collector, write: async () => {}, exit: (c) => void exits.push(c) }).hooks["astro:build:done"] as unknown as () => Promise<void>;
      await hook();
      expect(exits, `fixture ${code}`).toEqual(code.startsWith("E-") ? [1] : []);
    }
  });

  it("names only contract codes as fixtures", () => {
    for (const f of fixtures()) expect(rows.map((r) => r.code), `fixture ${f}`).toContain(f);
  });
});
