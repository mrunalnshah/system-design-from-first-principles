/**
 * Embeds (REQ-CNT-006, REQ-DIAG-001, REQ-DIAG-006, REQ-DIAG-007): `![[name]]` and `![[name|Caption]]`.
 * - An SVG is found with `ctx.resolveFile` (closest to the note first). Consecutive light/dark embeds
 *   (`01-light.svg` then `01-dark.svg`, or `.light`/`.dark`) become one figure.
 * - A drawing, `![[01_computer-architecture.excalidraw|Caption]]`, becomes its exported images,
 *   `diagram/01_computer-architecture-light.svg` and `-dark.svg` (a `diagram/` folder, closest first).
 *   The drawing itself is never looked up or read.
 * - Each figure is drawn by `ctx.figure` (MOD-diagrams), so this module knows nothing about figure markup.
 * - Problems: a missing file is E-EMBED-MISSING; a drawing with no images is E-DRAWING-NOT-EXPORTED; any other
 *   embed (a note, a PNG) shows as text with W-SYNTAX-UNKNOWN.
 * A size such as `|300` is Obsidian's width, not a caption, and is ignored. Embeds are figures, so they're read
 * where a paragraph can be split around them; one inside bold, a heading, a table cell or a link shows as text
 * with W-SYNTAX-UNKNOWN (or stops the build with E-EMBED-MISSING when the file doesn't exist).
 */
import { locate, walk } from "../tree.ts";
import type { MdNode, RenderState } from "../types.ts";

const EMBED = /!\[\[([^[\]|]+?)(?:\|([^[\]]*))?\]\]/g;

/** A figure waiting to be drawn: its images, caption and line. */
type Pending = { type: "pendingFigure"; files: string[]; alias?: string; line: number; pairKey?: { base: string; theme: "light" | "dark" } };

/** The remark plugin; it runs before the link plugin, since `![[` contains `[[`. Its options are the render's state. */
export function remarkEmbeds(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (parent) => {
      if (!parent.children?.some((c) => c.type === "paragraph" && hasEmbed(c))) return;
      const split = parent.children.flatMap((c) => (c.type === "paragraph" && hasEmbed(c) ? splitParagraph(c, state) : [c]));
      parent.children = pairUp(split).map((n) => (n.type === "pendingFigure" ? draw(n as unknown as Pending, state) : n));
    });
    // Embeds anywhere else (inside bold, a heading, a table cell, a link) can't become figures.
    walk(tree, (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.flatMap((node) => (node.type === "text" && (node.value ?? "").includes("![[") ? inlineEmbeds(node, state) : [node]));
    });
  };
}

/** Text for each embed that can't be a figure here, with an issue saying so. */
function inlineEmbeds(node: MdNode, state: RenderState): MdNode[] {
  const value = node.value ?? "";
  const out: MdNode[] = [];
  let last = 0;
  for (const m of value.matchAll(EMBED)) {
    if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
    last = m.index + m[0].length;
    const at = locate(state, node, m.index, m[0]);
    const name = m[1]!.trim();
    const alias = m[2]?.trim();
    const isDrawing = /\.excalidraw(\.md)?$/i.test(name);
    if (!isDrawing && !state.ctx.resolveFile(name.split("#")[0]!, state.ctx.filePath)) {
      state.issues.push({ severity: "error", code: "E-EMBED-MISSING", file: state.ctx.filePath, line: at.line, column: at.column, message: `The file "${name}" can't be found in the vault.`, fix: "Check the spelling, or add the file." });
    } else {
      state.issues.push({
        severity: "warning",
        code: "W-SYNTAX-UNKNOWN",
        file: state.ctx.filePath,
        line: at.line,
        column: at.column,
        message: `The embed "${name}" is inside bold, a heading, a table or a link, where a figure can't go; put it on a line of its own.`,
        fix: "This shows as plain text on the website.",
      });
    }
    out.push({ type: "text", value: alias && !/^\d+(x\d+)?$/.test(alias) ? alias : name });
  }
  if (last < value.length) out.push({ type: "text", value: value.slice(last) });
  return out;
}

function hasEmbed(paragraph: MdNode): boolean {
  return (paragraph.children ?? []).some((c) => c.type === "text" && (c.value ?? "").includes("![["));
}

/** A paragraph with embeds becomes paragraphs of its other text, with pending figures between them. */
function splitParagraph(paragraph: MdNode, state: RenderState): MdNode[] {
  const out: MdNode[] = [];
  let inline: MdNode[] = [];
  const flush = () => {
    const kept = trimEdges(inline);
    if (kept.some((n) => n.type !== "text" || (n.value ?? "").trim())) out.push({ ...paragraph, children: kept });
    inline = [];
  };
  for (const child of paragraph.children ?? []) {
    const value = child.type === "text" ? (child.value ?? "") : "";
    if (!value.includes("![[")) { inline.push(child); continue; }
    let last = 0;
    for (const m of value.matchAll(EMBED)) {
      if (m.index > last) inline.push({ type: "text", value: value.slice(last, m.index) });
      last = m.index + m[0].length;
      const at = locate(state, child, m.index, m[0]);
      const embed = resolveEmbed(m[1]!.trim(), m[2]?.trim(), at, state);
      if (embed.type === "text") { inline.push(embed); continue; }
      flush();
      out.push(embed);
    }
    if (last < value.length) inline.push({ type: "text", value: value.slice(last) });
  }
  flush();
  return out;
}

