import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildTokens, TOKENS_CSS, tokenValue } from "./tokens.ts";

const site = join(import.meta.dirname, "..");
const tokens = () => JSON.parse(readFileSync(join(site, "../design/tokens.json"), "utf8")) as Record<string, unknown>;

describe("token build (TOOL-07)", () => {
  // @req TOOL-07.AC1
  it("defines --color-text as #1b2230 on :root and #e6e9ee in the dark theme", () => {
    const css = buildTokens(tokens());
    const root = /^:root \{([\s\S]*?)^\}/m.exec(css)![1]!;
    const dark = /@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\}\s*\}/.exec(css)![1]!;
    expect(root).toMatch(/--color-text: #1b2230;/);
    expect(dark).toMatch(/--color-text: #e6e9ee;/);
    expect(dark).not.toMatch(/--font-|--space-/); // only colours change between themes
  });

  // @req TOOL-07.AC2
  it("fails on a broken reference, naming the token that uses it", () => {
    const json = tokens();
    (json["theme-light"] as Record<string, { $value: string }>).text!.$value = "{color.missing}";
    expect(() => buildTokens(json)).toThrow(/theme-light\.text.*\{color\.missing\}/);
  });

  it("turns DTCG values into CSS: dimensions, font stacks, weights, durations", () => {
    const css = buildTokens(tokens());
    expect(css).toMatch(/--font-serif: "Source Serif 4", Georgia, Cambria, "Times New Roman", serif;/);
    expect(css).toMatch(/--space-4: 1rem;/);
    expect(css).toMatch(/--size-figure-max: 900px;/);
    expect(css).toMatch(/--font-weight-bold: 700;/);
    expect(css).toMatch(/--duration-max: 200ms;/);
    expect(tokenValue(tokens(), "theme-dark.diagram-bg")).toBe("#121212");
  });

  it("matches the committed tokens.css (run `tools -- tokens` after editing design/tokens.json)", () => {
    expect(readFileSync(join(site, TOKENS_CSS), "utf8").replace(/\r\n/g, "\n")).toBe(buildTokens(tokens()));
  });
});
