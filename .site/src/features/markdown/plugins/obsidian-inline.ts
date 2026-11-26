/**
 * Obsidian's inline syntax (REQ-CNT-005): `%%comments%%` (removed from the tree first, so they never reach the
 * HTML), `[[note]]` / `[[note|label]]` / `[[note#Heading]]` links, `==highlights==`, and block ids (` ^id`, hidden
 * as in Obsidian). Unresolved links become plain text with W-LINK-UNRESOLVED; blocks drawn by Obsidian plugins
 * (mermaid, dataview, …) show as code with W-SYNTAX-UNKNOWN.
 */
import { slugify } from "../slugify.ts";
import { locate, walk } from "../tree.ts";
import type { MdNode, RenderState } from "../types.ts";

/** Code-block languages that only an Obsidian plugin draws; the website shows their text. */
export const PLUGIN_BLOCKS: readonly string[] = ["mermaid", "dataview", "dataviewjs", "query", "tasks"];

/** Nodes whose text is never Markdown, so a `%%` inside them is just text: code, math and raw HTML. */
const OPAQUE = new Set(["code", "inlineCode", "math", "inlineMath", "html"]);

/**
 * The comments plugin; it runs first. Walks the tree in reading order: a `%%` in ordinary text opens a comment and
 * the next one closes it, and everything between (text, formatting, whole paragraphs, lists, code) is removed.
 * Code and math are separate nodes, so a `%%` inside them never counts. A comment that's never closed hides the
 * rest of the document, as in Obsidian, with W-COMMENT-UNCLOSED so the author notices.
 */
export function remarkComments(state: RenderState) {
  return (tree: MdNode) => {
    let open: { line: number; column: number } | undefined;
    const prune = (parent: MdNode) => {
      const kept: MdNode[] = [];
      for (const node of parent.children ?? []) {
        if (OPAQUE.has(node.type)) {
          if (!open) kept.push(node);
          continue;
        }
        if (node.type === "text") {
          const value = node.value ?? "";
          let out = "";
          let i = 0;
          while (i <= value.length) {
            const at = value.indexOf("%%", i);
            if (open) {
              if (at < 0) break;
              open = undefined;
              i = at + 2;
              if (out.endsWith(" ")) while (value[i] === " ") i++; // "a %%note%% b" reads "a b"
              continue;
            }
            if (at < 0) { out += value.slice(i); break; }
            out += value.slice(i, at);
            open = locate(state, node, at, "%%");
            i = at + 2;
          }
          if (out === value) kept.push(node);
          else {
            const trimmed = out.replace(/[ \t]+(?=\n|$)/g, ""); // spaces left before a line end would become a hard break
            if (trimmed) kept.push({ ...node, value: trimmed });
          }
          continue;
        }
        if (open && !node.children) continue;
        const had = node.children?.length ?? 0;
        if (node.children) prune(node);
        // A container a comment left empty (a paragraph that was all comment) goes too.
        if (had && !node.children!.length) continue;
        kept.push(node);
      }
      parent.children = kept;
    };
    prune(tree);
    if (open) {
      state.issues.push({
        severity: "warning",
        code: "W-COMMENT-UNCLOSED",
        file: state.ctx.filePath,
        line: open.line,
        column: open.column,
        message: "This %% comment is never closed, so everything after it is hidden on the website (as in Obsidian).",
        fix: "Close it with %% where the private note ends.",
      });
    }
  };
}

/** The remark plugin for links, highlights, block ids and plugin blocks. Its options are the render's state. */
export function remarkObsidianInline(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (node) => {
      if (node.type === "code" && node.lang && PLUGIN_BLOCKS.includes(node.lang.toLowerCase())) {
        state.issues.push(syntaxUnknown(state, node.position?.start ?? { line: 1, column: 1 }, `A "${node.lang}" block is drawn by an Obsidian plugin; the website shows the block's text instead.`));
      }
      if (!node.children || node.type === "link" || node.type === "linkReference") return;
      node.children = node.children.flatMap((child) => (child.type === "text" ? wikilinks(child, state) : [child]));
      highlights(node);
      if (node.type === "paragraph") dropBlockIds(node);
    });
    // A `[[` left over is a link split by formatting (`[[note|*Ch*]]`): it shows as written, so say so.
    walk(tree, (node, parent) => {
      if (node.type !== "text" || parent?.type === "link") return;
      const at = (node.value ?? "").indexOf("[[");
      if (at >= 0) state.issues.push(syntaxUnknown(state, locate(state, node, at, "[["), "This [[link]] has formatting inside its brackets, so it can't become a link; write the label without formatting."));
    });
  };
}

