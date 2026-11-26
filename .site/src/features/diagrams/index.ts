/**
 * MOD-diagrams public interface (specs/modules.md#mod-diagrams, specs/contracts/interfaces.md).
 * Importing this module also brings in the figure styles, so every page that shows figures gets them.
 */
import "./figure.css";

export { getDiagramIndex, indexOf, type DiagramFile, type DiagramIndex } from "./index-svg.ts";
export { planFigure, themeOf, type Embed, type FigurePlan } from "./pairs.ts";
export { assetPath, createFigureRenderer, diagramAssetPaths, figureHtml, type FigureRenderer } from "./figure.ts";
export { default as DiagramFigure } from "./DiagramFigure.astro";
