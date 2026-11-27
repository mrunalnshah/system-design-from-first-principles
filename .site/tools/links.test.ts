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
    // Nothing is allowed any more (CR-0008, CR-0010): every page the plan linked to ahead of time is built, so an
    // unbuilt about/ or article is as broken as any other address.
    expect([...allowed]).toEqual([]);
    // Sorted: linkinator checks links concurrently, so the order it reports them in can change from run to run.
    expect(problems.map((p) => [p.page, p.address]).sort()).toEqual([
      ["book/x/", `${BASE}about/`],
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
  it("resolves every internal link, with no page allowed to be missing (CR-0008, CR-0010)", async () => {
    const result = await checkLinks(siteRootOf(), dist);
    expect(result.problems).toEqual([]);
    expect(result.checked).toBeGreaterThan(20);
    // The fixture builds Contents, the archive, its one article and About (T-02.03, T-03.01 to T-03.03), so no
    // address needs an allowance, and none is allowed.
    expect(NOT_YET_BUILT).toEqual([]);
    expect(result.allowed).toEqual([]);
  }, 120_000);
});
