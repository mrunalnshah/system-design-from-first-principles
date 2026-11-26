/**
 * Footnotes as margin notes (REQ-READ-006, ADR-0006): each footnote is rendered twice, so margin notes work on wide
 * screens and the notes still read well without JavaScript.
 * - At its reference: a marker `<a class="ref" href="#fn-n" data-note="n">` and, right after it, the note itself as
 *   `<span class="sidenote" role="note" id="sn-n">`, which the reader's CSS floats into the margin at 1100 px and
 *   wider (T-01.18), and which a script turns into a tap-to-open note on phones.
 * - At the end of the entry: the usual numbered list, `<section class="endnotes">`, each note with a link back to
 *   its reference. Without JavaScript on a phone, the marker links here (REQ-READ-006.AC3).
 * Notes are numbered in order of first reference; a note referenced twice gets one margin note and two markers.
 * Notes no text refers to are dropped, as GitHub's footnotes are.
 */
import { walk } from "../tree.ts";
import type { MdNode } from "../types.ts";

/** The remark plugin; it runs after the plain text is collected and before math is typeset. */
export function remarkFootnotes() {
  return (tree: MdNode) => {
    const definitions = new Map<string, MdNode>();
    walk(tree, (node, parent) => {
      if (node.type === "footnoteDefinition" && typeof node.identifier === "string" && !definitions.has(node.identifier)) definitions.set(node.identifier, node);
      if (parent && node.type === "footnoteDefinition") parent.children = parent.children!.filter((c) => c !== node);
    });
    // A second pass catches definitions nested where the first walk had already moved on.
    walk(tree, (node) => {
      if (node.children?.some((c) => c.type === "footnoteDefinition")) node.children = node.children.filter((c) => c.type !== "footnoteDefinition");
    });

    const numbers = new Map<string, number>();
    walk(tree, (parent) => {
      if (!parent.children?.some((c) => c.type === "footnoteReference")) return;
      parent.children = parent.children.flatMap((node) => {
        const id = node.type === "footnoteReference" ? String(node.identifier) : undefined;
        const definition = id ? definitions.get(id) : undefined;
        if (!id || !definition) return [node];
        const first = !numbers.has(id);
        if (first) numbers.set(id, numbers.size + 1);
        const n = numbers.get(id)!;
        const marker: MdNode = {
          type: "noteRef",
          data: { hName: "a", hProperties: { className: ["ref"], href: `#fn-${n}`, dataNote: String(n), ...(first ? { id: `ref-${n}` } : {}), ariaLabel: `Note ${n}` } },
          children: [{ type: "noteNumber", data: { hName: "sup" }, children: [{ type: "text", value: String(n) }] }],
        };
        if (!first) return [marker];
        const sidenote: MdNode = {
          type: "sidenote",
          data: { hName: "span", hProperties: { className: ["sidenote"], role: "note", id: `sn-${n}` } },
          children: [{ type: "noteNumber", data: { hName: "span", hProperties: { className: ["sidenote-number"] } }, children: [{ type: "text", value: String(n) }] }, { type: "text", value: " " }, ...inline(definition)],
        };
        return [marker, sidenote];
      });
    });

    if (!numbers.size) return;
    const items: MdNode[] = [...numbers].map(([id, n]) => {
      const content = structuredClone(definitions.get(id)!.children ?? []);
      const back: MdNode = { type: "noteBack", data: { hName: "a", hProperties: { className: ["back"], href: `#ref-${n}`, ariaLabel: `Back to the text of note ${n}` } }, children: [{ type: "text", value: "↩" }] };
      const last = content.at(-1);
      if (last?.type === "paragraph") last.children = [...(last.children ?? []), { type: "text", value: " " }, back];
      else content.push({ type: "paragraph", children: [back] });
      // A note of several paragraphs keeps them apart in the list.
      return { type: "listItem", spread: content.length > 1, data: { hProperties: { id: `fn-${n}` } }, children: content };
    });
    tree.children = [
      ...(tree.children ?? []),
      {
        type: "endnotes",
        data: { hName: "section", hProperties: { className: ["endnotes"], ariaLabelledBy: "endnotes-title" } },
        children: [
          { type: "endnotesTitle", data: { hName: "h2", hProperties: { id: "endnotes-title", className: ["endnotes-title"] } }, children: [{ type: "text", value: "Notes" }] },
          { type: "list", ordered: true, spread: false, children: items },
        ],
      },
    ];
  };
}

/** A note's content as inline nodes, for the margin (a <span> can't hold paragraphs or lists): paragraphs joined by breaks. */
function inline(definition: MdNode): MdNode[] {
  const out: MdNode[] = [];
  for (const block of structuredClone(definition.children ?? [])) {
    if (out.length) out.push({ type: "break" });
    if (block.type === "paragraph") out.push(...(block.children ?? []));
    else out.push({ type: "text", value: textOf(block) });
  }
  return out;
}

function textOf(node: MdNode): string {
  if (typeof node.value === "string") return node.value;
  return (node.children ?? []).map(textOf).join(" ");
}
