import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { audit, baseLockfileFor, licenceAllowed } from "./audit.ts";

const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

type Entry = { version: string; license?: string; dev?: boolean; dependencies?: Record<string, string> };

/** A repository whose `.site/package-lock.json` holds `packages` (name → entry). */
function repo(packages: Record<string, Entry>, dependencies: Record<string, string> = {}): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-audit-"));
  tempRoots.push(root);
  mkdirSync(join(root, ".site"));
  writeFileSync(join(root, ".site/package-lock.json"), lockfile(packages, dependencies));
  return root;
}
function lockfile(packages: Record<string, Entry>, dependencies: Record<string, string> = {}): string {
  const p: Record<string, unknown> = { "": { name: "sdfp-website", dependencies } };
  for (const [name, e] of Object.entries(packages)) p[`node_modules/${name}`] = e;
  return JSON.stringify({ name: "sdfp-website", lockfileVersion: 3, packages: p });
}
const day = 86_400_000;
const changedAt = new Date("2026-11-26T12:00:00Z");
const none = () => [];

describe("cooldown", () => {
  const base = { "left-pad": { version: "1.3.0", license: "MIT" } };

  // @req TOOL-14.AC1
  it("fails on a lockfile entry published 2 days before the change, naming the package", () => {
    const root = repo({ "left-pad": { version: "1.4.0", license: "MIT" } });
    const r = audit({ root, baseLockfile: lockfile(base), changedAt, advisories: none, publishTime: () => new Date(changedAt.getTime() - 2 * day) });
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/left-pad@1\.4\.0.*2 days/);
  });

  it("passes a version published 8 days before the change, and ignores unchanged entries", () => {
    const seen: string[] = [];
    const root = repo({ "left-pad": { version: "1.4.0", license: "MIT" }, "is-odd": { version: "3.0.1", license: "MIT" } });
    const r = audit({ root, baseLockfile: lockfile({ ...base, "is-odd": { version: "3.0.1", license: "MIT" } }), changedAt, advisories: none,
      publishTime: (n, v) => { seen.push(`${n}@${v}`); return new Date(changedAt.getTime() - 8 * day); } });
    expect(r).toEqual({ ok: true, problems: [], notes: expect.any(Array) });
    expect(seen).toEqual(["left-pad@1.4.0"]);
  });

  it("skips the cooldown check, with a note, when there's no base lockfile", () => {
    const r = audit({ root: repo(base), advisories: none, publishTime: () => { throw new Error("must not be called"); } });
    expect(r.ok).toBe(true);
    expect(r.notes.join("\n")).toMatch(/cooldown/i);
  });
});

