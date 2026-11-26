/**
 * TOOL-08 Contrast check (plan/tools.md, NFR-003, CR-0003):
 * 1. every text/background token pair meets WCAG 2.2 AA (4.5:1) in both themes;
 * 2. no component CSS or `.astro` style block writes a raw colour (`#hex`, `rgb()`, `hsl()` …):
 *    colours come only from tokens.css, so contrast checked here is contrast on the page.
 */
import { tokenValue } from "./tokens.ts";

/** One checked pair: `text on bg` in a theme, with its contrast ratio. */
export type Pair = { theme: "light" | "dark"; foreground: string; background: string; ratio: number; ok: boolean };

/** WCAG 2.2 AA for normal-size text. */
export const MIN_RATIO = 4.5;

/** Checks every pair in both themes (text, text-muted, accent, accent-hover on bg, surface, code-bg; on-accent on accent). */
export function checkContrast(json: unknown): { pairs: Pair[]; ok: boolean; lowest: Pair } {
  const pairs: Pair[] = [];
  for (const theme of ["light", "dark"] as const) {
    const colour = (name: string) => tokenValue(json, `theme-${theme}.${name}`);
    const check = (foreground: string, background: string) => {
      const ratio = Math.round(contrastRatio(colour(foreground), colour(background)) * 100) / 100;
      pairs.push({ theme, foreground, background, ratio, ok: ratio >= MIN_RATIO });
    };
    for (const fg of ["text", "text-muted", "accent", "accent-hover"]) for (const bg of ["bg", "surface", "code-bg"]) check(fg, bg);
    check("on-accent", "accent");
  }
  const lowest = pairs.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  return { pairs, ok: pairs.every((p) => p.ok), lowest };
}

/** WCAG relative-luminance contrast ratio of two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** A colour literal in a declaration value (after `:`), so `#main` selectors and URL fragments don't count. */
const RAW_COLOUR = /:[^;{}]*?(#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\()/;

/** Raw colour values in CSS (whole file) or `.astro` files (inside <style> blocks), outside tokens.css. */
export function findRawColours(files: { path: string; text: string }[]): { path: string; line: number; value: string }[] {
  const found: { path: string; line: number; value: string }[] = [];
  for (const f of files) {
    if (f.path.endsWith("/tokens.css")) continue;
    let inStyle = f.path.endsWith(".css");
    f.text.split(/\r?\n/).forEach((line, i) => {
      if (f.path.endsWith(".astro") && /<style[\s>]/.test(line)) inStyle = true;
      if (inStyle) {
        const m = RAW_COLOUR.exec(line);
        if (m) found.push({ path: f.path, line: i + 1, value: m[1]! });
      }
      if (f.path.endsWith(".astro") && /<\/style>/.test(line)) inStyle = false;
    });
  }
  return found;
}
