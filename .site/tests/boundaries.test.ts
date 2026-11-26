import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const site = join(import.meta.dirname, "..");
const config = join(site, ".dependency-cruiser.cjs");
const depcruise = join(site, "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs");
const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** Runs our boundary rules over `paths` in `cwd`; returns the exit code and the report. */
function cruise(cwd: string, paths: string[]) {
  const r = spawnSync(process.execPath, [depcruise, ...paths, "--config", config, "--output-type", "err"], { cwd, encoding: "utf8" });
  return { status: r.status, report: r.stdout + r.stderr };
}

/** A throwaway project with the given files (path → content). */
function project(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-bounds-"));
  tempRoots.push(root);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}

describe("boundary rules (TOOL-06)", () => {
  // @req TOOL-06.AC1
  it("fails when a module imports another module's internals, naming both files", () => {
    const root = project({
      "src/features/content/scan.ts": "export const scan = 1;\n",
      "src/features/content/index.ts": "export { scan } from './scan.js';\n",
      "src/features/home/select.ts": "import { scan } from '../content/scan.js';\nexport const x = scan;\n",
    });
    const { status, report } = cruise(root, ["src"]);
    expect(status).not.toBe(0);
    expect(report).toContain("only-through-index");
    expect(report).toMatch(/src\/features\/home\/select\.ts.*src\/features\/content\/scan\.ts/s);
  });

  it("allows the same import through the module's index.ts", () => {
    const root = project({
      "src/features/content/scan.ts": "export const scan = 1;\n",
      "src/features/content/index.ts": "export { scan } from './scan.js';\n",
      "src/features/home/select.ts": "import { scan } from '../content/index.js';\nexport const x = scan;\n",
    });
    expect(cruise(root, ["src"]).status).toBe(0);
  });

  // @req TOOL-06.AC2
  it("fails when markdown depends on the vault module (the wrong direction)", () => {
    const root = project({
      "src/features/content/index.ts": "export const book = 1;\n",
      "src/features/markdown/render.ts": "import { book } from '../content/index.js';\nexport const r = book;\n",
    });
    const { status, report } = cruise(root, ["src"]);
    expect(status).not.toBe(0);
    expect(report).toContain("direction-markdown");
  });

  it("fails on a dependency cycle", () => {
    const root = project({
      "src/features/site/a.ts": "import { b } from './b.js';\nexport const a = b;\n",
      "src/features/site/b.ts": "import { a } from './a.js';\nexport const b = a;\n",
    });
    expect(cruise(root, ["src"]).report).toContain("no-circular");
  });

  it("passes on the real code", () => {
    const { status, report } = cruise(site, ["src", "tools"]);
    expect(status, report).toBe(0);
  });
});
