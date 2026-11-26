/**
 * Headings (REQ-READ-004, REQ-BOOK-002.AC2): every heading moves down one level, so the page title is the only
 * h1 (`#` → h2, `##` → h3, … up to h6). With `ctx.headingNumbers = { prefix }`, `#` headings are numbered
 * `<prefix>.<n>` and `##` headings `<prefix>.<n>.<m>`; the number is part of the heading's text, so screen readers
 * hear "1.1 Components". Every heading gets a unique id by GitHub's rule. Only the document's own top-level
 * headings are its sections (numbered, and listed in `RenderResult.sections`); a heading inside a callout, quote or
 * list is still demoted and anchored, but it's part of that block, not a section of the chapter (CR-0006).
 */
import { createSlugger } from "../slugify.ts";
import type { MdNode, RenderState } from "../types.ts";

/** The remark plugin. Its options are the render's state. */
export function remarkHeadings(state: RenderState) {
  return (tree: MdNode) => {
    const slug = createSlugger();
    const prefix = state.ctx.headingNumbers ? state.ctx.headingNumbers.prefix : undefined;
    let major = 0;
    let minor = 0;
    const all: { node: MdNode; topLevel: boolean }[] = [];
    const gather = (parent: MdNode) => {
      for (const child of parent.children ?? []) {
        if (child.type === "heading") all.push({ node: child, topLevel: parent === tree });
        else gather(child);
      }
    };
    gather(tree);
    for (const { node, topLevel } of all) {
      if (!node.depth) continue;
      const level = node.depth; // as written in the vault: 1 for `#`
      const text = plainText(node).trim();
      const anchor = slug(text);
      node.depth = Math.min(6, level + 1);
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, id: anchor } };
      if (!topLevel) continue;

      let number: string | undefined;
      if (level === 1) {
        major++;
        minor = 0;
        if (prefix) number = `${prefix}.${major}`;
      } else if (level === 2) {
        minor++;
        // A `##` before any `#` has no section to belong to, so it stays unnumbered.
        if (prefix && major) number = `${prefix}.${major}.${minor}`;
      }
      if (number) {
        node.children = [
          { type: "sectionNumber", data: { hName: "span", hProperties: { className: ["section-number"] } }, children: [{ type: "text", value: number }] },
          { type: "text", value: " " },
          ...(node.children ?? []),
        ];
      }
      if (level <= 2) state.sections.push({ depth: (level + 1) as 2 | 3, text, anchor, ...(number ? { number } : {}) });
    }
  };
}

/** A node's text as a reader sees it (math as written). */
export function plainText(node: MdNode): string {
  if (node.type === "text" || node.type === "inlineCode" || node.type === "inlineMath") return node.value ?? "";
  if (node.type === "break") return " ";
  return (node.children ?? []).map(plainText).join("");
}
