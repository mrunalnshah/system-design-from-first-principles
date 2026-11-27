/**
 * TOOL-04 Code map (plan/tools.md#tool-04-code-map): the exported signatures in a folder
 * (functions, types, classes, re-exports, and each .astro component's `interface Props`),
 * read with the TypeScript compiler API and printed without function bodies or comments,
 * so an agent sees a module's surface for a few hundred tokens instead of its source.
 *
 * Tests (`*.test.*`, `*.spec.*`) and `node_modules` are skipped. Output is one `## <file>`
 * heading per file that exports something, files in path order.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

export type MapResult = { text: string; tokens: number; truncated: boolean };

/** The line that ends output cut to its budget (TOOL-04.AC2). */
export const TRUNCATED = "… (truncated)";

/**
 * Maps `path` (an absolute folder or file). Headings are relative to `root` (default: `path` itself,
 * or the file's folder). `tokens` uses the packer's estimate (characters ÷ 4, rounded up); with
 * `budget`, output over it is cut at a line boundary to at most `budget` tokens, ending in TRUNCATED.
 * Throws `Nothing to map: <path> doesn't exist` for a missing path.
 */
export function codeMap(path: string, opts: { root?: string; budget?: number } = {}): MapResult {
  if (!existsSync(path)) throw new Error(`Nothing to map: ${path} doesn't exist`);
  const isDir = statSync(path).isDirectory();
  const base = opts.root ?? (isDir ? path : join(path, ".."));
  const blocks: string[] = [];
  for (const file of isDir ? sourceFiles(path) : [path]) {
    const lines = signaturesOf(file, readFileSync(file, "utf8"));
    if (lines.length) blocks.push([`## ${relative(base, file).replace(/\\/g, "/")}`, ...lines].join("\n"));
  }
  const full = (blocks.length ? blocks.join("\n\n") : "(no exported signatures)") + "\n";
  if (opts.budget === undefined || estimateTokens(full) <= opts.budget)
    return { text: full, tokens: estimateTokens(full), truncated: false };
  const text = cut(full, opts.budget);
  return { text, tokens: estimateTokens(text), truncated: true };
}

/**
 * The exported signatures of one file's source, one entry per declaration (an entry may span lines).
 * For an `.astro` file: its frontmatter's `interface Props` (exported or not) and any exported types.
 */
export function signaturesOf(fileName: string, source: string): string[] {
  const astro = fileName.endsWith(".astro");
  const code = astro ? (/^﻿?---\r?\n([\s\S]*?)\r?\n---/.exec(source)?.[1] ?? "") : source;
  const sf = ts.createSourceFile(
    fileName + (astro ? ".ts" : ""),
    code,
    ts.ScriptTarget.Latest,
    true,
    scriptKind(fileName),
  );
  const out: string[] = [];
  for (const node of sf.statements) {
    if (astro && ts.isInterfaceDeclaration(node) && node.name.text === "Props") out.push(print(node, sf));
    else if (isExported(node) || ts.isExportDeclaration(node) || ts.isExportAssignment(node)) {
      const shown = withoutBodies(node);
      if (shown) out.push(print(shown, sf));
    }
  }
  if (astro && !out.length) out.push("(no Props)");
  return out;
}

/** The packer's token estimate (pack.ts): characters ÷ 4, rounded up. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ---------- internals ----------

const printer = ts.createPrinter({ removeComments: true, newLine: ts.NewLineKind.LineFeed });
const f = ts.factory;
/** What replaces a function body or a long initializer. */
const elided = () => f.createIdentifier("…");

function print(node: ts.Node, sf: ts.SourceFile): string {
  return printer.printNode(ts.EmitHint.Unspecified, node, sf).trimEnd();
}

function scriptKind(fileName: string): ts.ScriptKind {
  return /\.[cm]?tsx$/.test(fileName)
    ? ts.ScriptKind.TSX
    : /\.[cm]?jsx?$/.test(fileName)
      ? ts.ScriptKind.JS
      : ts.ScriptKind.TS;
}

function isExported(node: ts.Statement): boolean {
  return ts.canHaveModifiers(node) && !!ts.getModifiers(node)?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
}

