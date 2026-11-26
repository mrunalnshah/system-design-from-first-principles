/**
 * Obsidian callouts (REQ-CNT-005): a quote whose first line is `> [!type] Optional title` becomes a labelled
 * note box. `[!type]-` starts folded and `[!type]+` starts open; both are <details>, so folding needs no
 * JavaScript. The type is kept as written (lowercase) in `data-callout`, for styling; without a title the
 * type, capitalised, is the title ("Note").
 */
import { walk } from "../tree.ts";
import type { MdNode, RenderState } from "../types.ts";

const MARKER = /^\[!([A-Za-z][\w-]*)\]([+-]?)[ \t]*/;

/** The remark plugin. Its options are the render's state (to tell `[!note]` from an escaped `\[!note]`). */
export function remarkCallouts(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (node) => {
      if (node.type === "blockquote") callout(node, state);
    });
  };
}

function callout(quote: MdNode, state: RenderState): void {
  const first = quote.children?.[0];
  const lead = first?.type === "paragraph" ? first.children?.[0] : undefined;
  const m = lead?.type === "text" ? MARKER.exec(lead.value ?? "") : null;
  if (!first || !lead || !m) return;
  const at = lead.position?.start.offset;
  if (at !== undefined && state.source[at] === "\\") return; // `> \[!note]` is written to stay a plain quote
  const type = m[1]!.toLowerCase();
  const fold = m[2];

  // The title is the rest of the first line, which may hold other inline nodes (`**bold**`) before the line ends.
  lead.value = (lead.value ?? "").slice(m[0].length);
  const inline = first.children!;
  const title: MdNode[] = [];
  let rest: MdNode[] = [];
  for (let i = 0; i < inline.length; i++) {
    const n = inline[i]!;
    const nl = n.type === "text" ? (n.value ?? "").indexOf("\n") : -1;
    if (n.type === "break") { rest = inline.slice(i + 1); break; }
    if (nl < 0) { title.push(n); continue; }
    if (nl > 0) title.push({ ...n, value: n.value!.slice(0, nl) });
    rest = [{ ...n, value: n.value!.slice(nl + 1) }, ...inline.slice(i + 1)];
    break;
  }
  // Trim only the ends: spaces between the title's parts (`**A** *B*`) are kept.
  const titleNodes = title.map((n) => ({ ...n }));
  if (titleNodes[0]?.type === "text") titleNodes[0].value = (titleNodes[0].value ?? "").replace(/^\s+/, "");
  if (titleNodes.at(-1)?.type === "text") titleNodes.at(-1)!.value = (titleNodes.at(-1)!.value ?? "").replace(/\s+$/, "");
  while (titleNodes.length && titleNodes[0]!.type === "text" && !titleNodes[0]!.value) titleNodes.shift();
  while (titleNodes.length && titleNodes.at(-1)!.type === "text" && !titleNodes.at(-1)!.value) titleNodes.pop();
  const heading: MdNode = {
    type: "calloutTitle",
    data: { hName: fold ? "summary" : "p", hProperties: { className: ["callout-title"] } },
    children: titleNodes.length ? titleNodes : [{ type: "text", value: type.charAt(0).toUpperCase() + type.slice(1) }],
  };
  const body = [...(rest.some((n) => n.type !== "text" || (n.value ?? "").trim()) ? [{ ...first, children: rest }] : []), ...quote.children!.slice(1)];

  quote.type = "callout";
  quote.data = {
    hName: fold ? "details" : "div",
    hProperties: { className: ["callout"], dataCallout: type, ...(fold ? (fold === "+" ? { open: true } : {}) : { role: "note" }) },
  };
  quote.children = [heading, ...body];
}
