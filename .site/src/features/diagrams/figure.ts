/**
 * Figures and diagram addresses (ADR-0005, REQ-DIAG-001, REQ-DIAG-002, routes.md).
 * A figure is one `<picture>`: the dark image as a `prefers-color-scheme: dark` source and the light one as the
 * `<img>`, so the browser downloads only the variant it shows and the theme needs no JavaScript. Its size comes
 * from the viewBox (space is reserved before it loads). It's a link to the SVG, so it opens without JavaScript.
 * Its intrinsic width rides along as `--natural`: figure.css lets small diagrams fill the text column and wide
 * ones break out up to 900 px, centred on the column.
 * Images are served at `diagrams/<hash8>-<file-name>.svg`, so a changed image gets a new address.
 */
import { url, type BuildIssue } from "../site/index.ts";
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
    return { html: figureHtml(plan.light, plan.dark, plan.alt, plan.caption, false), issues };
  };
}

/** The figure markup for one diagram (light image, optional dark one); `eager` for a figure at the top of a page. */
export function figureHtml(light: DiagramFile, dark: DiagramFile | undefined, alt: string, caption: string | undefined, eager: boolean): string {
  const size = light.width && light.height ? ` width="${light.width}" height="${light.height}"` : "";
  const source = dark ? `<source media="(prefers-color-scheme: dark)" srcset="${assetUrl(dark)}"${dark.width && dark.height ? ` width="${dark.width}" height="${dark.height}"` : ""}>` : "";
  const img = `<img src="${assetUrl(light)}" alt="${escape(alt)}"${size} loading="${eager ? "eager" : "lazy"}" decoding="async">`;
  const natural = light.width ? ` style="--natural: ${light.width}px"` : "";
  return [
    `<figure class="diagram"${natural}>`,
    `<a class="diagram-link" href="${assetUrl(light)}"><picture>${source}${img}</picture></a>`,
    caption ? `<figcaption>${escape(caption)}</figcaption>` : "",
    "</figure>",
  ].join("");
}

/** The public path of a diagram, without the base path: `diagrams/<hash8>-<file-name>.svg`. */
export function assetPath(file: DiagramFile): string {
  return `diagrams/${file.hash}-${file.path.split("/").pop()}`;
}

/** Everything the diagram route serves, for its `getStaticPaths`: one entry per distinct image. */
export function diagramAssetPaths(index: DiagramIndex): { params: { file: string }; props: { svg: string } }[] {
  const seen = new Map<string, string>();
  for (const file of index.files.values()) seen.set(assetPath(file).slice("diagrams/".length), file.svg);
  return [...seen].map(([file, svg]) => ({ params: { file }, props: { svg } }));
}

const assetUrl = (file: DiagramFile) => url({ kind: "asset", path: assetPath(file) });

/** Text for an HTML attribute or element: the author's caption is never markup. */
function escape(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
