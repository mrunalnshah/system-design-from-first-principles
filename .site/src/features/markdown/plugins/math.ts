/**
 * Math at build time (REQ-READ-008, ADR-0008): remark-math finds `$…$` and `$$…$$`, and this step typesets each
 * with KaTeX 0.19.1 into HTML plus MathML (readable by screen readers), so readers need no JavaScript. A formula
 * KaTeX can't read is an E-MATH error at its exact line and column (CNF-001: write `\mu`, not `\micro`).
 * Commands that would add links, images or HTML (`\href`, `\url`, `\includegraphics`, `\html…`) are refused
 * (`trust` off) and reported as E-MATH too, so nothing is lost silently.
 *
 * The pages that show math load KaTeX's stylesheet and fonts, self-hosted from the katex package (CR-0006).
 */
import katex from "katex";
import { lineColumn, walk } from "../tree.ts";
import type { MdNode, RenderState } from "../types.ts";

/**
 * Obsidian's rule for `$…$`, checked on the source as written: it's math only when no space follows the opening
 * `$` or comes before the closing one, and no digit follows the closing one. So "$5 and $10" and "$ x $" stay
 * text. Runs straight after remark-math, so the other plugins still see that text. (Its inner Markdown, such as
 * `**bold**`, stays as written: remark-math has already read it as a formula.)
 */
export function remarkMathGuard(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.flatMap((node) => {
        const start = node.position?.start.offset;
        const end = node.position?.end.offset;
        if (node.type !== "inlineMath" || start === undefined || end === undefined) return [node];
        const written = state.source.slice(start, end);
        const fence = /^\$+/.exec(written)?.[0].length ?? 1;
        if (fence > 1) return [node]; // `$$…$$` inside a line is display math in Obsidian
        const inner = written.slice(1, -1);
        if (!/^\s|\s$/.test(inner) && !/\d/.test(state.source[end] ?? "")) return [node];
        return [{ type: "text", value: written, position: node.position }];
      });
    });
  };
}

/** The remark plugin that typesets; it runs last, after the plain text is collected. Its options are the render's state. */
export function remarkMathRender(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (node.type !== "inlineMath" && node.type !== "math") return node;
        const tex = node.value ?? "";
        const start = node.position?.start.offset;
        const written = start !== undefined ? state.source.slice(start, node.position!.end.offset) : "";
        const display = node.type === "math" || written.startsWith("$$");
        const refused: string[] = [];
        try {
          const html = katex.renderToString(tex, {
            throwOnError: true,
            output: "htmlAndMathml",
            displayMode: display,
            strict: false,
            trust: (c) => (refused.push(c.command), false),
          });
          // A display formula wider than the screen scrolls in its own box, which keyboard users can reach (tabindex).
          if (!refused.length) return { type: "html", value: display ? `<div class="math-display" tabindex="0" role="group" aria-label="Formula">${html}</div>` : html };
          state.issues.push(mathIssue(state, node, tex, `it uses ${[...new Set(refused)].join(", ")}, which the website doesn't allow in formulas (no links, images or HTML)`, 0));
        } catch (e) {
          if (!(e instanceof katex.ParseError)) throw e;
          state.issues.push(mathIssue(state, node, tex, (e.rawMessage ?? e.message).replace(/\.$/, ""), typeof e.position === "number" ? e.position : 0));
        }
        // The build stops on E-MATH; until it's fixed the formula shows as written.
        return node.type === "math" ? { type: "code", value: tex } : { type: "inlineCode", value: tex };
      });
    });
  };
}

/** E-MATH at the character KaTeX stopped at, counted in the original source. */
function mathIssue(state: RenderState, node: MdNode, tex: string, what: string, position: number) {
  const start = node.position?.start.offset ?? 0;
  const texAt = Math.max(0, state.source.indexOf(tex, start));
  const at = lineColumn(state.source, texAt + position);
  return {
    severity: "error" as const,
    code: "E-MATH",
    file: state.ctx.filePath,
    line: at.line,
    column: at.column,
    message: `The math renderer can't read this formula: ${what}.`,
    fix: "Use a supported command; for micro, write \\mu. Supported commands: https://katex.org/docs/supported.html",
  };
}