function syntaxUnknown(state: RenderState, at: { line: number; column: number }, message: string) {
  return { severity: "warning" as const, code: "W-SYNTAX-UNKNOWN", file: state.ctx.filePath, line: at.line, column: at.column, message, fix: "This shows as plain text on the website." };
}

const WIKILINK = /(?<!!)\[\[([^[\]|#]*)(#[^[\]|]*)?(?:\|([^[\]]*))?\]\]/g;

/** Splits a text node at `[[…]]` links: resolved ones become links, others plain text with a warning. */
function wikilinks(node: MdNode, state: RenderState): MdNode[] {
  const value = node.value ?? "";
  if (!value.includes("[[")) return [node];
  const out: MdNode[] = [];
  let last = 0;
  for (const m of value.matchAll(WIKILINK)) {
    const [whole, rawTarget, rawPath, alias] = m;
    const target = rawTarget!.trim();
    // `[[note#Part#Heading]]` links to the last heading in the path, as in Obsidian.
    const heading = rawPath?.split("#").filter(Boolean).at(-1)?.trim();
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    last = m.index + whole.length;
    // `#^block` links go to the note: blocks have no anchors on the website.
    const fragment = heading && !heading.startsWith("^") ? `#${slugify(heading)}` : "";
    const note = target ? state.ctx.resolveNote(target) : fragment ? { href: "", title: heading! } : undefined;
    const written = heading ? `${target} > ${heading}` : target;
    const label = alias?.trim() || (note ? (target && fragment ? `${note.title} > ${heading}` : note.title) : written);
    if (note) {
      out.push({ type: "link", url: `${note.href}${fragment}`, children: [{ type: "text", value: label }] });
    } else {
      const at = locate(state, node, m.index, whole);
      state.issues.push({
        severity: "warning",
        code: "W-LINK-UNRESOLVED",
        file: state.ctx.filePath,
        line: at.line,
        column: at.column,
        message: `[[${target || rawPath}]] doesn't match a published chapter, article or page, so it shows as plain text.`,
        fix: "Check the name, or publish that note.",
      });
      out.push({ type: "text", value: label });
    }
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

/** Wraps `==text==` in <mark>, also when the highlighted text holds other inline nodes (`==a **b** c==`). */
function highlights(parent: MdNode): void {
  const kids = parent.children!;
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i]!;
    if (node.type !== "text") continue;
    const value = node.value ?? "";
    const open = findMarker(value, 0);
    if (open < 0) continue;
    const sameClose = findMarker(value, open + 2);
    if (sameClose > open + 2) {
      const marked = mark([{ type: "text", value: value.slice(open + 2, sameClose) }]);
      kids.splice(i, 1, ...text(value.slice(0, open)), marked, ...text(value.slice(sameClose + 2)));
      i += value.slice(0, open) ? 1 : 0; // continue after the <mark>
      continue;
    }
    for (let j = i + 1; j < kids.length; j++) {
      const end = kids[j]!;
      const close = end.type === "text" ? findMarker(end.value ?? "", 0) : -1;
      if (close < 0) continue;
      const inner = [...text(value.slice(open + 2)), ...kids.slice(i + 1, j), ...text((end.value ?? "").slice(0, close))];
      kids.splice(i, j - i + 1, ...text(value.slice(0, open)), mark(inner), ...text((end.value ?? "").slice(close + 2)));
      break;
    }
  }
}

/** The next `==` from `from` that isn't part of `===` (so `a === b` stays as written); -1 if none. */
function findMarker(value: string, from: number): number {
  for (let i = value.indexOf("==", from); i >= 0; i = value.indexOf("==", i + 1)) {
    if (value[i - 1] !== "=" && value[i + 2] !== "=") return i;
  }
  return -1;
}

const text = (value: string): MdNode[] => (value ? [{ type: "text", value }] : []);
const mark = (children: MdNode[]): MdNode => ({ type: "highlight", data: { hName: "mark" }, children });

/** Removes Obsidian block ids (` ^abc123` at the end of a line), which Obsidian hides too. */
function dropBlockIds(paragraph: MdNode): void {
  for (const child of paragraph.children ?? []) {
    if (child.type === "text" && child.value) child.value = child.value.replace(/[ \t]+\^[A-Za-z0-9-]+(?=\n|$)/g, "");
  }
}

