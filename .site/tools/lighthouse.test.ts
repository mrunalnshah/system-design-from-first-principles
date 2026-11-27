import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { formatVitals, medianRuns, readRuns } from "./lighthouse.ts";

const site = join(import.meta.dirname, "..");
const config = JSON.parse(readFileSync(join(site, "lighthouserc.json"), "utf8")) as {
  ci: {
    collect: { numberOfRuns: number; url: string[]; settings: Record<string, unknown> };
    assert: { assertions: Record<string, [string, Record<string, number>]> };
  };
};
const temp: string[] = [];
afterAll(() => temp.forEach((d) => rmSync(d, { recursive: true, force: true })));

/** A Lighthouse report with just the fields the summary reads. */
const lhr = (
  url: string,
  lcp: number,
  cls: number,
  score = 1,
  more: { fcp?: number; tti?: number; tbt?: number; shifts?: unknown[] } = {},
) =>
  JSON.stringify({
    finalDisplayedUrl: url,
    audits: {
      "largest-contentful-paint": { numericValue: lcp },
      "cumulative-layout-shift": { numericValue: cls },
      "first-contentful-paint": { numericValue: more.fcp ?? 900 },
      "speed-index": { numericValue: 1000 },
      "total-blocking-time": { numericValue: more.tbt ?? 0 },
      interactive: { numericValue: more.tti ?? 2000 },
      "layout-shifts": { details: { items: more.shifts ?? [] } },
    },
    categories: {
      performance: { score },
      accessibility: { score: 0.96 },
      "best-practices": { score: 1 },
      seo: { score: 1 },
    },
  });

describe("the Lighthouse budgets", () => {
  // @req TOOL-10.AC1
  // @req NFR-001
  it("fail the job when LCP passes 2.5 s, CLS 0.1, or any category drops below 95", () => {
    const a = config.ci.assert.assertions;
    // Each on the page's median run of three, so one slow moment on a shared runner can't fail it (R-14).
    expect(config.ci.collect.numberOfRuns).toBe(3);
    expect(a["largest-contentful-paint"]).toEqual([
      "error",
      { maxNumericValue: 2500, aggregationMethod: "median-run" },
    ]);
    expect(a["cumulative-layout-shift"]).toEqual(["error", { maxNumericValue: 0.1, aggregationMethod: "median-run" }]);
    for (const c of ["performance", "accessibility", "best-practices", "seo"])
      expect(a[`categories:${c}`]).toEqual(["error", { minScore: 0.95, aggregationMethod: "median-run" }]);
    // On the mobile preset, for the homepage, the contents page and Chapter 1 (TOOL-10).
    expect(config.ci.collect.settings.formFactor).toBe("mobile");
    expect(config.ci.collect.url.map((u) => new URL(u).pathname)).toEqual([
      "/system-design-from-first-principles/",
      "/system-design-from-first-principles/book/",
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
    const table = formatVitals(medianRuns(readRuns(dir)));
    expect(table.slice(2)).toEqual([
      "| /system-design-from-first-principles/ | 0.76 s | 0.007 | 0.90 s | 1.00 s | 0 ms | 100 | 96 | 100 | 100 | 100 |",
      "| /system-design-from-first-principles/book/computer-architecture/ | 2.29 s | 0.019 | 0.90 s | 1.00 s | 0 ms | 98 | 96 | 100 | 100 | 98 |",
    ]);
    expect(table[0]).toMatch(/LCP \| CLS \| FCP \| Speed Index \| TBT/);
  });

  // @req TOOL-10.AC1
  it("report shows each page's median run, every run's score, and the elements that shifted", () => {
    const dir = mkdtempSync(join(tmpdir(), "sdfp-lhci-"));
    temp.push(dir);
    const home = "http://localhost:4335/system-design-from-first-principles/";
    const shift = {
      score: 0.0371,
      subItems: {
        items: [
          {
            cause: "Media element lacking an explicit size",
            extra: { type: "node", selector: "figure.diagram > a > picture > img" },
          },
          {
            cause: "Web font loaded",
            extra: { type: "url", value: "http://localhost:4335/x/_astro/inter-latin.woff2" },
          },
        ],
      },
    };
    // A slow run (70), a median one (91, with a shift) and a fast one (100), as on R-14's runner: the table shows the median.
    writeFileSync(join(dir, "lhr-1.json"), lhr(home, 2120, 0, 0.7, { fcp: 1900, tti: 5200, tbt: 900 }));
    writeFileSync(
      join(dir, "lhr-2.json"),
      lhr(home, 1820, 0.0371, 0.91, { fcp: 1200, tti: 3000, tbt: 120, shifts: [shift] }),
    );
    writeFileSync(join(dir, "lhr-3.json"), lhr(home, 1700, 0, 1, { fcp: 900, tti: 1900, tbt: 0 }));
    const pages = medianRuns(readRuns(dir));
    expect(pages).toHaveLength(1);
    expect(pages[0]).toMatchObject({ lcp: 1820, tbt: 120 });
    expect(pages[0]!.runs).toEqual([70, 91, 100]); // in run (file) order
    const table = formatVitals(pages);
    expect(table[2]).toMatch(
      /^\| \/system-design-from-first-principles\/ \| 1\.82 s \| 0\.037 \| 1\.20 s \| 1\.00 s \| 120 ms \| 91 \|/,
    );
    expect(table.slice(3)).toEqual([
      "",
      "Layout shifts in the median run:",
      "- /system-design-from-first-principles/: an unnamed element (0.037; Media element lacking an explicit size: figure.diagram > a > picture > img; Web font loaded: inter-latin.woff2)",
    ]);
  });

  it("picks the median run as LHCI's median-run does: closest to both medians, the first run on a tie", () => {
    const home = "http://localhost:4335/system-design-from-first-principles/";
    const runs = (...pairs: [number, number][]) =>
      pairs.map(([fcp, tti], i) => ({
        url: home,
        lcp: i,
        cls: 0,
        fcp,
        si: 0,
        tbt: 0,
        tti,
        shifts: [],
        scores: { performance: i },
      }));
    // The median FCP (1000) is run 0's and the median TTI (3000) run 1's; run 1 is nearer both, so FCP alone isn't the rule.
    expect(medianRuns(runs([1000, 2000], [1200, 3000], [800, 4000]))[0]!.lcp).toBe(1);
    // Two runs equally near the medians: the first of them, as LHCI's stable sort keeps it.
    expect(medianRuns(runs([1000, 2000], [900, 3000], [1100, 3000]))[0]!.lcp).toBe(1);
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
