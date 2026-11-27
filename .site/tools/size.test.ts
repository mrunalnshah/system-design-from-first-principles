import { randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildFixtureSite } from "../tests/build-site.ts";
import { cleanUp, fakeSite, tempFolder } from "./test-site.ts";
import { fontsUsed, formatSizes, kb, measureSite, parseRanges } from "./size.ts";

const BASE = "/system-design-from-first-principles/";
afterAll(cleanUp);
const site = (files: Record<string, string | Buffer>) => fakeSite(files, "sdfp-size-");

/** JavaScript about `bytes` long after gzip: random bytes as base64 squeeze back to roughly their own length. */
const heavyJs = (bytes: number) => `export const data = "${randomBytes(bytes).toString("base64")}";\n`;

describe("the build-size check", () => {
  // @req TOOL-11.AC1
  it("fails a page that references 70 KB of compressed JavaScript, naming the page and the number", () => {
    const dist = site({
      "index.html": "<!doctype html><title>Home</title><p>Hello</p>",
      "book/x/index.html": `<!doctype html><title>X</title><script type="module" src="${BASE}_astro/page.js"></script><p>Text</p>`,
      // The page's script pulls in a second module: both count.
      "_astro/page.js": `import { data } from "./chunk.js";\nconsole.log(data.length);\n${heavyJs(30_000)}`,
      "_astro/chunk.js": heavyJs(40_000),
    });
    const report = measureSite(dist, BASE);
    const page = report.pages.find((p) => p.page === "book/x/")!;
    expect(page.js).toBeGreaterThan(69_000);
    expect(page.js).toBeLessThan(72_000);
    expect(report.errors).toHaveLength(1);
    expect(report.errors[0]).toMatch(
      new RegExp(
        `^book/x/: ${kb(page.js).replace(".", "\\.")} of JavaScript \\(compressed\\), over the 60\\.0 KB budget`,
      ),
    );
    expect(report.pages.find((p) => p.page === "/")!.js).toBe(0);
  });

  it("counts inline scripts, module preloads and preloaded fonts, but not JSON data", () => {
    const dist = site({
      "index.html": `<script>${"x".repeat(10)}</script><script type="application/ld+json">{"a":1}</script><link rel="modulepreload" href="${BASE}_astro/m.js"><link rel="preload" as="font" type="font/woff2" href="${BASE}_astro/f.woff2" crossorigin>`,
      "_astro/m.js": "export const m = 1;",
      "_astro/f.woff2": "font",
    });
    const [page] = measureSite(dist, BASE).pages;
    expect(page!.files).toEqual(["_astro/m.js", "_astro/f.woff2"]);
    expect(page!.js).toBeGreaterThan(0);
    expect(page!.fonts).toBeGreaterThan(0);
  });

  it("fails a page whose HTML, CSS and fonts together pass 250 KB, and warns about a large diagram", () => {
    const dist = site({
      "index.html": `<link rel="stylesheet" href="${BASE}_astro/site.css"><p class="t">Hi</p>`,
      "_astro/site.css": `@font-face{font-family:"Big";src:url(${BASE}_astro/big.woff2) format("woff2")}.t{font-family:Big,serif}`,
      "_astro/big.woff2": randomBytes(260_000),
      "diagrams/abc-huge.svg": `<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(260_000)}</svg>`,
      // 250 KB but under the build's 250 KiB: no warning, as in the build.
      "diagrams/abc-fine.svg": `<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(252_000)}</svg>`,
    });
    const report = measureSite(dist, BASE);
    expect(report.errors).toEqual([
      expect.stringMatching(/^\/: 26\d\.\d KB of HTML, CSS and fonts \(compressed\), over the 250\.0 KB budget/),
    ]);
    expect(report.warnings).toEqual([
      expect.stringMatching(/^W-DIAGRAM-LARGE: diagrams\/abc-huge\.svg is 254 KiB, over 250 KiB/),
    ]);
  });
});

