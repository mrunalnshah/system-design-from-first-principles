/**
 * Figures and diagram addresses (ADR-0005, REQ-DIAG-001, REQ-DIAG-002, routes.md).
 * A figure is one `<picture>`: the dark image as a `prefers-color-scheme: dark` source and the light one as the
 * `<img>`, so the browser downloads only the variant it shows and the theme needs no JavaScript. Its size comes
 * from the viewBox (space is reserved before it loads). It's a link to the SVG, so it opens without JavaScript;
 * `data-diagram` is the hook for the full-screen viewer (client/diagram-viewer.ts), which makes it a button.
 * Its intrinsic width rides along as `--natural`: figure.css lets small diagrams fill the text column and wide
 * ones break out up to 900 px, centred on the column.
 *
 * Images are served at `diagrams/<hash8>-<safe-name>.svg`: the hash changes with the image, and the name is the
 * file name made URL-safe (Excalidraw's default names have spaces). Only diagrams some figure actually shows are
 * published (`diagramAssetPaths`), so a diagram used only by a draft stays off the site.
 */
import { buildRun, url, type BuildIssue } from "../site/index.ts";
import type { DiagramFile, DiagramIndex } from "./index-svg.ts";
import { planFigure, type Embed } from "./pairs.ts";

/**
 * The shape of MOD-obsidian-markdown's `FigureRenderer`, declared here so this module needn't depend on that one
 * (specs/modules.md: MOD-diagrams is reached only through the renderer passed in `ctx.figure`).
 */
export type FigureRenderer = (embed: Embed) => { html: string; issues: BuildIssue[] };

/** The renderer MOD-obsidian-markdown calls for each diagram embed (passed in its `ctx.figure`). */
export function createFigureRenderer(index: DiagramIndex): FigureRenderer {
  return (embed) => {
    const { plan, issues } = planFigure(index, embed);
    if (!plan) return { html: "", issues };
    return { html: figureHtml(index, plan.light, plan.dark, plan.alt, plan.caption, false), issues };
  };
}

/**
 * The figure markup for one diagram (light image, optional dark one), and a record that both are shown, so the
 * diagram route publishes them. `eager` for a figure at the top of a page.
 */
export function figureHtml(index: DiagramIndex, light: DiagramFile, dark: DiagramFile | undefined, alt: string, caption: string | undefined, eager: boolean): string {
  referenced(index).add(light.path);
  if (dark) referenced(index).add(dark.path);
  const size = (f: DiagramFile) => (f.width && f.height ? ` width="${f.width}" height="${f.height}"` : "");
  const source = dark ? `<source media="(prefers-color-scheme: dark)" srcset="${assetUrl(dark)}"${size(dark)}>` : "";
  const img = `<img src="${assetUrl(light)}" alt="${escape(alt)}"${size(light)} loading="${eager ? "eager" : "lazy"}" decoding="async"${eager ? ' fetchpriority="high"' : ""}>`;
  const natural = light.width ? ` style="--natural: ${light.width}px"` : "";
  return [
    `<figure class="diagram" data-diagram${natural}>`,
    `<a class="diagram-link" href="${assetUrl(light)}"><picture>${source}${img}</picture></a>`,
    caption ? `<figcaption>${escape(caption)}</figcaption>` : "",
    "</figure>",
  ].join("");
}

/** The public path of a diagram, without the base path: `diagrams/<hash8>-<safe-name>.svg`. */
export function assetPath(file: DiagramFile): string {
  const name = file.path.split("/").pop()!.replace(/\.svg$/i, "");
  const safe =
    name
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9.-]+/g, "-")
      .replace(/-{2,}/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "") || "diagram";
  return `diagrams/${file.hash}-${safe}.svg`;
}

/**
 * The diagram route's static paths (src/pages/diagrams/[...file].ts): one per image some figure has shown, with the
 * vault path to serve it from. Figures are drawn while the vault loader renders entries, before pages are built.
 */
export function diagramAssetPaths(index: DiagramIndex): { params: { file: string }; props: { sourcePath: string } }[] {
  const out = new Map<string, string>();
  for (const path of referenced(index)) {
    const file = index.files.get(path);
    if (file) out.set(assetPath(file).slice("diagrams/".length), path);
  }
  return [...out].map(([file, sourcePath]) => ({ params: { file }, props: { sourcePath } }));
}

const assetUrl = (file: DiagramFile) => url({ kind: "asset", path: assetPath(file) });

/**
 * Diagrams shown so far, per run and vault. Kept on `globalThis` because Astro renders entries (in the content loader)
 * and builds pages in separate module graphs, like the build issues (site/issues.ts); per run, so a second build in
 * one process doesn't publish the first one's diagrams.
 */
function referenced(index: DiagramIndex): Set<string> {
  const KEY = Symbol.for("sdfp.diagrams.referenced");
  const runs = ((globalThis as Record<symbol, WeakMap<object, Map<string, Set<string>>>>)[KEY] ??= new WeakMap());
  const run = buildRun().id;
  let byRoot = runs.get(run);
  if (!byRoot) runs.set(run, (byRoot = new Map()));
  let set = byRoot.get(index.root);
  if (!set) byRoot.set(index.root, (set = new Set()));
  return set;
}

/** Text for an HTML attribute or element: the author's caption is never markup. */
function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
