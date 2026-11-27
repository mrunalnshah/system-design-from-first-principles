import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { formatVitals, readRuns } from "./lighthouse.ts";

const site = join(import.meta.dirname, "..");
const config = JSON.parse(readFileSync(join(site, "lighthouserc.json"), "utf8")) as {
  ci: {
    collect: { url: string[]; settings: Record<string, unknown> };
    assert: { assertions: Record<string, [string, Record<string, number>]> };
  };
};
const temp: string[] = [];
afterAll(() => temp.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A Lighthouse report with just the fields the summary reads. */
const lhr = (url: string, lcp: number, cls: number, score = 1) =>
  JSON.stringify({
    finalDisplayedUrl: url,
    audits: { "largest-contentful-paint": { numericValue: lcp }, "cumulative-layout-shift": { numericValue: cls } },
    categories: {
      performance: { score },
      accessibility: { score: 0.96 },
      "best-practices": { score: 1 },
      seo: { score: 1 },
    },
  });

describe("the Lighthouse budgets", () => {
  // @req TOOL-10.AC1
  it("fail the job when LCP passes 2.5 s, CLS 0.1, or any category drops below 95", () => {
    const a = config.ci.assert.assertions;
    expect(a["largest-contentful-paint"]).toEqual(["error", { maxNumericValue: 2500 }]);
    expect(a["cumulative-layout-shift"]).toEqual(["error", { maxNumericValue: 0.1 }]);
    for (const c of ["performance", "accessibility", "best-practices", "seo"])
      expect(a[`categories:${c}`]).toEqual(["error", { minScore: 0.95 }]);
    // On the mobile preset, for the homepage and Chapter 1 (the contents page joins when it's built, T-02.03).
    expect(config.ci.collect.settings.formFactor).toBe("mobile");
    expect(config.ci.collect.url.map((u) => new URL(u).pathname)).toEqual([
      "/system-design-from-first-principles/",
      "/system-design-from-first-principles/book/computer-architecture/",
    ]);
  });

  // @req TOOL-10.AC1
  it("report lists LCP and CLS for each page", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdfp-lhci-"));
    temp.push(dir);
    writeFileSync(
      join(dir, "lhr-1.json"),
      lhr("http://localhost:4335/system-design-from-first-principles/book/computer-architecture/", 2291, 0.0187, 0.98),
    );
    writeFileSync(
      join(dir, "lhr-2.json"),
      lhr("http://localhost:4335/system-design-from-first-principles/", 760, 0.0071),
    );
    writeFileSync(join(dir, "assertion-results.json"), "[]");
    const table = formatVitals(readRuns(dir));
    expect(table.slice(2)).toEqual([
      "| /system-design-from-first-principles/ | 0.76 s | 0.007 | 100 | 96 | 100 | 100 |",
      "| /system-design-from-first-principles/book/computer-architecture/ | 2.29 s | 0.019 | 98 | 96 | 100 | 100 |",
    ]);
    expect(table[0]).toMatch(/LCP \| CLS/);
  });

  // @req TOOL-10.AC1
  it("run in the build job, after the build and before the upload", () => {
    const workflow = readFileSync(join(site, "../.github/workflows/publish.yml"), "utf8");
    const build = workflow.slice(workflow.indexOf("\n  build:"), workflow.indexOf("\n  deploy:"));
    const at = (text: string) => build.indexOf(text);
    expect(at("run: npm run build")).toBeGreaterThan(0);
    for (const step of ["run: npm run tools -- size", "run: npm run tools -- links", "run: npm run test:lighthouse"]) {
      expect(at(step), step).toBeGreaterThan(at("run: npm run build"));
      expect(at(step), step).toBeLessThan(at("upload-pages-artifact"));
    }
  });
});
