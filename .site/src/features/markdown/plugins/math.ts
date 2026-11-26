/**
 * Math at build time (REQ-READ-008, ADR-0008): remark-math finds `$…$` and `$$…$$`, and this step typesets each
 * with KaTeX 0.19.1 into HTML plus MathML (readable by screen readers), so readers need no JavaScript. A formula
 * KaTeX can't read is an E-MATH error at its exact line and column (CNF-001: write `\mu`, not `\micro`).
 *
 * Like Obsidian, `$…$` counts as math only when no space follows the opening `$` or comes before the closing
 * one, so prices such as "$5 and $10" stay text. The pages that show math load KaTeX's own stylesheet
 * (`katex/dist/katex.min.css`, self-hosted with its fonts by the build; added with the reader layout, T-01.16).
 */
import katex from "katex";
import { walk, type MdNode, type RenderState } from "../types.ts";

/** The remark plugin; it runs after remark-math. Its options are the render's state. */
export function remarkMathRender(state: RenderState) {
  return (tree: MdNode) => {
    walk(tree, (parent) => {
      if (!parent.children) return;
      parent.children = parent.children.map((node) => {
        if (node.type !== "inlineMath" && node.type !== "math") return node;
        const tex = node.value ?? "";
        const classes = node.data?.hProperties?.className;
        const display = node.type === "math" || (Array.isArray(classes) && classes.includes("math-display"));
        if (node.type === "inlineMath" && !display && /^\s|\s$/.test(tex)) return { type: "text", value: `$${tex}$` };
        try {
          const html = katex.renderToString(tex, { throwOnError: true, output: "htmlAndMathml", displayMode: display, strict: false, trust: false });
          return { type: "html", value: display ? `<div class="math-display">${html}</div>` : html };
        } catch (e) {
          if (!(e instanceof katex.ParseError)) throw e;
          state.issues.push(mathIssue(state, node, tex, e));
          return { type: "inlineCode", value: tex };
        }
      });
    });
  };
}

/** E-MATH at the character KaTeX stopped at, counted in the original source. */
function mathIssue(state: RenderState, node: MdNode, tex: string, error: katex.ParseError) {
  const start = node.position?.start.offset ?? 0;
  const texAt = Math.max(0, state.source.indexOf(tex, start));
  const at = texAt + (typeof error.position === "number" ? error.position : 0);
  const before = state.source.slice(0, at).split("\n");
  const what = (error.rawMessage ?? error.message).replace(/\.$/, "");
  return {
    severity: "error" as const,
    code: "E-MATH",
    file: state.ctx.filePath,
    line: before.length,
    column: before.at(-1)!.length + 1,
    message: `The math renderer can't read this formula: ${what}.`,
    fix: "Use a supported command; for micro, write \\mu. Supported commands: https://katex.org/docs/supported.html",
  };
}
