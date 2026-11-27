import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFixtureSite } from "../tests/build-site.ts";
import { cleanUp, fakeSite, tempFolder } from "./test-site.ts";
import { baseProblems, brokenLinks, checkLinks, NOT_YET_BUILT, siteRootOf, sitePath } from "./links.ts";

const BASE = "/system-design-from-first-principles/";
afterAll(cleanUp);
const site = (files: Record<string, string>) => fakeSite(files, "sdfp-links-");

describe("the link check", () => {
  it("reads the base path from the site's config", () => {
    expect(sitePath(siteRootOf())).toBe(BASE);
  });

  // @req TOOL-12.AC1
  it('fails a built page with href="/book/x/" (no base path), naming the page', () => {
    const dist = site({
      "index.html": `<a href="${BASE}book/x/">fine</a>`,
      "book/y/index.html":
        '<a href="/book/x/">no base</a><img src="/diagrams/a.svg" alt=""><a href="//example.com/">other site</a><a href="#top">top</a><code>url(/x.png)</code><span style="background: url(/bg.png)"></span>',
    });
    const problems = baseProblems(dist, BASE);
    expect(problems.map((p) => [p.page, p.address])).toEqual([
      ["book/y/", "/book/x/"],
      ["book/y/", "/diagrams/a.svg"],
      ["book/y/", "/bg.png"],
    ]);
    expect(problems[0]!.problem).toMatch(/base path/);
  });

  it("finds an internal link that doesn't resolve, naming the page it's on", async () => {
    const dist = site({
      "index.html": `<!doctype html><title>Home</title><a href="${BASE}book/x/">x</a>`,
      "book/x/index.html": `<!doctype html><title>X</title><a href="${BASE}book/gone/">gone</a><a href="${BASE}">home</a><a href="${BASE}about/">about</a><a href="${BASE}about/x/">not allowed</a><a href="${BASE}articles/why-caches/">article</a><a href="${BASE}articles/x/y/">not an article</a>`,
    });
    const { problems, allowed } = await brokenLinks(siteRootOf(), dist, BASE);
    // about/ is allowed while it isn't built (CR-0008); an article's own address isn't any more, since T-03.01 builds
    // article pages (CR-0010), and about/x/ and articles/x/y/ were never addresses the plan links to ahead of time.
    expect([...allowed].sort()).toEqual(["about/"]);
    // Sorted: linkinator checks links concurrently, so the order it reports them in can change from run to run.
    expect(problems.map((p) => [p.page, p.address]).sort()).toEqual([
      ["book/x/", `${BASE}about/x/`],
      ["book/x/", `${BASE}articles/why-caches/`],
      ["book/x/", `${BASE}articles/x/y/`],
      ["book/x/", `${BASE}book/gone/`],
    ]);
    for (const p of problems) expect(p.problem).toMatch(/doesn't resolve \(404\)/);
  }, 60_000);
});

describe("the built site", () => {
  let dist: string;
  beforeAll(() => {
    dist = tempFolder("sdfp-links-site-");
    buildFixtureSite(dist);
  }, 120_000);

  // @req TOOL-12.AC2
  it("resolves every internal link, with only the not-yet-built pages allowed (CR-0008, CR-0010)", async () => {
    const result = await checkLinks(siteRootOf(), dist);
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThan(20);
    // Exactly Articles and About may be missing, and only while they are (Contents is built since T-02.03).
    expect(NOT_YET_BUILT).toEqual(["articles/", "about/"]);
    // The fixture builds neither yet, so both are allowed; its one published article is built (T-03.01), so the
    // homepage's link to it needs no allowance (CR-0010); nothing else.
    expect([...result.allowed].sort()).toEqual(["about/", "articles/"]);
  }, 120_000);
});