/** What one embed becomes: a pending figure, or text (with an issue) when it can't be shown. */
function resolveEmbed(name: string, rawAlias: string | undefined, at: { line: number; column: number }, state: RenderState): MdNode {
  const { ctx } = state;
  const alias = rawAlias && !/^\d+(x\d+)?$/.test(rawAlias) ? rawAlias : undefined;
  const issue = (severity: "error" | "warning", code: string, message: string, fix: string) =>
    state.issues.push({ severity, code, file: ctx.filePath, line: at.line, column: at.column, message, fix });
  const figure = (files: string[], pairKey?: Pending["pairKey"]): MdNode => ({ type: "pendingFigure", files, line: at.line, ...(alias ? { alias } : {}), ...(pairKey ? { pairKey } : {}) }) as MdNode;

  const drawing = /^(.*?)\.excalidraw(\.md)?$/i.exec(name);
  if (drawing) {
    const base = drawing[1]!.split("/").pop()!;
    // Only images in a diagram/ folder count (where sync puts them); `diagram/<name>` matches any such folder.
    const files = ["light", "dark"].map((t) => ctx.resolveFile(`diagram/${base}-${t}.svg`, ctx.filePath)).filter((f): f is string => !!f);
    if (files.length) return figure(files);
    issue("error", "E-DRAWING-NOT-EXPORTED", `The drawing "${name}" has no images in a diagram/ folder (looked for ${base}-light.svg and ${base}-dark.svg).`, "Open the drawing in Obsidian, save it (Ctrl+S), then run sync so its images are collected.");
    return { type: "text", value: "" };
  }
  // `![[note#Heading]]` and `![[note#^block]]` embed part of a note: look the note up by its name.
  const file = ctx.resolveFile(name.split("#")[0]!.trim(), ctx.filePath);
  if (!file) {
    issue("error", "E-EMBED-MISSING", `The file "${name}" can't be found in the vault.`, "Check the spelling, or add the file.");
    return { type: "text", value: "" };
  }
  if (/\.svg$/i.test(file)) {
    const pair = /^(.*?)[-.](light|dark)\.svg$/i.exec(file.split("/").pop()!);
    return figure([file], pair ? { base: `${file.split("/").slice(0, -1).join("/")}/${pair[1]!.toLowerCase()}`, theme: pair[2]!.toLowerCase() as "light" | "dark" } : undefined);
  }
  issue("warning", "W-SYNTAX-UNKNOWN", `Embedding "${name}" isn't supported yet (only SVG diagrams and drawings are); the website shows its name instead.`, "This shows as plain text on the website.");
  return { type: "text", value: alias ?? name };
}

/** Joins a light embed and the dark one right after it (or the other way round) into one figure. */
function pairUp(nodes: MdNode[]): MdNode[] {
  const out: MdNode[] = [];
  for (const node of nodes) {
    const prev = out.at(-1) as unknown as Pending | undefined;
    const cur = node as unknown as Pending;
    if (node.type === "pendingFigure" && prev?.type === "pendingFigure" && prev.files.length === 1 && cur.files.length === 1 && prev.pairKey && cur.pairKey && prev.pairKey.base === cur.pairKey.base && prev.pairKey.theme !== cur.pairKey.theme) {
      const [light, dark] = prev.pairKey.theme === "light" ? [prev.files[0]!, cur.files[0]!] : [cur.files[0]!, prev.files[0]!];
      prev.files = [light, dark];
      prev.alias ??= cur.alias;
      continue;
    }
    out.push(node);
  }
  return out;
}

function draw(pending: Pending, state: RenderState): MdNode {
  const { html, issues } = state.ctx.figure({ files: pending.files, ...(pending.alias ? { alias: pending.alias } : {}), fromPath: state.ctx.filePath, line: pending.line });
  state.issues.push(...issues);
  state.figureCount++;
  return { type: "html", value: html };
}

/** Drops the newline (and spaces) an embed leaves at the start or end of the text around it. */
function trimEdges(nodes: MdNode[]): MdNode[] {
  const out = nodes.filter((n) => n.type !== "text" || n.value).map((n) => ({ ...n }));
  const first = out[0];
  const last = out.at(-1);
  if (first?.type === "text") first.value = (first.value ?? "").replace(/^\s+/, "");
  if (last?.type === "text") last.value = (last.value ?? "").replace(/\s+$/, "");
  return out.filter((n) => n.type !== "text" || n.value);
}
