/**
 * MOD-obsidian-markdown public interface (specs/modules.md#mod-obsidian-markdown, specs/contracts/interfaces.md).
 * General-purpose: renders any Obsidian note; book rules arrive only through the `RenderContext`.
 */
export { renderObsidian } from "./render.ts";
export { createFileResolver } from "./resolve.ts";
export { slugify } from "./slugify.ts";
export type { BuildIssue, FigureRenderer, RenderContext, RenderResult, Section } from "./types.ts";
