/**
 * The build report (REQ-CNT-007.AC2, NFR-013): an Astro integration that prints every collected issue
 * together at the end of the build, errors first, in the block form of specs/contracts/build-messages.md,
 * and makes the build exit non-zero when there's any error. Warnings are printed but never fail it.
 *
 * Why it exits instead of throwing: Astro prints a thrown error with a stack trace, which is noise for the
 * author, and a plain `process.exitCode` is overwritten when Astro exits 0 itself.
 */
import type { AstroIntegration } from "astro";
import { buildIssues, type BuildIssue, type IssueCollector } from "./issues.ts";

/** What the report needs from the outside world; tests pass their own. */
export type ReportOptions = {
  /** The issues to report; defaults to the shared `buildIssues`. */
  issues?: IssueCollector;
  /** Writes the report; resolves once it's written. Defaults to stdout. */
  write?: (text: string) => Promise<void>;
  /** Ends the build with this exit code; called only when there's an error. Defaults to `process.exit`. */
  exit?: (code: number) => void;
};

/**
 * The report text: one block per issue, errors first, then by file and line; then a one-line summary.
 * Empty when there are no issues.
 */
export function formatReport(issues: readonly BuildIssue[]): string {
  if (!issues.length) return "";
  const sorted = [...issues].sort(
    (a, b) => rank(a) - rank(b) || a.file.localeCompare(b.file) || (a.line ?? 0) - (b.line ?? 0) || a.code.localeCompare(b.code),
  );
  const blocks = sorted.map((i) => {
    const where = i.file + (i.line ? `:${i.line}${i.column ? `:${i.column}` : ""}` : "");
    const head = i.severity === "error" ? `✖ ERROR ${i.code}` : `⚠ WARNING ${i.code}`;
    return [`${head}  ${where}`, indent(i.message), indent(`Fix: ${i.fix}`)].join("\n");
  });
  const errors = issues.filter((i) => i.severity === "error").length;
  const warnings = issues.length - errors;
  const counts = [errors && plural(errors, "error"), warnings && plural(warnings, "warning")].filter(Boolean).join(" and ");
  const summary = errors
    ? `The build found ${counts}. Errors stop the publish: fix them, then build again.`
    : `The build found ${counts}. Warnings don't stop the publish.`;
  return `\n${blocks.join("\n\n")}\n\n${summary}\n`;
}

/** The Astro integration that prints the report when the build is done (registered in astro.config.ts). */
export function buildReport(options: ReportOptions = {}): AstroIntegration {
  const issues = options.issues ?? buildIssues;
  const write = options.write ?? ((text: string) => new Promise<void>((done) => process.stdout.write(text, () => done())));
  const exit = options.exit ?? ((code: number) => process.exit(code));
  return {
    name: "sdfp:build-report",
    hooks: {
      "astro:build:done": async () => {
        const text = formatReport(issues.all());
        if (text) await write(text);
        if (issues.hasErrors()) exit(1);
      },
    },
  };
}

/**
 * Stops the build at once when the issues so far include an error, after printing the report: for the vault
 * loader, which runs before any page is built, so a page never crashes on content that has an error (for
 * example a missing book.md). Does nothing when there's no error; warnings wait for the end-of-build report.
 */
export async function stopOnErrors(options: ReportOptions = {}): Promise<void> {
  const issues = options.issues ?? buildIssues;
  if (!issues.hasErrors()) return;
  // Several loaders may get here at once (they run in parallel): only the first prints the report.
  const STOPPING = Symbol.for("sdfp.stopping");
  const shared = globalThis as typeof globalThis & { [STOPPING]?: WeakSet<object> };
  const stopping = (shared[STOPPING] ??= new WeakSet());
  if (stopping.has(issues)) return;
  stopping.add(issues);
  const write = options.write ?? ((text: string) => new Promise<void>((done) => process.stdout.write(text, () => done())));
  await write(formatReport(issues.all()));
  (options.exit ?? ((code: number) => process.exit(code)))(1);
}

const rank = (i: BuildIssue) => (i.severity === "error" ? 0 : 1);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
/** Indents every line by two spaces, so multi-line text (e.g. an example) stays inside its block. */
const indent = (text: string) => text.split("\n").map((l) => `  ${l}`).join("\n");
