/**
 * Light/dark pairs and what each figure shows (REQ-DIAG-001, REQ-DIAG-004, ADR-0012). Both naming styles pair:
 * `01-light.svg` / `01-dark.svg` and the Excalidraw plugin's `02_moores-law.excalidraw.light.svg` / `.dark.svg`.
 * A partner counts only in the same folder. `planFigure` decides a figure's images, alt text and caption, and
 * raises the diagram warnings: W-DIAGRAM-NO-CAPTION, W-DIAGRAM-UNPAIRED and W-DIAGRAM-LARGE.
 */
import type { BuildIssue } from "../site/index.ts";
import type { DiagramFile, DiagramIndex } from "./index-svg.ts";

/** Diagrams larger than this load slowly on phones (contracts/build-messages.md). */
export const LARGE_BYTES = 250 * 1024;

/** The theme a file name says, and the path of the partner it would have; undefined for a name with no theme. */
export function themeOf(path: string): { theme: "light" | "dark"; partner: string } | undefined {
  const m = /^(.*?)([-.])(light|dark)(\.svg)$/i.exec(path);
  if (!m) return undefined;
  const theme = m[3]!.toLowerCase() as "light" | "dark";
  const other = theme === "light" ? "dark" : "light";
  // Keep the author's case style for the partner's theme word (`-Light` → `-Dark`).
  const word = m[3] === m[3]!.toUpperCase() ? other.toUpperCase() : m[3]![0] === m[3]![0]!.toUpperCase() ? other[0]!.toUpperCase() + other.slice(1) : other;
  return { theme, partner: `${m[1]}${m[2]}${word}${m[4]}` };
}

/** What one figure shows. `dark` is absent when the diagram has one variant for both themes. */
export type FigurePlan = { light: DiagramFile; dark?: DiagramFile; alt: string; caption?: string };

/** The embed as MOD-obsidian-markdown hands it over: 1 or 2 resolved SVG paths, the alias, where it was written. */
export type Embed = { files: string[]; alias?: string; fromPath: string; line: number };

/**
 * Plans the figure for an embed. Returns undefined, with E-EMBED-MISSING, when an image isn't in the index (an SVG
 * outside the part folders and `articles/` can't be published).
 */
export function planFigure(index: DiagramIndex, embed: Embed): { plan?: FigurePlan; issues: BuildIssue[] } {
  const issues: BuildIssue[] = [];
  const at = { file: embed.fromPath, line: embed.line };
  const found = embed.files.map((p) => index.files.get(p));
  const missing = embed.files.filter((_, i) => !found[i]);
  if (missing.length) {
    for (const p of missing) {
      issues.push({ severity: "error", code: "E-EMBED-MISSING", ...at, message: `The diagram "${p}" isn't in a part folder or articles/, so it can't be published.`, fix: "Check the spelling, or add the file." });
    }
    return { issues };
  }

  let light: DiagramFile | undefined;
  let dark: DiagramFile | undefined;
  for (const file of found as DiagramFile[]) {
    const t = themeOf(file.path);
    if (t?.theme === "dark") dark = file;
    else light ??= file;
  }
  // One variant embedded: its partner next to it still makes the figure follow the theme (REQ-DIAG-001.AC3).
  const only = light ?? dark!;
  const named = themeOf(only.path);
  if (embed.files.length === 1 && named) {
    const partner = index.files.get(named.partner);
    if (partner) {
      if (named.theme === "light") dark = partner;
      else light = partner;
    } else {
      issues.push({
        severity: "warning",
        code: "W-DIAGRAM-UNPAIRED",
        ...at,
        message: `"${only.path}" has no ${named.theme === "light" ? "dark" : "light"} partner (${named.partner}), so it shows the same in both themes.`,
        fix: "Turn on 'Export both light and dark' in the Excalidraw plugin and save the drawing again.",
      });
    }
  }
  if (!light) [light, dark] = [dark!, undefined]; // only a dark image: it serves both themes

  const caption = embed.alias?.trim() || undefined;
  const words = light.words.length ? light.words : (dark?.words ?? []);
  const alt = caption ?? (words.length ? `Diagram: ${clip(words.join(", "), 200)}` : "Diagram");
  if (!caption) {
    issues.push({
      severity: "warning",
      code: "W-DIAGRAM-NO-CAPTION",
      ...at,
      message: `This diagram has no caption, so its alt text comes from the words in it ("${alt}").`,
      fix: "Add a caption: ![[file.svg|Caption]]. For a drawing, ![[name.excalidraw|Caption]].",
    });
  }
  const largest = [light, dark].filter((f): f is DiagramFile => !!f).sort((a, b) => b.bytes - a.bytes)[0]!;
  if (largest.bytes > LARGE_BYTES) {
    issues.push({
      severity: "warning",
      code: "W-DIAGRAM-LARGE",
      ...at,
      message: `"${largest.path}" is ${Math.round(largest.bytes / 1024)} KB, over the 250 KB that loads quickly on a phone.`,
      fix: "Large diagrams load slowly on phones; consider simplifying.",
    });
  }
  const plan: FigurePlan = { light, alt };
  if (dark && dark !== light) plan.dark = dark;
  if (caption) plan.caption = caption;
  return { plan, issues };
}

/** At most `max` characters, cut at a word boundary with "…". */
function clip(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).replace(/[\s,]+\S*$/, "")}…`;
}
