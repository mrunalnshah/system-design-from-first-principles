/**
 * TOOL-07 Token build (plan/tools.md, ADR-0010): design/tokens.json (DTCG 2025.10) →
 * `.site/src/features/site/tokens.css`, the site's only source of colours, fonts, sizes and spacing.
 *
 * Output: CSS custom properties on `:root` (the light theme and every non-colour token), and the dark
 * theme's colours under `@media (prefers-color-scheme: dark)`, so the theme needs no JavaScript.
 * Naming: `theme-*.<name>` → `--color-<name>`; `font.family.serif` → `--font-serif`;
 * `font.line-height.reading` → `--line-height-reading`; `font.size.xs` → `--font-size-xs`;
 * `space.4` → `--space-4`; and so on (group path joined by `-`).
 * A `{reference}` to a token that doesn't exist is an error naming the token that uses it.
 */

/** A DTCG token or group, as JSON. */
type Node = { $type?: string; $value?: unknown; [key: string]: unknown };

export const TOKENS_CSS = "src/features/site/tokens.css";

/** Builds the CSS text. Throws `Token <path> references {<ref>}, which doesn't exist` for a broken reference. */
export function buildTokens(json: unknown): string {
  const root = json as Node;
  const light: string[] = [], dark: string[] = [], shared: string[] = [];
  for (const [path, token] of leaves(root)) {
    const [group] = path.split(".");
    if (group === "color") continue; // primitives: reached only through the theme tokens
    const value = cssValue(root, path, token);
    if (group === "theme-light") light.push(`  --color-${path.slice("theme-light.".length)}: ${value};`);
    else if (group === "theme-dark") dark.push(`    --color-${path.slice("theme-dark.".length)}: ${value};`);
    else shared.push(`  --${cssName(path)}: ${value};`);
  }
  return [
    "/* Generated from design/tokens.json by `npm --prefix .site run tools -- tokens` (TOOL-07). Don't edit by hand. */",
    ":root {",
    ...light,
    ...shared,
    "}",
    "",
    "@media (prefers-color-scheme: dark) {",
    "  :root {",
    ...dark,
    "  }",
    "}",
    "",
  ].join("\n");
}

/** The resolved CSS value of the token at `path` (e.g. `theme-dark.text` → `#e6e9ee`). */
export function tokenValue(json: unknown, path: string): string {
  const token = lookup(json as Node, path);
  if (!token) throw new Error(`No token at ${path}`);
  return cssValue(json as Node, path, token);
}

// ---------- internals ----------

/** Every token (a node with `$value`) with its dotted path, in file order. */
function leaves(node: Node, prefix = ""): [string, Node][] {
  const out: [string, Node][] = [];
  for (const [key, child] of Object.entries(node)) {
    if (key.startsWith("$") || !child || typeof child !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if ("$value" in (child as Node)) out.push([path, child as Node]);
    else out.push(...leaves(child as Node, path));
  }
  return out;
}

function lookup(root: Node, path: string): Node | undefined {
  let node: unknown = root;
  for (const key of path.split(".")) node = node && typeof node === "object" ? (node as Node)[key] : undefined;
  return node && typeof node === "object" && "$value" in (node as Node) ? (node as Node) : undefined;
}

/** `font.family.serif` → `font-serif`, `font.line-height.reading` → `line-height-reading`, otherwise the path joined by `-`. */
function cssName(path: string): string {
  return path.replace(/^font\.family\./, "font.").replace(/^font\.line-height\./, "line-height.").replace(/\./g, "-");
}

function cssValue(root: Node, path: string, token: Node, seen: string[] = []): string {
  const v = token.$value;
  if (typeof v === "string" && /^\{.+\}$/.test(v)) {
    const ref = v.slice(1, -1);
    const target = lookup(root, ref);
    if (!target) throw new Error(`Token ${path} references {${ref}}, which doesn't exist in design/tokens.json`);
    if (seen.includes(ref)) throw new Error(`Token ${path} has a circular reference through {${ref}}`);
    return cssValue(root, ref, target, [...seen, ref]);
  }
  switch (token.$type) {
    case "color": return (v as { hex: string }).hex;
    case "dimension":
    case "duration": { const d = v as { value: number; unit: string }; return `${d.value}${d.unit}`; }
    case "fontFamily": return (Array.isArray(v) ? v : [v]).map((f) => (/[\s\d]/.test(String(f)) ? `"${f}"` : String(f))).join(", ");
    default: return String(v);
  }
}