/** The declaration as it should be shown, or undefined to skip it. Bodies go; types and parameters stay. */
function withoutBodies(node: ts.Statement): ts.Node | undefined {
  if (ts.isFunctionDeclaration(node))
    return f.updateFunctionDeclaration(
      node,
      node.modifiers,
      node.asteriskToken,
      node.name,
      node.typeParameters,
      node.parameters,
      node.type,
      undefined,
    );
  if (ts.isVariableStatement(node)) {
    const decls = node.declarationList.declarations.map((d) =>
      f.updateVariableDeclaration(d, d.name, d.exclamationToken, d.type, shownInitializer(d)),
    );
    return f.updateVariableStatement(
      node,
      node.modifiers,
      f.updateVariableDeclarationList(node.declarationList, decls),
    );
  }
  if (ts.isClassDeclaration(node)) {
    const members = node.members.flatMap((m) => {
      const shown = memberWithoutBody(m);
      return shown ? [shown] : [];
    });
    return f.updateClassDeclaration(
      node,
      node.modifiers,
      node.name,
      node.typeParameters,
      node.heritageClauses,
      members,
    );
  }
  if (ts.isExportAssignment(node))
    return f.updateExportAssignment(node, node.modifiers, short(node.expression) ? node.expression : elided());
  // Types, interfaces, enums, re-exports: they are signatures already.
  return node;
}

/** A function-valued initializer keeps its parameters and return type; others are kept only when short. */
function shownInitializer(d: ts.VariableDeclaration): ts.Expression | undefined {
  const init = d.initializer;
  if (!init) return undefined;
  if (ts.isArrowFunction(init))
    return f.updateArrowFunction(
      init,
      init.modifiers,
      init.typeParameters,
      init.parameters,
      init.type,
      init.equalsGreaterThanToken,
      elided(),
    );
  if (ts.isFunctionExpression(init))
    return f.createArrowFunction(init.modifiers, init.typeParameters, init.parameters, init.type, undefined, elided());
  if (d.type) return undefined;
  return short(init) ? init : elided();
}

/** Short enough to print as is: one line of at most 60 characters. */
function short(e: ts.Expression): boolean {
  const text = e.getText();
  return text.length <= 60 && !text.includes("\n");
}

function memberWithoutBody(m: ts.ClassElement): ts.ClassElement | undefined {
  const mods = ts.canHaveModifiers(m) ? ts.getModifiers(m) : undefined;
  if (mods?.some((x) => x.kind === ts.SyntaxKind.PrivateKeyword) || (m.name && ts.isPrivateIdentifier(m.name)))
    return undefined;
  if (ts.isMethodDeclaration(m))
    return f.updateMethodDeclaration(
      m,
      m.modifiers,
      m.asteriskToken,
      m.name,
      m.questionToken,
      m.typeParameters,
      m.parameters,
      m.type,
      undefined,
    );
  if (ts.isConstructorDeclaration(m)) return f.updateConstructorDeclaration(m, m.modifiers, m.parameters, undefined);
  if (ts.isGetAccessorDeclaration(m))
    return f.updateGetAccessorDeclaration(m, m.modifiers, m.name, m.parameters, m.type, undefined);
  if (ts.isSetAccessorDeclaration(m))
    return f.updateSetAccessorDeclaration(m, m.modifiers, m.name, m.parameters, undefined);
  if (ts.isPropertyDeclaration(m))
    return f.updatePropertyDeclaration(
      m,
      m.modifiers,
      m.name,
      m.questionToken ?? m.exclamationToken,
      m.type,
      m.type ? undefined : m.initializer && short(m.initializer) ? m.initializer : undefined,
    );
  if (ts.isClassStaticBlockDeclaration(m)) return undefined;
  return m;
}

/** Every mappable source file under `dir`, sorted by path; tests, test helpers (`test-*.ts`) and node_modules skipped. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d).sort()) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) {
        if (name !== "node_modules" && !name.startsWith(".")) walk(p);
      } else if (/\.([cm]?tsx?|astro)$/.test(name) && !/\.(test|spec)\.[cm]?tsx?$|^test-/.test(name)) out.push(p);
    }
  };
  walk(dir);
  return out;
}

/** `text` cut at a line boundary so that, with the TRUNCATED line, it's at most `budget` tokens. */
function cut(text: string, budget: number): string {
  const room = Math.max(0, budget * 4 - TRUNCATED.length - 2);
  const head = text.slice(0, room);
  const atLine = head.lastIndexOf("\n");
  // A file heading left with nothing under it, and blank lines, add nothing: they go too, from the end back.
  const lines = (atLine > 0 ? head.slice(0, atLine) : head).split("\n");
  while (lines.length && (lines.at(-1)!.trim() === "" || lines.at(-1)!.startsWith("## "))) lines.pop();
  const kept = lines.length ? `${lines.join("\n")}\n` : "";
  return kept + TRUNCATED + "\n";
}
