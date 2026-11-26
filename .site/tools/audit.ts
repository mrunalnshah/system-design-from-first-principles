/**
 * TOOL-14 Dependency audit (plan/tools.md, specs/stack.md#supply-chain-settings):
 * 1. known vulnerabilities: `npm audit` at level high or worse;
 * 2. release-age cooldown: every lockfile entry that's new or changed against a base commit was
 *    published at least 7 days before the lockfile change;
 * 3. licences, in two tiers (CR-0004): code shipped to readers must be permissive; build and
 *    development tools may also use a short list of weak-copyleft or source-available licences.
 * The network-facing parts are injectable, so tests never touch the registry.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export type AuditResult = { ok: boolean; problems: string[]; notes: string[] };

export type AuditOptions = {
  /** Repository root; the lockfile is `<root>/.site/package-lock.json`. */
  root: string;
  /** The lockfile as of the base commit, or undefined to skip the cooldown check (no base). */
  baseLockfile?: string;
  /** When the lockfile changed (the moment the new versions were chosen). Defaults to now. */
  changedAt?: Date;
  /** Publish time of `name@version`, or undefined if unknown. Defaults to the npm registry. */
  publishTime?: (name: string, version: string) => Date | undefined;
  /** High or critical advisories as `name: title`. Defaults to `npm audit --json`. */
  advisories?: () => string[];
  /** Also write a CycloneDX SBOM to this absolute path. */
  sbomPath?: string;
};

/** An empty lockfile: what a base commit "had" before the project's lockfile existed. */
const EMPTY_LOCKFILE = JSON.stringify({ lockfileVersion: 3, packages: { "": {} } });

/**
 * The lockfile as of git `ref`, for the cooldown comparison. Throws when `ref` isn't a commit in the
 * repository (a typo, or a force-pushed-away SHA): the check must never be skipped silently. A commit
 * from before the lockfile existed yields an empty lockfile, so every current entry gets checked.
 */
export function baseLockfileFor(root: string, ref: string): string {
  try { git(root, ["rev-parse", "--verify", "--quiet", `${ref}^{commit}`]); }
  catch { throw new Error(`--base ${ref} isn't a commit in this repository, so the cooldown can't be checked against it.`); }
  try { return git(root, ["show", `${ref}:${LOCKFILE}`]); } catch { return EMPTY_LOCKFILE; }
}

/** When the current lockfile's versions were chosen: now if it has uncommitted changes, else its last commit's time. */
export function lockfileChangedAt(root: string): Date {
  try {
    if (git(root, ["status", "--porcelain", "--", LOCKFILE]).trim()) return new Date();
    const iso = git(root, ["log", "-1", "--format=%cI", "--", LOCKFILE]).trim();
    return iso ? new Date(iso) : new Date();
  } catch { return new Date(); }
}

