/**
 * The build's issue collector (REQ-CNT-007, NFR-013, specs/standards.md#errors).
 * Content problems are never thrown: every module adds them here as `BuildIssue` values, and the
 * build report (build-report.ts) prints them all together at the end of the build, failing on any error.
 */

/** One problem in the author's files. `code` is a row of specs/contracts/build-messages.md. */
export type BuildIssue = {
  /** `E-` codes are errors (they stop the publish); `W-` codes are warnings (they don't). */
  severity: "error" | "warning";
  code: string;
  /** Vault-relative path with `/` separators, e.g. `part-1_foundations/chapter-1_computer-architecture.md`. */
  file: string;
  /** 1-based line in the file, when known. */
  line?: number;
  /** 1-based column, when known. */
  column?: number;
  /** What's wrong, in one plain sentence. */
  message: string;
  /** How to fix it, in plain words; starts with the contract's fix text. */
  fix: string;
};

/** Collects issues for one build. Adding the same issue twice keeps one (a loader may run twice). */
export type IssueCollector = {
  add(issue: BuildIssue): void;
  /** Every issue, in the order added. */
  all(): readonly BuildIssue[];
  hasErrors(): boolean;
};

/** A fresh, empty collector. The site uses the shared `buildIssues`; tests make their own. */
export function createIssueCollector(): IssueCollector {
  const issues: BuildIssue[] = [];
  const seen = new Set<string>();
  return {
    add(issue) {
      // Programmer errors, not content problems: a code must be in the contract's form and match its severity.
      if (!/^[EW]-[A-Z]+(-[A-Z]+)*$/.test(issue.code)) throw new Error(`Build issue code "${issue.code}" isn't of the form E-NAME or W-NAME`);
      if ((issue.code[0] === "E") !== (issue.severity === "error")) throw new Error(`Build issue ${issue.code} must have severity ${issue.code[0] === "E" ? "error" : "warning"}`);
      const key = JSON.stringify([issue.severity, issue.code, issue.file, issue.line, issue.column, issue.message, issue.fix]);
      if (seen.has(key)) return;
      seen.add(key);
      issues.push({ ...issue });
    },
    all: () => issues,
    hasErrors: () => issues.some((i) => i.severity === "error"),
  };
}

/**
 * The one collector every module adds to during a build. It lives on `globalThis` because Astro loads
 * astro.config.ts (which holds the report) in a separate, throwaway module graph: a plain module-level value
 * would give the report and the content loader two different collectors, and the report would see nothing.
 */
const KEY = Symbol.for("sdfp.buildIssues");
const shared = globalThis as typeof globalThis & { [KEY]?: IssueCollector };
export const buildIssues: IssueCollector = (shared[KEY] ??= createIssueCollector());