describe("which fonts a page loads", () => {
  const page = (classes: string[], text: string) => ({
    classes: new Set(classes),
    chars: new Set([...text].map((c) => c.codePointAt(0)!)),
  });
  const css = [
    ':root{--font-sans:"Inter Variable",system-ui}',
    '@font-face{font-family:"Inter Variable";font-weight:100 900;src:url(./latin.woff2) format("woff2"),url(./latin.woff) format("woff");unicode-range:U+0000-00FF,U+2000-206F}',
    '@font-face{font-family:"Inter Variable";font-weight:100 900;src:url(./greek.woff2) format("woff2");unicode-range:U+0370-03FF}',
    "@font-face{font-family:KaTeX_Main;font-weight:400;src:url(./main.woff2)}",
    "@font-face{font-family:KaTeX_Main;font-weight:700;src:url(./main-bold.woff2)}",
    "@font-face{font-family:KaTeX_Math;font-style:italic;src:url(./math-italic.woff2)}",
    ".katex{font:normal 1.21em KaTeX_Main,serif}.katex .mathnormal{font-family:KaTeX_Math;font-style:italic}.katex .mathbf{font-family:KaTeX_Main;font-weight:bold}",
  ].join("");

  it("loads the first source of each face whose range covers the page's text", () => {
    expect(fontsUsed(css, page([], "Hello — world"))).toEqual(["./latin.woff2"]);
    expect(fontsUsed(css, page([], "Hello μ"))).toEqual(["./latin.woff2", "./greek.woff2"]);
  });

  it("loads a family's faces only where a rule for the page names it, and bold or italic only where asked for", () => {
    expect(fontsUsed(css, page(["katex"], "x"))).toEqual(["./latin.woff2", "./main.woff2"]);
    expect(fontsUsed(css, page(["katex", "mathnormal"], "x"))).toEqual([
      "./latin.woff2",
      "./main.woff2",
      "./math-italic.woff2",
    ]);
    expect(fontsUsed(css, page(["katex", "mathbf"], "x"))).toEqual([
      "./latin.woff2",
      "./main.woff2",
      "./main-bold.woff2",
    ]);
  });

  it("reads stylesheets as written, not only minified ones", () => {
    const pretty =
      '@font-face {\n  font-family: "Big";\n  font-style: italic;\n  src: url(./big-italic.woff2);\n}\n.t {\n  font-family: Big;\n  font-style: italic;\n}\n';
    expect(fontsUsed(pretty, page(["t"], "x"))).toEqual(["./big-italic.woff2"]);
    expect(fontsUsed(pretty, page([], "x"))).toEqual([]);
  });

  it("loads a base font's bold and italic faces where the page has elements the browser sets that way", () => {
    const base =
      ":root{--font-serif:Serif}@font-face{font-family:Serif;src:url(./r.woff2)}@font-face{font-family:Serif;font-weight:700;src:url(./b.woff2)}@font-face{font-family:Serif;font-style:italic;src:url(./i.woff2)}";
    const tags = (t: string[]) => ({ ...page([], "x"), tags: new Set(t) });
    expect(fontsUsed(base, tags(["p"]))).toEqual(["./r.woff2"]);
    expect(fontsUsed(base, tags(["p", "strong", "em"]))).toEqual(["./r.woff2", "./b.woff2", "./i.woff2"]);
    // KaTeX's faces are named only under its classes, so a heading elsewhere doesn't bring in its bold.
    expect(fontsUsed(css, { ...page(["katex"], "x"), tags: new Set(["h2"]) })).toEqual([
      "./latin.woff2",
      "./main.woff2",
    ]);
  });

  it("reads unicode ranges with single points and wildcards", () => {
    expect(parseRanges("U+0000-00FF, U+0131, U+4??")).toEqual([
      [0, 255],
      [0x131, 0x131],
      [0x400, 0x4ff],
    ]);
  });
});

describe("the built site", () => {
  let dist: string;
  beforeAll(() => {
    // The fixture vault built under the real base path, into its own folder (one build at a time).
    dist = tempFolder("sdfp-size-site-");
    buildFixtureSite(dist);
  }, 120_000);

  // @req TOOL-11.AC2
  it("reports 0 KB of JavaScript for the homepage", () => {
    const report = measureSite(dist, BASE);
    const home = report.pages.find((p) => p.page === "/")!;
    expect(home.js).toBe(0);
    expect(formatSizes(report).find((l) => l.startsWith("/ "))).toMatch(/JS 0 KB/);
    // And a chapter with diagrams carries its scripts, within budget.
    expect(report.pages.find((p) => p.page === "book/computer-architecture/")!.js).toBeGreaterThan(0);
    expect(report.errors).toEqual([]);
  });
});
