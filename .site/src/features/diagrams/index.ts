/**
 * MOD-diagrams public interface (specs/modules.md#mod-diagrams, specs/contracts/interfaces.md).
 * Importing this module also brings in the figure styles, so every page that shows figures gets them.
 * `indexOf` builds an index from given SVG texts, for tests.
 */
import "./figure.css";

export { getDiagramIndex, indexOf, type DiagramIndex } from "./index-svg.ts";
export { createFigureRenderer, diagramAssetPaths, type FigureRenderer } from "./figure.ts";
export { default as DiagramFigure } from "./DiagramFigure.astro";
export { default as DiagramViewer } from "./DiagramViewer.astro";
