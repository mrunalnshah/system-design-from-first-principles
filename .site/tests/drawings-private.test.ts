/**
 * Drawing sources stay private (REQ-DIAG-006, ADR-0012, CNF-007): the Excalidraw sources (`*.excalidraw.md`,
 * `*.excalidraw`) are ignored by git, so the public repository never holds them, and no build ever publishes one;
 * only their exported SVGs are committed and published. Checks the repository's own `.gitignore` with
 * `git check-ignore`, and a built site (a copy of the fixture vault with drawing sources saved where the author saves
 * them) by listing and reading every file in it.
 */
import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { allFiles, rel } from "../tools/dist.ts";
import { cleanUp, tempFolder } from "../tools/test-site.ts";
import { buildFixtureSite } from "./build-site.ts";

const repoRoot = join(import.meta.dirname, "../..");
const git = (...args: string[]) => execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" });
const SOURCE = /\.excalidraw(\.md)?$/i;
/** A string only the drawing sources below contain, so a copy of one anywhere in the site is found. */
const MARKER = "sdfp-private-drawing-7f3a91";

describe("drawing sources in git", () => {
  // @req REQ-DIAG-006.AC1
  it("ignores part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md, by the .gitignore rule", () => {
    // `check-ignore -v` names the rule; it exits non-zero (and execFileSync throws) when the path isn't ignored.
    const rule = git(
      "check-ignore",
      "-v",
      "--no-index",
      "part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md",
    );
    expect(rule).toMatch(/^\.gitignore:\d+:\*\.excalidraw\.md\t/);
    // A plain .excalidraw file, anywhere in the vault, is ignored as well.
    expect(git("check-ignore", "-v", "--no-index", "articles/sketch.excalidraw")).toMatch(
      /^\.gitignore:\d+:\*\.excalidraw\t/,
    );
    // And none is in the repository already (a file added before the rule would stay tracked).
    expect(git("ls-files", "--", "*.excalidraw.md", "*.excalidraw")).toBe("");
  });
});

describe("drawing sources in the built site", () => {
  let dist = "";
  beforeAll(() => {
    const vault = tempFolder("sdfp-drawings-vault-");
    cpSync(join(import.meta.dirname, "fixtures/vault"), vault, { recursive: true });
    // Saved where the Excalidraw plugin saves them (CNF-008), next to the chapters and among the articles.
    const drawing = `---\nexcalidraw-plugin: parsed\n---\n# Drawing\n${MARKER}\n\`\`\`json\n{"type":"excalidraw","elements":[]}\n\`\`\`\n`;
    mkdirSync(join(vault, "part-1_foundations/excalidraw"), { recursive: true });
    writeFileSync(join(vault, "part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md"), drawing);
    writeFileSync(
      join(vault, "part-1_foundations/02_moores-law.excalidraw"),
      `{"type":"excalidraw","source":"${MARKER}"}`,
    );
    writeFileSync(join(vault, "articles/sketch.excalidraw.md"), drawing);
    dist = tempFolder("sdfp-drawings-site-");
    buildFixtureSite(dist, undefined, vault);
  }, 240_000);
  afterAll(cleanUp);

  // @req REQ-DIAG-006.AC3
  it("has no Excalidraw source among its files, by name or by content", () => {
    const files = allFiles(dist);
    expect(files.length).toBeGreaterThan(10);
    expect(files.map((f) => rel(dist, f)).filter((f) => SOURCE.test(f))).toEqual([]);
    // Nor a source's text under another name (a page made from one, or a copy in an asset).
    const leaks = files.filter((f) => readFileSync(f).includes(MARKER)).map((f) => rel(dist, f));
    expect(leaks).toEqual([]);
  });
});
