import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readVault } from "../src/features/content/index.ts";
import { buildFixtureSite } from "../tests/build-site.ts";
import { main } from "./cli.ts";
import { generateVault } from "./gen-vault.ts";
import { sitePath } from "./links.ts";
import { measureSite } from "./size.ts";
import { cleanUp, tempFolder } from "./test-site.ts";

/**
 * TOOL-16 (plan/tools.md) and the budgets it measures at full size: a generated vault of 60 chapters and 100
 * articles, built once through the real Astro build. The 2-minute build budget (NFR-006) is timed in CI by the build
 * job's own step, on the runner the author's pushes use; the timing here is printed, not asserted, since Vitest runs
 * other test files beside it.
 */
const site = join(import.meta.dirname, "..");
const workflow = readFileSync(join(site, "../.github/workflows/publish.yml"), "utf8").replace(/\r\n/g, "\n");
const buildJob = workflow.slice(workflow.indexOf("\n  build:"), workflow.indexOf("\n  deploy:"));

describe("gen-vault (TOOL-16)", () => {
  let vault = "";
  let dist = "";
  let printed = "";
  let seconds = 0;

  beforeAll(() => {
    vault = join(tempFolder("sdfp-vault-"), "vault");
    dist = tempFolder("sdfp-scale-");
    generateVault(vault, { chapters: 60, articles: 100 });
    const start = performance.now();
    printed = buildFixtureSite(dist, undefined, vault);
    seconds = (performance.now() - start) / 1000;
    console.log(`Built the 60-chapter, 100-article vault in ${seconds.toFixed(1)} s.`);
  }, 300_000);
  afterAll(cleanUp);

  // @req TOOL-16.AC1
  it("writes a vault of 60 chapters and 100 articles that builds without errors", () => {
    const read = readVault(vault);
    expect(read.chapters).toHaveLength(60);
    expect(read.articles).toHaveLength(100);
    expect(read.issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(printed).not.toMatch(/✖ ERROR/);
    const pages = (dir: string) =>
      readdirSync(join(dist, dir), { withFileTypes: true }).filter(
        (e) => e.isDirectory() && existsSync(join(dist, dir, e.name, "index.html")),
      );
    expect(pages("book")).toHaveLength(60);
    expect(pages("articles")).toHaveLength(100);
    // Realistic content: every chapter renders its math, footnotes, table, code, callout and both diagrams.
    const chapter = readFileSync(join(dist, "book", pages("book")[0]!.name, "index.html"), "utf8");
    for (const part of ['class="katex', "<table", "<pre", "callout", "figure", "sn-1"])
      expect(chapter, part).toContain(part);
  });

  it("is the same vault on every run, and never writes into a folder that has files", () => {
    const again = join(tempFolder("sdfp-vault-"), "vault");
    generateVault(again, { chapters: 60, articles: 100 });
    const name = readdirSync(join(vault, "part-6_scaling")).find((f) => f.endsWith(".md"))!;
    expect(readFileSync(join(again, "part-6_scaling", name), "utf8")).toBe(
      readFileSync(join(vault, "part-6_scaling", name), "utf8"),
    );
    expect(() => generateVault(vault, { chapters: 1, articles: 0 })).toThrow(/isn't empty/);
    expect(() => generateVault(join(again, "x"), { chapters: -1, articles: 0 })).toThrow(/whole number/);
  });

  it("runs as `tools gen-vault <dir> --chapters N --articles M`", () => {
    const dir = join(tempFolder("sdfp-vault-"), "vault");
    const out: string[] = [];
    const io = { log: (t: string) => void out.push(t), error: (t: string) => void out.push(t) };
    expect(main(["gen-vault", dir, "--chapters", "3", "--articles", "2"], join(site, ".."), io)).toBe(0);
    expect(readVault(dir).chapters).toHaveLength(3);
    expect(out.join("\n")).toMatch(/3 chapters in 1 part and 2 articles/);
    expect(main(["gen-vault", "--chapters", "3"], join(site, ".."), io)).toBe(1);
  });

  it("refuses a folder inside the repository, which is the author's vault (sync would commit it)", () => {
    const root = join(site, "..");
    const out: string[] = [];
    const io = { log: (t: string) => void out.push(t), error: (t: string) => void out.push(t) };
    for (const dir of [join(root, "vault-60"), join(root, "part-9_x"), join(site, "dist-60")]) {
      expect(main(["gen-vault", dir, "--chapters", "1", "--articles", "0"], root, io), dir).toBe(1);
      expect(existsSync(dir), dir).toBe(false);
    }
    expect(out.join("\n")).toMatch(/inside the repository/);
  });

  // @req NFR-002
  it("keeps every page of the full-size build within the size budgets (≤ 60 KB JS; a chapter's HTML+CSS+fonts ≤ 250 KB)", () => {
    // The other half of NFR-002, only the theme's diagram is downloaded, is the network trace in
    // tests/e2e/chapter.spec.ts (REQ-DIAG-001.AC2).
    const report = measureSite(dist, sitePath(site));
    expect(report.pages.length).toBeGreaterThanOrEqual(60 + 100);
    expect(report.errors).toEqual([]);
  });

  // @req NFR-006
  it("times the full-size build in CI and fails it past 2 minutes", () => {
    const step = /- name: Build time at full size[^\n]*\n((?:        .*\n)+)/.exec(buildJob)?.[1] ?? "";
    expect(step).toContain("npm run tools -- gen-vault");
    expect(step).toContain("--chapters 60 --articles 100");
    expect(step).toMatch(/SDFP_VAULT=/);
    expect(step).toMatch(/if \[ "\$took" -gt 120 \]; then .*exit 1; fi/);
    expect(step).toContain("npm run tools -- size --dist");
    // After Lighthouse, so a slow full-size build never hides the Lighthouse table; still before the upload.
    expect(buildJob.indexOf("Build time at full size")).toBeGreaterThan(
      buildJob.indexOf("run: npm run test:lighthouse"),
    );
    expect(buildJob.indexOf("Build time at full size")).toBeLessThan(buildJob.indexOf("upload-pages-artifact"));
  });
});
