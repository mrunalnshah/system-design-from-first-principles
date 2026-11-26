/**
 * Obsidian callouts (REQ-CNT-005): a quote whose first line is `> [!type] Optional title` becomes a labelled
 * note box. `[!type]-` starts folded and `[!type]+` starts open; both are <details>, so folding needs no
 * JavaScript. The type is kept as written (lowercase) in `data-callout`, for styling; without a title the
 * type, capitalised, is the title ("Note").
 */
import { walk, type MdNode } from "../types.ts";

const MARKER = /^\[!([A-Za-z][\w-]*)\]([+-]?)[ \t]*/;

/** The remark plugin. */
export function remarkCallouts() {
  return (tree: MdNode) => {
    walk(tree, (node) => {
      if (node.type === "blockquote") callout(node);
    });
  };
}

function callout(quote: MdNode): void {
  const first = quote.children?.[0];
  const lead = first?.type === "paragraph" ? first.children?.[0] : undefined;
  const m = lead?.type === "text" ? MARKER.exec(lead.value ?? "") : null;
  if (!first || !lead || !m) return;
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
  const titleNodes = title.filter((n) => n.type !== "text" || (n.value ?? "").trim());
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
