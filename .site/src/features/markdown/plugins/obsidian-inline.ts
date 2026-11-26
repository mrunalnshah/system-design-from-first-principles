/**
 * Obsidian's inline syntax (REQ-CNT-005): `%%comments%%` (removed before parsing, so they never reach the HTML),
 * `[[note]]` / `[[note|label]]` / `[[note#Heading]]` links, `==highlights==`, and block ids (` ^id`, hidden as in
 * Obsidian). Unresolved links become plain text with W-LINK-UNRESOLVED; blocks drawn by Obsidian plugins
 * (mermaid, dataview, …) show as code with W-SYNTAX-UNKNOWN.
 */
import { slugify } from "../slugify.ts";
import { positionIn, walk, type MdNode, type RenderState } from "../types.ts";

/** Code-block languages that only an Obsidian plugin draws; the website shows their text. */
export const PLUGIN_BLOCKS: readonly string[] = ["mermaid", "dataview", "dataviewjs", "query", "tasks"];

/**
 * Removes `%%…%%` comments (inline or spanning lines) outside code, keeping every newline so line numbers don't
 * move. An unclosed `%%` hides the rest of the file, as in Obsidian's reading view.
 */
export function stripComments(source: string): string {
  const out: string[] = [];
  let fence: string | undefined; // the open code fence (``` or ~~~ run), if any
  let inComment = false;
  for (const line of source.split("\n")) {
    if (!inComment) {
      const f = /^ {0,3}(`{3,}|~{3,})/.exec(line)?.[1];
      if (fence) {
        if (f && f[0] === fence[0] && f.length >= fence.length && line.trim() === f) fence = undefined;
        out.push(line);
        continue;
      }
      if (f && !line.includes("%%")) {
        fence = f;
        out.push(line);
        continue;
      }
    }
    let kept = "";
    let removed = false;
    for (let i = 0; i < line.length; ) {
      if (inComment) {
        const end = line.indexOf("%%", i);
        removed = true;
        if (end < 0) { i = line.length; break; }
        inComment = false;
        i = end + 2;
        // "a %%note%% b" reads "a b", not "a  b".
        if (kept.endsWith(" ")) while (line[i] === " ") i++;
        continue;
      }
      if (line[i] === "`") {
        const run = /^`+/.exec(line.slice(i))![0];
        const close = line.indexOf(run, i + run.length);
        const to = close < 0 ? i + run.length : close + run.length;
        kept += line.slice(i, to);
        i = to;
        continue;
      }
      if (line.startsWith("%%", i)) { inComment = true; removed = true; i += 2; continue; }
      kept += line[i];
      i++;
    }
    // Trailing spaces left by a removed comment would turn into a hard line break.
    out.push(removed ? kept.replace(/[ \t]+$/, "") : kept);
  }
  return out.join("\n");
}

/** The remark plugin for links, highlights, block ids and plugin blocks. Its options are the render's state. */
export function remarkObsidianInline(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (node) => {
      if (node.type === "code" && node.lang && PLUGIN_BLOCKS.includes(node.lang.toLowerCase())) {
        state.issues.push({
          severity: "warning",
          code: "W-SYNTAX-UNKNOWN",
          file: state.ctx.filePath,
          line: node.position?.start.line ?? 1,
          message: `A "${node.lang}" block is drawn by an Obsidian plugin; the website shows the block's text instead.`,
          fix: "This shows as plain text on the website.",
        });
      }
      if (!node.children || node.type === "link" || node.type === "linkReference") return;
      node.children = node.children.flatMap((child) => (child.type === "text" ? wikilinks(child, state) : [child]));
      highlights(node);
      if (node.type === "paragraph") dropBlockIds(node);
    });
  };
}

const WIKILINK = /(?<!!)\[\[([^[\]|#]*)(#[^[\]|]*)?(?:\|([^[\]]*))?\]\]/g;

/** Splits a text node at `[[…]]` links: resolved ones become links, others plain text with a warning. */
function wikilinks(node: MdNode, state: RenderState): MdNode[] {
  const value = node.value ?? "";
  if (!value.includes("[[")) return [node];
  const out: MdNode[] = [];
  let last = 0;
  for (const m of value.matchAll(WIKILINK)) {
    const [whole, rawTarget, rawHeading, alias] = m;
    const target = rawTarget!.trim();
    const heading = rawHeading?.slice(1).trim();
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    last = m.index + whole.length;
    // `[[#Heading]]` links within this document; `#^block` links go to the note (blocks have no anchors here).
    const fragment = heading && !heading.startsWith("^") ? `#${slugify(heading)}` : "";
    const note = target ? state.ctx.resolveNote(target) : { href: "", title: heading ?? "" };
    const label = alias?.trim() || (note ? (target && heading && fragment ? `${note.title} > ${heading}` : note.title) : heading ? `${target} > ${heading}` : target);
    if (note) {
      out.push({ type: "link", url: `${note.href}${fragment}`, children: [{ type: "text", value: label }] });
    } else {
      const at = positionIn(node, m.index);
      state.issues.push({
        severity: "warning",
        code: "W-LINK-UNRESOLVED",
        file: state.ctx.filePath,
        line: at.line,
        column: at.column,
        message: `[[${target}]] doesn't match a published chapter, article or page, so it shows as plain text.`,
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