const LOCKFILE = ".site/package-lock.json";
function git(root: string, args: string[]): string {
  return execFileSync("git", ["-C", root, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
}

export const COOLDOWN_DAYS = 7;

/** Runs all three checks; `ok` only when there are no problems. Notes explain anything skipped. */
export function audit(opts: AuditOptions): AuditResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const lock = parseLockfile(readFileSync(join(opts.root, ".site/package-lock.json"), "utf8"));

  // 1. Known vulnerabilities. If npm audit itself can't run, that's a problem, never a pass.
  try {
    for (const a of (opts.advisories ?? npmAdvisories(opts.root))()) problems.push(`Vulnerability (high or critical): ${a}.`);
  } catch (e) {
    problems.push(`npm audit couldn't run, so vulnerabilities weren't checked: ${e instanceof Error ? e.message : String(e)}`);
  }

  // 2. Cooldown for new or changed entries.
  if (opts.baseLockfile === undefined) notes.push("Cooldown check skipped: no base lockfile to compare with (pass --base <git-ref>).");
  else {
    const base = parseLockfile(opts.baseLockfile);
    const changed = [...lock.entries].filter(([path, e]) => base.entries.get(path)?.version !== e.version);
    const changedAt = opts.changedAt ?? new Date();
    const publishTime = opts.publishTime ?? registryPublishTime();
    for (const [path, e] of changed) {
      const name = e.name ?? nameOf(path);
      const published = publishTime(name, e.version);
      if (!published) { problems.push(`${name}@${e.version}: its publish time couldn't be found, so the ${COOLDOWN_DAYS}-day cooldown can't be checked.`); continue; }
      const ageDays = (changedAt.getTime() - published.getTime()) / 86_400_000;
      if (ageDays < COOLDOWN_DAYS) problems.push(`${name}@${e.version} was published ${Math.floor(ageDays)} days before the lockfile change; the cooldown is ${COOLDOWN_DAYS} days (specs/stack.md).`);
    }
    notes.push(`Cooldown checked for ${changed.length} new or changed lockfile ${changed.length === 1 ? "entry" : "entries"}.`);
  }

  // 3. Licences, two tiers (CR-0004).
  const shipped = shippedClosure(lock);
  for (const [path, e] of lock.entries) {
    const id = `${e.name ?? nameOf(path)}@${e.version}`;
    const tier = shipped.has(path) ? "shipped to readers" : "build or development tool";
    if (!e.license) problems.push(`${id} has no licence in the lockfile (${tier}): check it by hand before keeping it.`);
    else if (!licenceAllowed(e.license, shipped.has(path) ? SHIPPED_LICENCES : TOOL_LICENCES))
      problems.push(`${id} is licensed "${e.license}", which isn't allowed for code ${shipped.has(path) ? "shipped to readers" : "in build or development tools"} (CR-0004).`);
  }

  if (opts.sbomPath) {
    writeFileSync(opts.sbomPath, npm(opts.root, ["sbom", "--sbom-format", "cyclonedx"]));
    notes.push(`SBOM written to ${opts.sbomPath}.`);
  }
  return { ok: problems.length === 0, problems, notes };
}

/**
 * Whether an SPDX licence expression (e.g. `MIT`, `(MIT OR CC0-1.0)`, `Apache-2.0 AND LGPL-3.0-or-later`)
 * is satisfied by the allowed licence IDs: OR needs one side allowed, AND needs both. `ID WITH exception`
 * counts as ID. Anything that isn't a complete, valid expression (lowercase operators, a missing `)`,
 * two IDs in a row, leftovers) is not allowed: the check fails closed.
 */
export function licenceAllowed(expression: string, allowed: ReadonlySet<string>): boolean {
  const tokens = expression.replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/).filter(Boolean);
  const OPERATORS = new Set(["AND", "OR", "WITH", "(", ")"]);
  let i = 0;
  const fail = (): never => { throw new SyntaxError("invalid SPDX expression"); };
  const id = (): string => { const t = tokens[i++]; if (!t || OPERATORS.has(t) || !/^[A-Za-z0-9.+-]+$/.test(t)) fail(); return t!; };
  // Grammar: or := and ("OR" and)* ; and := factor ("AND" factor)* ; factor := "(" or ")" | ID ["WITH" ID]
  const factor = (): boolean => {
    if (tokens[i] === "(") {
      i++;
      const v = or();
      if (tokens[i++] !== ")") fail();
      return v;
    }
    const licence = id();
    if (tokens[i] === "WITH") { i++; id(); }
    return allowed.has(licence);
  };
  const and = (): boolean => { let v = factor(); while (tokens[i] === "AND") { i++; const r = factor(); v = v && r; } return v; };
  const or = (): boolean => { let v = and(); while (tokens[i] === "OR") { i++; const r = and(); v = v || r; } return v; };
  try {
    const v = or();
    return i === tokens.length && v;
  } catch {
    return false;
  }
}

// ---------- policy (CR-0004) ----------

/** Permissive licences: the only ones allowed for code that reaches readers' browsers. */
const SHIPPED_LICENCES = new Set(["MIT", "ISC", "BSD-2-Clause", "BSD-3-Clause", "Apache-2.0", "OFL-1.1", "0BSD", "BlueOak-1.0.0", "CC0-1.0"]);
/** Also allowed for build and development tools, which never ship to readers. Each needs a reason. */
const TOOL_LICENCES = new Set([
  ...SHIPPED_LICENCES,
  "MPL-2.0", // file-level copyleft; lightningcss (Vite's CSS minifier), axe-core (accessibility tests)
  "LGPL-3.0-or-later", // sharp's libvips binaries (Astro image tooling); linked at build time only
  "PSF-2.0", // argparse (a test tool's dependency)
  "FSL-1.1-Apache-2.0", // sentry, used by Lighthouse during tests; becomes Apache-2.0 after two years
]);
/** Packages whose code reaches readers (directly or through their dependencies). */
const SHIPPED_ROOTS = [/^katex$/, /^@panzoom\/panzoom$/, /^@fontsource-variable\//];

// ---------- internals ----------

type LockEntry = {
  version: string;
  /** Set by npm only for aliased installs (`"x": "npm:real-name@1"`): the package's real name. */
  name?: string;
  license?: string;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};
type Lock = { rootDependencies: string[]; entries: Map<string, LockEntry> };

function parseLockfile(text: string): Lock {
  const json = JSON.parse(text) as { packages: Record<string, LockEntry & { link?: boolean }> };
  const entries = new Map<string, LockEntry>();
  for (const [path, e] of Object.entries(json.packages)) if (path && !e.link && e.version) entries.set(path, e);
  return { rootDependencies: Object.keys(json.packages[""]?.dependencies ?? {}), entries };
}

/** `node_modules/a/node_modules/@b/c` → `@b/c`. */
function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
}

