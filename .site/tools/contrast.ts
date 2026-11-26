/**
 * TOOL-08 Contrast check (plan/tools.md, NFR-003, CR-0003):
 * 1. every text/background token pair meets WCAG 2.2 AA (4.5:1) in both themes;
 * 2. no component CSS, `.astro` style block or inline `style=` writes a raw colour (`#hex`, `rgb()`, a named colour …):
 *    colours come only from tokens.css, so contrast checked here is contrast on the page.
 */
import { TOKENS_CSS, tokenValue } from "./tokens.ts";

/** One checked pair: `text on bg` in a theme, with its exact (unrounded) contrast ratio. */
export type Pair = { theme: "light" | "dark"; foreground: string; background: string; ratio: number; ok: boolean };

/** WCAG 2.2 AA for normal-size text. */
export const MIN_RATIO = 4.5;

/** Checks every pair in both themes (text, text-muted, accent, accent-hover on bg, surface, code-bg; on-accent on accent). */
export function checkContrast(json: unknown): { pairs: Pair[]; ok: boolean; lowest: Pair } {
  const pairs: Pair[] = [];
  for (const theme of ["light", "dark"] as const) {
    const colour = (name: string) => tokenValue(json, `theme-${theme}.${name}`);
    const check = (foreground: string, background: string) => {
      const raw = contrastRatio(colour(foreground), colour(background));
      // WCAG doesn't round: 4.496:1 fails. Show it with `formatRatio`, which never rounds up.
      pairs.push({ theme, foreground, background, ratio: raw, ok: raw >= MIN_RATIO });
    };
    for (const fg of ["text", "text-muted", "accent", "accent-hover"]) for (const bg of ["bg", "surface", "code-bg"]) check(fg, bg);
    check("on-accent", "accent");
  }
  const lowest = pairs.reduce((a, b) => (b.ratio < a.ratio ? b : a));
  return { pairs, ok: pairs.every((p) => p.ok), lowest };
}

/** A ratio for messages, cut (never rounded up) to two decimals: 4.4987 → "4.49". */
export function formatRatio(ratio: number): string {
  return (Math.floor(ratio * 100) / 100).toFixed(2);
}

/** WCAG relative-luminance contrast ratio of two `#rrggbb` colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(hex)) throw new Error(`Contrast needs #rrggbb colours; got ${hex}`);
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * bl!;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

/** A colour literal: `#hex` or a colour function. */
const COLOUR_LITERAL = /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix)\(/;

/** CSS named colours (the keywords `transparent`, `currentcolor` and `inherit` are fine). */
const NAMED = new Set(
  ("aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen").split(" "),
);

/** Properties whose values can hold a colour, for the named-colour check. */
const COLOUR_PROPERTY = /color|background|border|outline|fill|stroke|shadow|column-rule|text-decoration|text-emphasis/i;

/** A declaration: `property: value` ending at `;`, `}` or the end of the region, so selectors (which end at `{`) never match. */
const DECLARATION = /([-\w]+)\s*:([^;{}]*)(?=[;}]|$)/g;

/**
 * Raw colour values in CSS (whole file) or `.astro` files (inside <style> blocks and inline `style="…"`),
 * outside the generated tokens.css. Comments, strings and `url(…)` are ignored; declarations may span lines.
 */
export function findRawColours(files: { path: string; text: string }[]): { path: string; line: number; value: string }[] {
  const found: { path: string; line: number; value: string }[] = [];
  for (const f of files) {
    if (f.path === TOKENS_CSS) continue;
    for (const region of styleRegions(f.path, f.text)) {
      for (const d of region.text.matchAll(DECLARATION)) {
        const value = d[2]!;
        const literal = COLOUR_LITERAL.exec(value);
        const named = COLOUR_PROPERTY.test(d[1]!) ? value.split(/[\s,()/]+/).find((w) => NAMED.has(w.toLowerCase())) : undefined;
        const hit = literal ? { at: literal.index, text: literal[0] } : named ? { at: Math.max(0, value.search(new RegExp(String.raw`(?<![-\w])${named}(?![-\w])`))), text: named } : undefined;
        if (!hit) continue;
        const offset = region.start + d.index! + d[0].length - value.length + hit.at;
        found.push({ path: f.path, line: f.text.slice(0, offset).split("\n").length, value: hit.text });
      }
    }
  }
  return found;
}

/** The parts of a file that are CSS, with their offsets, after blanking comments, strings and url(…) to keep offsets. */
function styleRegions(path: string, text: string): { start: number; text: string }[] {
  const blank = (s: string) => s.replace(/[^\n]/g, " ");
  const clean = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, blank).replace(/url\([^)]*\)/gi, blank).replace(/"[^"\n]*"|'[^'\n]*'/g, blank);
  if (path.endsWith(".css")) return [{ start: 0, text: clean(text) }];
  if (!path.endsWith(".astro")) return [];
  const regions: { start: number; text: string }[] = [];
  for (const m of text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)) regions.push({ start: m.index! + m[0].indexOf(">") + 1, text: clean(m[1]!) });
  for (const m of text.matchAll(/\bstyle\s*=\s*(["'])([\s\S]*?)\1/g)) regions.push({ start: m.index! + m[0].indexOf(m[1]!) + 1, text: clean(m[2]!) });
  return regions;
}
