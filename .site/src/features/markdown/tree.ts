/**
 * Small helpers over the Markdown tree (mdast) that every plugin shares: walking it, and turning a place in a
 * node back into a line and column of the ORIGINAL source, as the interface promises for every issue.
 */
import type { MdNode, RenderState } from "./types.ts";

/** Calls `visit` on every node, parents before children; `visit` may replace a node's `children` before they're walked. */
export function walk(node: MdNode, visit: (node: MdNode, parent: MdNode | undefined) => void, parent?: MdNode): void {
  visit(node, parent);
  for (const child of node.children ?? []) walk(child, visit, node);
}

/**
 * The 1-based line and column of `needle`, which appears `offset` characters into the text node `node`.
 * The parsed text can differ from the source (entities, escapes, the `> ` of quote lines), so the needle is
 * looked up in the source between the node's own start and end; only if it isn't there does the count
 * fall back to the node's text.
 */
export function locate(state: RenderState, node: MdNode, offset: number, needle: string): { line: number; column: number } {
  const start = node.position?.start.offset;
  const end = node.position?.end.offset;
  if (start !== undefined && end !== undefined) {
    // The needle's n-th occurrence in the node's text is its n-th occurrence in the node's source.
    const value = node.value ?? "";
    let nth = 0;
    for (let i = value.indexOf(needle); i >= 0 && i < offset; i = value.indexOf(needle, i + 1)) nth++;
    let at = state.source.indexOf(needle, start);
    for (let k = 0; k < nth && at >= 0; k++) at = state.source.indexOf(needle, at + 1);
    if (at >= 0 && at < end) return lineColumn(state.source, at);
  }
  const from = node.position?.start ?? { line: 1, column: 1 };
  const lines = (node.value ?? "").slice(0, offset).split("\n");
  return lines.length === 1 ? { line: from.line, column: from.column + offset } : { line: from.line + lines.length - 1, column: lines.at(-1)!.length + 1 };
}

/** The 1-based line and column of an absolute offset in `source`. */
export function lineColumn(source: string, offset: number): { line: number; column: number } {
  const before = source.slice(0, offset).split("\n");
  return { line: before.length, column: before.at(-1)!.length + 1 };
}