/** Lockfile paths of the shipped roots and everything they depend on (npm's nested-then-hoisted lookup). */
function shippedClosure(lock: Lock): Set<string> {
  const seen = new Set<string>();
  const resolve = (from: string, name: string): string | undefined => {
    for (let dir = from; ; ) {
      const candidate = `${dir ? dir + "/" : ""}node_modules/${name}`;
      if (lock.entries.has(candidate)) return candidate;
      if (!dir) return undefined;
      const cut = dir.lastIndexOf("/node_modules/");
      dir = cut >= 0 ? dir.slice(0, cut) : "";
    }
  };
  const visit = (path: string | undefined) => {
    if (!path || seen.has(path)) return;
    seen.add(path);
    const e = lock.entries.get(path);
    for (const dep of Object.keys({ ...e?.dependencies, ...e?.optionalDependencies, ...e?.peerDependencies })) visit(resolve(path, dep));
  };
  for (const name of lock.rootDependencies) if (SHIPPED_ROOTS.some((r) => r.test(name))) visit(resolve("", name));
  return seen;
}

/**
 * Runs npm without a shell: through npm's own CLI script (`npm_execpath`, set whenever this runs as
 * an npm script) on the current Node. A shell would be needed for `npm.cmd` on Windows, and shell
 * arguments built from lockfile data are an injection risk.
 */
function runNpm(args: string[], cwd?: string): string {
  const cli = process.env.npm_execpath;
  if (!(cli && /\.c?js$/.test(cli)) && process.platform === "win32")
    throw new Error("npm can't be found without a shell on Windows: run this through `npm --prefix .site run tools -- audit`.");
  const [file, argv] = cli && /\.c?js$/.test(cli) ? [process.execPath, [cli, ...args]] : ["npm", args];
  return execFileSync(file, argv, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

function npm(root: string, args: string[]): string {
  try {
    return runNpm(args, join(root, ".site"));
  } catch (e) {
    // npm audit exits non-zero when it finds anything; its JSON is still on stdout.
    const out = (e as { stdout?: string }).stdout;
    if (out) return out;
    throw e;
  }
}

function npmAdvisories(root: string): () => string[] {
  return () => {
    const report = JSON.parse(npm(root, ["audit", "--json"])) as {
      error?: { summary?: string };
      vulnerabilities?: Record<string, { severity: string; via: (string | { title?: string })[] }>;
    };
    // A network or registry failure comes back as {"error": …} with no vulnerability list: fail, don't pass.
    if (report.error || !report.vulnerabilities) throw new Error(report.error?.summary ?? "npm audit returned no vulnerability report");
    return Object.entries(report.vulnerabilities)
      .filter(([, v]) => v.severity === "high" || v.severity === "critical")
      .map(([name, v]) => `${name}: ${v.via.map((x) => (typeof x === "string" ? `via ${x}` : x.title)).join("; ")} (${v.severity})`);
  };
}

function registryPublishTime(): (name: string, version: string) => Date | undefined {
  const cache = new Map<string, Record<string, string>>();
  runNpm(["--version"]); // npm itself must work; only a missing package may read as "publish time not found"
  return (name, version) => {
    if (!cache.has(name)) {
      try { cache.set(name, JSON.parse(runNpm(["view", name, "time", "--json"]))); }
      catch { cache.set(name, {}); }
    }
    const t = cache.get(name)![version];
    return t ? new Date(t) : undefined;
  };
}
