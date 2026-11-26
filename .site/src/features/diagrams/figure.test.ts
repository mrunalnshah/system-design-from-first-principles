import { readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { url } from "../site/index.ts";
import { indexOf } from "./index-svg.ts";
import { assetPath, createFigureRenderer, diagramAssetPaths } from "./figure.ts";

const D = "part-1_foundations/diagram";
const svg = (w: number, h: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"></svg>`;
const index = indexOf({ [`${D}/wide-light.svg`]: svg(916, 400), [`${D}/wide-dark.svg`]: svg(916, 400), [`${D}/small.svg`]: svg(490, 400) });
const figure = createFigureRenderer(index);
const site = join(import.meta.dirname, "..");
const css = ["site/tokens.css", "diagrams/figure.css"].map((f) => readFileSync(join(site, f), "utf8")).join("\n");

let browser: Browser;
beforeAll(async () => void (browser = await chromium.launch()));
afterAll(async () => browser?.close());

/** Lays `html` out in a 42rem text column (the reader's) on a screen `width` px wide, and measures the figure. */
async function measure(html: string, width: number) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  await page.setContent(`<!doctype html><style>${css} body{margin:0} .column{inline-size:min(42rem, 100% - 2rem);margin-inline:auto}</style><div class="column">${html}</div>`);
  const box = await page.evaluate(() => {
    const f = document.querySelector(".diagram")!.getBoundingClientRect();
    const c = document.querySelector(".column")!.getBoundingClientRect();
    return { width: f.width, centre: f.left + f.width / 2, column: c.width, columnCentre: c.left + c.width / 2, scroll: document.documentElement.scrollWidth };
  });
  await page.close();
  return box;
}

describe("figures", () => {
  // @req REQ-DIAG-002.AC1
  it("shows a 916 px wide SVG 900 px wide on a 1280 px screen, centred, breaking out of the text column", async () => {
    const box = await measure(figure({ files: [`${D}/wide-light.svg`, `${D}/wide-dark.svg`], alias: "Wide", fromPath: "c.md", line: 1 }).html, 1280);
    expect(box.width).toBe(900);
    expect(box.width).toBeGreaterThan(box.column);
    expect(Math.abs(box.centre - box.columnCentre)).toBeLessThan(1);
  });

  // @req REQ-DIAG-002.AC2
  it("shows a 490 px wide SVG at the text column's width (the larger), as a vector image so it stays crisp", async () => {
    const { html } = figure({ files: [`${D}/small.svg`], alias: "Small", fromPath: "c.md", line: 1 });
    const box = await measure(html, 1280);
    expect(box.column).toBeGreaterThan(490);
    expect(box.width).toBe(box.column);
    expect(html).toMatch(/<img src="[^"]+\.svg"/);
  });

  it("never makes a page wider than a 320 px screen", async () => {
    const box = await measure(figure({ files: [`${D}/wide-light.svg`, `${D}/wide-dark.svg`], alias: "Wide", fromPath: "c.md", line: 1 }).html, 320);
    expect(box.scroll).toBeLessThanOrEqual(320);
  });

  it("is one <picture>: the dark image as a dark-scheme source, the light one as the sized, lazy <img>, inside a link to the SVG", () => {
    const light = index.files.get(`${D}/wide-light.svg`)!;
    const dark = index.files.get(`${D}/wide-dark.svg`)!;
    const { html, issues } = figure({ files: [light.path, dark.path], alias: 'Reads & "writes" <fast>', fromPath: "c.md", line: 1 });
    const src = url({ kind: "asset", path: assetPath(light) });
    expect(html).toBe(
      `<figure class="diagram" style="--natural: 916px"><a class="diagram-link" href="${src}"><picture>` +
        `<source media="(prefers-color-scheme: dark)" srcset="${url({ kind: "asset", path: assetPath(dark) })}" width="916" height="400">` +
        `<img src="${src}" alt="Reads &amp; &quot;writes&quot; &lt;fast&gt;" width="916" height="400" loading="lazy" decoding="async">` +
        `</picture></a><figcaption>Reads &amp; &quot;writes&quot; &lt;fast&gt;</figcaption></figure>`,
    );
    expect(issues).toEqual([]);
  });

  it("publishes only images a figure has shown, at diagrams/<hash8>-<file-name>.svg, served from their vault path", () => {
    const fresh = indexOf({ [`${D}/used-light.svg`]: svg(10, 10), [`${D}/used-dark.svg`]: svg(10, 10), [`${D}/draft-only.svg`]: svg(10, 10) });
    expect(diagramAssetPaths(fresh)).toEqual([]);
    createFigureRenderer(fresh)({ files: [`${D}/used-light.svg`], alias: "Used", fromPath: "c.md", line: 1 });
    const paths = diagramAssetPaths(fresh);
    expect(paths.map((p) => p.props.sourcePath).sort()).toEqual([`${D}/used-dark.svg`, `${D}/used-light.svg`]);
    expect(paths.map((p) => p.params.file)).toContain(`${fresh.files.get(`${D}/used-light.svg`)!.hash}-used-light.svg`);
  });

  it("gives every image a URL-safe name, so spaces, accents and brackets never break a link or srcset", () => {
    const names = ["Drawing 2026-11-26 12.00.00.excalidraw.light.svg", "café-light.svg", "a(1)-light.svg", "!!!.svg"];
    const odd = indexOf(Object.fromEntries(names.map((n) => [`${D}/${n}`, svg(10, 10)])));
    const files = [...odd.files.values()];
    expect(files.map((f) => assetPath(f).replace(/^diagrams\/[0-9a-f]{8}-/, ""))).toEqual(["drawing-2026-11-26-12.00.00.excalidraw.light.svg", "cafe-light.svg", "a-1-light.svg", "diagram.svg"]);
    for (const f of files) expect(() => createFigureRenderer(odd)({ files: [f.path], alias: "X", fromPath: "c.md", line: 1 })).not.toThrow();
  });
});
