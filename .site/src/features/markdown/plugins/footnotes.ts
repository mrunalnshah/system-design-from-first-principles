/**
 * Footnotes as margin notes (REQ-READ-006, ADR-0006): each footnote is rendered twice, so margin notes work on wide
 * screens and the notes still read well without JavaScript.
 * - At its reference: a marker `<a class="ref" href="#fn-n" data-note="n">` and, right after it, the note itself as
 *   `<span class="sidenote" role="note" id="sn-n">`, which the reader's CSS floats into the margin at 1100 px and
 *   wider (T-01.18), and which a script turns into a tap-to-open note on phones.
 * - At the end of the entry: the usual numbered list, `<section class="endnotes">`, each note with a link back to
 *   its reference. Without JavaScript on a phone, the marker links here (REQ-READ-006.AC3).
 * Notes are numbered in order of first reference; a note referenced twice gets one margin note and two markers.
 * A reference inside a heading, or inside another note, is a marker only. Notes nothing refers to are dropped, as
 * GitHub's footnotes are.
 */
import { walk } from "../tree.ts";
import type { MdNode } from "../types.ts";

/** The remark plugin; it runs after the plain text is collected and before math is typeset. It needs no state. */
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
    const number = (id: string) => {
      if (!numbers.has(id)) numbers.set(id, numbers.size + 1);
      return numbers.get(id)!;
    };
    /** Notes with a marker in the text itself; only they get a back link. */
    const inText = new Set<number>();
    const marker = (n: number, withId: boolean): MdNode => ({
      type: "noteRef",
      data: { hName: "a", hProperties: { className: ["ref"], href: `#fn-${n}`, dataNote: String(n), ...(withId ? { id: `ref-${n}` } : {}), ariaLabel: `Note ${n}` } },
      children: [{ type: "noteNumber", data: { hName: "sup" }, children: [{ type: "text", value: String(n) }] }],
    });
    /** A copy of a note's content in which references to other notes are plain markers (never nested notes). */
    const content = (nodes: MdNode[]): MdNode[] => {
      const copy = structuredClone(nodes);
      const root: MdNode = { type: "root", children: copy };
      walk(root, (parent) => {
        if (!parent.children?.some((c) => c.type === "footnoteReference")) return;
        parent.children = parent.children.flatMap((c) => {
          const id = c.type === "footnoteReference" ? String(c.identifier) : undefined;
          return id && definitions.has(id) ? [marker(number(id), false)] : [c];
        });
      });
      return root.children!;
    };
    // A note referenced in a heading gets only its marker there: the note itself would join the heading's name.
    const inHeading = new Set<MdNode>();
    walk(tree, (node) => {
      if (node.type === "heading") walk(node, (d) => void (d.type === "footnoteReference" && inHeading.add(d)));
    });

    walk(tree, (parent) => {
      if (!parent.children?.some((c) => c.type === "footnoteReference")) return;
      parent.children = parent.children.flatMap((node) => {
        const id = node.type === "footnoteReference" ? String(node.identifier) : undefined;
        const definition = id ? definitions.get(id) : undefined;
        if (!id || !definition) return [node];
        const first = !numbers.has(id) || !inText.has(numbers.get(id)!);
        const n = number(id);
        if (!first) return [marker(n, false)];
        inText.add(n);
        if (inHeading.has(node)) return [marker(n, true)];
        const sidenote: MdNode = {
          type: "sidenote",
          data: { hName: "span", hProperties: { className: ["sidenote"], role: "note", id: `sn-${n}` } },
          children: [{ type: "noteNumber", data: { hName: "span", hProperties: { className: ["sidenote-number"] } }, children: [{ type: "text", value: String(n) }] }, { type: "text", value: " " }, ...inline(content(definition.children ?? []))],
        };
        return [marker(n, true), sidenote];
      });
    });

    if (!numbers.size) return;
    // Notes reached only from other notes get numbers while this list is built; a Map walks entries added meanwhile.
    const items: MdNode[] = [];
    for (const [id, n] of numbers) {
      const body = content(definitions.get(id)!.children ?? []);
      if (inText.has(n)) {
        // U+FE0E keeps the arrow as text, not an emoji, on phones.
        const back: MdNode = { type: "noteBack", data: { hName: "a", hProperties: { className: ["back"], href: `#ref-${n}`, ariaLabel: `Back to the text of note ${n}` } }, children: [{ type: "text", value: "\u21A9\uFE0E" }] };
        const last = body.at(-1);
        if (last?.type === "paragraph") last.children = [...(last.children ?? []), { type: "text", value: " " }, back];
        else body.push({ type: "paragraph", children: [back] });
      }
      // A note of several paragraphs keeps them apart in the list.
      items.push({ type: "listItem", spread: body.length > 1, data: { hProperties: { id: `fn-${n}` } }, children: body });
    }
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
function inline(blocks: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (const block of blocks) {
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
