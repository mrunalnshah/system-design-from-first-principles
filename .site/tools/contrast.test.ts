import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { checkContrast, contrastRatio, findRawColours, formatRatio, MIN_RATIO } from "./contrast.ts";

const site = join(import.meta.dirname, "..");
const tokens = () => JSON.parse(readFileSync(join(site, "../design/tokens.json"), "utf8")) as Record<string, Record<string, { $value: unknown }>>;

/** Every .css and .astro file under .site/src, as the CLI scans them. */
function siteStyles() {
  const out: { path: string; text: string }[] = [];
  const walk = (d: string) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(css|astro)$/.test(n)) out.push({ path: relative(site, p).replace(/\\/g, "/"), text: readFileSync(p, "utf8") });
    }
  };
  walk(join(site, "src"));
  return out;
}

describe("contrast check (TOOL-08)", () => {
  // @req TOOL-08.AC1
  it("passes every pair of the shipped tokens and reports the lowest ratio", () => {
    const result = checkContrast(tokens());
    expect(result.pairs.length).toBe(2 * (4 * 3 + 1));
    expect(result.ok).toBe(true);
    expect(result.lowest.ratio).toBeGreaterThanOrEqual(MIN_RATIO);
    expect(result.lowest.ratio).toBeLessThan(6); // light accent on code-bg, about 5.5:1
  });

  // @req TOOL-08.AC2
  it("fails when light text-muted becomes #9aa3b0, naming the pair and its ratio", () => {
    const json = tokens();
    json["theme-light"]!["text-muted"]!.$value = { colorSpace: "srgb", components: [0.6, 0.64, 0.69], hex: "#9aa3b0" };
    const result = checkContrast(json);
    expect(result.ok).toBe(false);
    const bad = result.pairs.filter((p) => !p.ok);
    expect(bad.map((p) => `${p.theme} ${p.foreground} on ${p.background}`)).toContain("light text-muted on bg");
    expect(bad[0]!.ratio).toBeCloseTo(contrastRatio("#9aa3b0", "#ffffff"), 2);
  });

  it("doesn't round a ratio up to pass: 4.4987:1 fails", () => {
    const json = tokens();
    json["theme-light"]!["text-muted"]!.$value = { colorSpace: "srgb", components: [0, 0.52, 0.5], hex: "#018580" };
    const bad = checkContrast(json).pairs.find((p) => p.theme === "light" && p.foreground === "text-muted" && p.background === "bg")!;
    expect(bad.ok).toBe(false);
    expect(bad.ratio).toBeLessThan(MIN_RATIO);
    expect(formatRatio(bad.ratio)).toBe("4.49");
  });

  it("refuses a colour that isn't #rrggbb", () => {
    expect(() => contrastRatio("#fff", "#000000")).toThrow(/#rrggbb/);
  });

  it("computes WCAG ratios", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#1b2230", "#ffffff")).toBeCloseTo(15.93, 1);
  });

  // @req TOOL-08.AC3
  it("fails on a raw colour in component CSS or an .astro style block, naming the file and line", () => {
    const found = findRawColours([
      { path: "src/features/home/card.css", text: ".card {\n  border: 1px solid #1d5fbf;\n}\n" },
      { path: "src/features/home/Hero.astro", text: "---\n---\n<a href='#main'>x</a>\n<style>\n  h1 { color: rgb(0 0 0); }\n</style>\n" },
      { path: "src/features/site/tokens.css", text: ":root { --color-text: #1b2230; }\n" },
      { path: "src/features/site/ok.css", text: ".x { color: var(--color-text); }\n#main { outline: none; }\n" },
    ]);
    expect(found).toEqual([
      { path: "src/features/home/card.css", line: 2, value: "#1d5fbf" },
      { path: "src/features/home/Hero.astro", line: 5, value: "rgb(" },
    ]);
  });

  it("finds colours in multi-line declarations, inline style= and named colours; ignores comments, strings and url()", () => {
    const found = findRawColours([
      { path: "src/a.css", text: ".a {\n  box-shadow:\n    0 0 2px\n    #123456;\n}\n" },
      { path: "src/b.css", text: "/* was color: #ff0000; */\n.b { background: url(#fff); content: \"#abc\"; }\n" },
      { path: "src/c.css", text: ".c { border-color: Red; outline: 1px solid var(--color-red); }\n" },
      { path: "src/D.astro", text: "---\n---\n<p style=\"color: #00ff00\">x</p>\n" },
      { path: "src/f.css", text: ".f {\n  border-color:\n    var(--a, bored)\n    red;\n}\n" },
      { path: "src/e.css", text: "a:hover { color: var(--color-accent); }\n:is(#abc) { margin: 0; }\n" },
    ]);
    expect(found).toEqual([
      { path: "src/a.css", line: 4, value: "#123456" },
      { path: "src/c.css", line: 1, value: "Red" },
      { path: "src/D.astro", line: 3, value: "#00ff00" },
      { path: "src/f.css", line: 4, value: "red" },
    ]);
  });

  it("finds no raw colours in the real site", () => {
    expect(findRawColours(siteStyles())).toEqual([]);
  });
});
