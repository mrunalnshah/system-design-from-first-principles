import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { renderObsidian } from "../src/features/markdown/index.ts";
import { contrastRatio } from "../tools/contrast.ts";
import { tokenValue } from "../tools/tokens.ts";
import { context } from "../src/features/markdown/test-context.ts";

/** T-01.23 (CR-0006): the reader's styles for the renderer's math and code. */
const site = join(import.meta.dirname, "..");
const css = readFileSync(join(site, "src/features/reader/content.css"), "utf8");
const tokensJson = JSON.parse(readFileSync(join(site, "../design/tokens.json"), "utf8"));
const codeBg = { light: tokenValue(tokensJson, "theme-light.code-bg"), dark: tokenValue(tokensJson, "theme-dark.code-bg") };

/** Code in the languages a system design book uses most. */
const SAMPLES: Record<string, string> = {
  python: "import os\n# read a file\ndef read(path: str) -> bytes:\n    \"\"\"Doc.\"\"\"\n    return open(path, 'rb').read()  # %d\nx = [1, 2.5, None, True]\n@cache\nclass A(B): pass",
  ts: "// comment\nexport async function f<T>(a: T, b = 2): Promise<T> { const re = /a+/g; return `x${a}` as T; }\nenum E { A = 1 }",
  bash: "#!/bin/bash\nset -e\nfor f in *.md; do echo \"$f\" | grep -c foo; done # ok",
  json: '{"a": 1, "b": [true, null, "s"]}',
  sql: "SELECT a, COUNT(*) FROM t WHERE b = 'x' AND c > 10 GROUP BY a; -- note",
  yaml: "key: value\nlist:\n  - 1\n  - 'two' # c",
  go: 'package main\nimport "fmt"\nfunc main() { var x int = 3; fmt.Println(x, nil) }',
  java: 'public class A { private static final int X = 1; @Override public String toString() { return "a"; } }',
  rust: 'fn main() { let mut v: Vec<u8> = vec![1]; println!("{:?}", v); }',
  diff: "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+new",
};
const markdown = Object.entries(SAMPLES).map(([lang, code]) => `\`\`\`${lang}\n${code}\n\`\`\``).join("\n\n");
const hex = (c: string) => (c.length === 4 ? `#${[...c.slice(1)].map((x) => x + x).join("")}` : c.slice(0, 7)).toLowerCase();

let browser: Browser;
beforeAll(async () => void (browser = await chromium.launch()));
afterAll(async () => browser?.close());

describe("styles for math and code", () => {
  // @req REQ-READ-008.AC5
  it("brings KaTeX's stylesheet and fonts in from the katex package, so they're the site's own files", () => {
    const imported = /@import\s+"([^"]+)"/.exec(css)?.[1];
    expect(imported).toBe("katex/dist/katex.min.css");
    const katexCss = createRequire(import.meta.url).resolve(imported!);
    const urls = [...readFileSync(katexCss, "utf8").matchAll(/url\(([^)]+)\)/g)].map((m) => m[1]!.replace(/["']/g, ""));
    expect(urls.length).toBeGreaterThan(10);
    for (const u of urls) {
      expect(u, "a KaTeX font from another host").not.toMatch(/^(https?:)?\/\//);
      expect(existsSync(join(dirname(katexCss), u)), `KaTeX font ${u} is in the package, for the build to bundle`).toBe(true);
    }
    expect(css).not.toMatch(/https?:\/\//);
  });

  // @req REQ-CNT-005.AC6
  it("keeps every highlighted token at 4.5:1 or more on the code background, in light and in dark", async () => {
    const { html } = await renderObsidian(markdown, context());
    const failing: string[] = [];
    for (const theme of ["light", "dark"] as const) {
      const colours = new Set([...html.matchAll(new RegExp(`--shiki-${theme}:(#[0-9a-fA-F]{3,8})`, "g"))].map((m) => hex(m[1]!)));
      expect(colours.size).toBeGreaterThan(5);
      for (const c of colours) if (contrastRatio(c, codeBg[theme]) < 4.5) failing.push(`${theme} ${c} on ${codeBg[theme]}: ${contrastRatio(c, codeBg[theme]).toFixed(2)}:1`);
    }
    expect(failing).toEqual([]);
  });

  it("keeps every foreground colour of both themes at 4.5:1, apart from three that never colour code text", async () => {
    const { bundledThemes } = await import("shiki");
    // Scopes whose colour is a background-like mark, not text: Shiki drops their backgrounds, and code never shows them.
    const EXCLUDED: Record<string, string[]> = { light: ["#ffffff", "#e7ecf0"], dark: ["#161b22"] };
    const failing: string[] = [];
    for (const [theme, name] of [["light", "github-light-high-contrast"], ["dark", "github-dark-default"]] as const) {
      const t = (await bundledThemes[name]()).default as { fg?: string; colors?: Record<string, string>; tokenColors?: { scope?: string | string[]; settings?: { foreground?: string } }[] };
      const colours = [t.colors?.["editor.foreground"] ?? t.fg ?? "", ...(t.tokenColors ?? []).map((r) => r.settings?.foreground ?? "")].filter(Boolean);
      for (const c of new Set(colours)) {
        expect(/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{6}ff)$/i.test(c), `${name} ${c} is translucent: its contrast can't be checked`).toBe(true);
        if (contrastRatio(hex(c), codeBg[theme]) < 4.5 && !EXCLUDED[theme]!.includes(hex(c))) failing.push(`${name} ${c}`);
      }
    }
    expect(failing).toEqual([]);
  });

  it("paints code in the theme's colours on the code background, as the browser shows it", async () => {
    const { html } = await renderObsidian("```python\ndef read(path):\n    return 1\n```", context());
    const tokens = readFileSync(join(site, "src/features/site/tokens.css"), "utf8");
    for (const colorScheme of ["light", "dark"] as const) {
      const page = await browser.newPage({ colorScheme });
      // KaTeX's @import is left out here: setContent has no bundler to resolve it.
      await page.setContent(`<style>${tokens}${css.replace(/@import[^;]+;/, "")}</style>${html}`);
      const seen = await page.evaluate(() => {
        const pre = document.querySelector("pre.astro-code")!;
        const keyword = [...pre.querySelectorAll("span")].find((s) => s.textContent === "def")!;
        const style = (el: Element) => getComputedStyle(el);
        return { bg: style(pre).backgroundColor, keyword: style(keyword).color, want: keyword.getAttribute("style") };
      });
      const want = new RegExp(`--shiki-${colorScheme}:(#[0-9A-Fa-f]{6})`).exec(seen.want ?? "")![1]!;
      const rgb = (h: string) => `rgb(${[1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
      expect(seen.keyword).toBe(rgb(want));
      expect(seen.bg).toBe(rgb(codeBg[colorScheme]));
      await page.close();
    }
  });
});