describe("licences", () => {
  // @req TOOL-14.AC2
  it("fails on a GPL-3.0 dependency, naming the package", () => {
    const r = audit({ root: repo({ "gpl-thing": { version: "1.0.0", license: "GPL-3.0", dev: true } }), advisories: none });
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/gpl-thing@1\.0\.0.*GPL-3\.0/);
  });

  it("allows weak-copyleft build tools, but not in code shipped to readers", () => {
    const tools = audit({ root: repo({ lightningcss: { version: "1.33.0", license: "MPL-2.0" } }), advisories: none });
    expect(tools.ok).toBe(true);
    const shipped = audit({
      root: repo({ katex: { version: "0.19.1", license: "MIT", dependencies: { "some-dep": "^1.0.0" } }, "some-dep": { version: "1.0.0", license: "MPL-2.0" } }, { katex: "0.19.1" }),
      advisories: none,
    });
    expect(shipped.ok).toBe(false);
    expect(shipped.problems.join("\n")).toMatch(/some-dep@1\.0\.0.*shipped to readers/);
  });

  it("fails on a missing licence", () => {
    expect(audit({ root: repo({ mystery: { version: "0.0.1" } }), advisories: none }).problems.join("\n")).toMatch(/mystery@0\.0\.1.*no licence/);
  });

  it("evaluates SPDX expressions", () => {
    const ok = new Set(["MIT", "Apache-2.0", "LGPL-3.0-or-later"]);
    expect(licenceAllowed("(MIT OR CC0-1.0)", ok)).toBe(true);
    expect(licenceAllowed("Apache-2.0 AND LGPL-3.0-or-later", ok)).toBe(true);
    expect(licenceAllowed("Apache-2.0 AND GPL-3.0", ok)).toBe(false);
    expect(licenceAllowed("(GPL-3.0 OR MIT) AND Apache-2.0", ok)).toBe(true);
    expect(licenceAllowed("GPL-3.0", ok)).toBe(false);
  });

  it("fails closed on anything that isn't a complete, valid expression", () => {
    const ok = new Set(["MIT", "Apache-2.0"]);
    expect(licenceAllowed("MIT or GPL-3.0-only", ok)).toBe(false); // lowercase operator
    expect(licenceAllowed("MIT GPL-3.0-only", ok)).toBe(false); // two IDs in a row
    expect(licenceAllowed("MIT WITH foo AND GPL-3.0-only", ok)).toBe(false);
    expect(licenceAllowed("(MIT", ok)).toBe(false);
    expect(licenceAllowed("MIT)", ok)).toBe(false);
    expect(licenceAllowed("", ok)).toBe(false);
    expect(licenceAllowed("Apache-2.0 WITH LLVM-exception", ok)).toBe(true);
  });
});

describe("base commit for the cooldown", () => {
  /** A git repo with a commit before the lockfile existed, then one adding it. */
  function gitRepo(): { root: string; before: string } {
    const root = repo({ "left-pad": { version: "1.3.0", license: "MIT" } });
    const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: "pipe" }).trim();
    git("init", "-q", "-b", "main");
    git("config", "user.name", "Test");
    git("config", "user.email", "test@example.invalid");
    writeFileSync(join(root, "README.md"), "x\n");
    git("add", "README.md");
    git("commit", "-q", "--no-verify", "-m", "before");
    const before = git("rev-parse", "HEAD");
    git("add", ".site/package-lock.json");
    git("commit", "-q", "--no-verify", "-m", "lockfile");
    return { root, before };
  }

  it("refuses a ref that isn't a commit, instead of skipping the check", () => {
    const { root } = gitRepo();
    expect(() => baseLockfileFor(root, "0000000000000000000000000000000000000000")).toThrow(/isn't a commit/);
    expect(() => baseLockfileFor(root, "no-such-branch")).toThrow(/isn't a commit/);
  });

  it("treats a commit from before the lockfile existed as an empty lockfile, so every entry is checked", () => {
    const { root, before } = gitRepo();
    const seen: string[] = [];
    const r = audit({ root, baseLockfile: baseLockfileFor(root, before), changedAt, advisories: none,
      publishTime: (n, v) => { seen.push(`${n}@${v}`); return new Date(changedAt.getTime() - 30 * day); } });
    expect(r.ok).toBe(true);
    expect(seen).toEqual(["left-pad@1.3.0"]);
    expect(JSON.parse(baseLockfileFor(root, "HEAD")).packages["node_modules/left-pad"].version).toBe("1.3.0");
  });
});

describe("vulnerabilities", () => {
  it("fails on high or critical advisories", () => {
    const r = audit({ root: repo({}), advisories: () => ["lodash: Prototype pollution (high)"] });
    expect(r.problems).toEqual(["Vulnerability (high or critical): lodash: Prototype pollution (high)."]);
  });

  it("treats an npm audit that can't run (e.g. no network) as a problem, not a pass", () => {
    const r = audit({ root: repo({}), advisories: () => { throw new Error("getaddrinfo ENOTFOUND registry.npmjs.org"); } });
    expect(r.ok).toBe(false);
    expect(r.problems.join("\n")).toMatch(/npm audit couldn't run.*ENOTFOUND/);
  });
});
