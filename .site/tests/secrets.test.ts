import { execFileSync, spawnSync } from "node:child_process";
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "../..");

/** The gitleaks binary the hook would use: $GITLEAKS, then the local copy, else none. */
function findGitleaks(): string | undefined {
  if (process.env.GITLEAKS && existsSync(process.env.GITLEAKS)) return process.env.GITLEAKS;
  for (const name of ["gitleaks.exe", "gitleaks"]) {
    const p = join(repoRoot, ".site/.tools/gitleaks", name);
    if (existsSync(p)) return p;
  }
  return undefined;
}
const gitleaks = findGitleaks();
// CI's secret-scan job sets REQUIRE_GITLEAKS=1, so a missing binary fails there instead of skipping.
if (process.env.REQUIRE_GITLEAKS === "1" && !gitleaks) throw new Error("REQUIRE_GITLEAKS=1 but no gitleaks binary was found");

const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

/** A throwaway git repository using our real hook and gitleaks config. */
function repoWithHook(): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-secrets-"));
  tempRoots.push(root);
  const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { stdio: "pipe" });
  git("init", "-q", "-b", "main");
  git("config", "user.name", "Test");
  git("config", "user.email", "test@example.invalid");
  mkdirSync(join(root, ".site/tools/hooks"), { recursive: true });
  copyFileSync(join(repoRoot, ".site/tools/hooks/pre-commit"), join(root, ".site/tools/hooks/pre-commit"));
  chmodSync(join(root, ".site/tools/hooks/pre-commit"), 0o755);
  copyFileSync(join(repoRoot, ".gitleaks.toml"), join(root, ".gitleaks.toml"));
  git("config", "core.hooksPath", ".site/tools/hooks");
  return root;
}

function commit(root: string, file: string, content: string) {
  writeFileSync(join(root, file), content);
  execFileSync("git", ["-C", root, "add", file], { stdio: "pipe" });
  return spawnSync("git", ["-C", root, "commit", "-q", "-m", `add ${file}`], { encoding: "utf8", env: { ...process.env, GITLEAKS: gitleaks ?? "" } });
}

describe.skipIf(!gitleaks)("secret scanner (gitleaks)", () => {
  // @req TOOL-13.AC1
  it("the pre-commit hook blocks a staged AWS-style key", () => {
    const root = repoWithHook();
    // Assembled at runtime so this test file itself never contains a key-shaped string.
    const fakeKey = ["AKIA", "Z7Q4M2R8T6Y3W9K1"].join("");
    const fakeSecret = ["wJalrXUtnFEMI", "K7MDENG", "bPxRfiCYzQ2v8LmT9sX"].join("/");
    const result = commit(root, "config.env", `AWS_ACCESS_KEY_ID=${fakeKey}\nAWS_SECRET_ACCESS_KEY=${fakeSecret}\n`);
    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("gitleaks found what looks like a secret");
    expect(result.stdout + result.stderr).not.toContain(fakeKey); // findings are redacted
  });

  it("lets an ordinary commit through", () => {
    const result = commit(repoWithHook(), "notes.md", "# Chapter notes\nNothing secret here.\n");
    expect(result.status).toBe(0);
  });

  // @req TOOL-13.AC2
  it("finds nothing in this repository's whole history (what the CI job runs)", () => {
    const result = spawnSync(gitleaks!, ["git", "--redact", "--no-banner", "--log-level", "warn", "--config", join(repoRoot, ".gitleaks.toml"), repoRoot], { encoding: "utf8" });
    expect(result.status, result.stdout + result.stderr).toBe(0);
  });
});
