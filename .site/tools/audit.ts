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
  /** Also write a CycloneDX SBOM here (relative paths resolve against the repository root). */
  sbomPath?: string;
};

export const COOLDOWN_DAYS = 7;

/** Runs all three checks; `ok` only when there are no problems. Notes explain anything skipped. */
export function audit(opts: AuditOptions): AuditResult {
  const problems: string[] = [];
  const notes: string[] = [];
  const lock = parseLockfile(readFileSync(join(opts.root, ".site/package-lock.json"), "utf8"));

  // 1. Known vulnerabilities.
  for (const a of (opts.advisories ?? npmAdvisories(opts.root))()) problems.push(`Vulnerability (high or critical): ${a}.`);

  // 2. Cooldown for new or changed entries.
  if (opts.baseLockfile === undefined) notes.push("Cooldown check skipped: no base lockfile to compare with (pass --base <git-ref>).");
  else {
    const base = parseLockfile(opts.baseLockfile);
    const changed = [...lock.entries].filter(([path, e]) => base.entries.get(path)?.version !== e.version);
    const changedAt = opts.changedAt ?? new Date();
    const publishTime = opts.publishTime ?? registryPublishTime();
    for (const [path, e] of changed) {
      const name = nameOf(path);
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
    const id = `${nameOf(path)}@${e.version}`;
    const tier = shipped.has(path) ? "shipped to readers" : "build or development tool";
    if (!e.license) problems.push(`${id} has no licence in the lockfile (${tier}): check it by hand before keeping it.`);
    else if (!licenceAllowed(e.license, shipped.has(path) ? SHIPPED_LICENCES : TOOL_LICENCES))
      problems.push(`${id} is licensed "${e.license}", which isn't allowed for code ${shipped.has(path) ? "shipped to readers" : "in build or development tools"} (CR-0004).`);
  }

  if (opts.sbomPath) {
    writeFileSync(join(opts.root, opts.sbomPath), npm(opts.root, ["sbom", "--sbom-format", "cyclonedx"]));
    notes.push(`SBOM written to ${opts.sbomPath}.`);
  }
  return { ok: problems.length === 0, problems, notes };
}

/**
 * Whether an SPDX licence expression (e.g. `MIT`, `(MIT OR CC0-1.0)`, `Apache-2.0 AND LGPL-3.0-or-later`)
 * is satisfied by the allowed licence IDs: OR needs one side allowed, AND needs both.
 */
export function licenceAllowed(expression: string, allowed: ReadonlySet<string>): boolean {
  const tokens = expression.replace(/[()]/g, (p) => ` ${p} `).trim().split(/\s+/);
  let i = 0;
  // Grammar: or := and ("OR" and)* ; and := atom ("AND" atom)* ; atom := ID | "(" or ")"
  const atom = (): boolean => {
    const t = tokens[i++];
    if (t === "(") { const v = or(); i++; return v; }
    return !!t && allowed.has(t);
  };
  const and = (): boolean => { let v = atom(); while (tokens[i] === "AND") { i++; const r = atom(); v = v && r; } return v; };
  const or = (): boolean => { let v = and(); while (tokens[i] === "OR") { i++; const r = and(); v = v || r; } return v; };
  return or();
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

type LockEntry = { version: string; license?: string; dependencies?: Record<string, string> };
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
    for (const dep of Object.keys(lock.entries.get(path)?.dependencies ?? {})) visit(resolve(path, dep));
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
    const report = JSON.parse(npm(root, ["audit", "--json"])) as { vulnerabilities?: Record<string, { severity: string; via: (string | { title?: string })[] }> };
    return Object.entries(report.vulnerabilities ?? {})
      .filter(([, v]) => v.severity === "high" || v.severity === "critical")
      .map(([name, v]) => `${name}: ${v.via.map((x) => (typeof x === "string" ? `via ${x}` : x.title)).join("; ")} (${v.severity})`);
  };
}

function registryPublishTime(): (name: string, version: string) => Date | undefined {
  const cache = new Map<string, Record<string, string>>();
  return (name, version) => {
    if (!cache.has(name)) {
      try { cache.set(name, JSON.parse(runNpm(["view", name, "time", "--json"]))); }
      catch { cache.set(name, {}); }
    }
    const t = cache.get(name)![version];
    return t ? new Date(t) : undefined;
  };
}
