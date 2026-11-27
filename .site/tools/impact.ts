/**
 * TOOL-05 Impact analyzer (plan/tools.md#tool-05-impact-analyzer): for changed paths, the features
 * whose frontmatter `paths` match them, the modules whose `- Paths:` lines match them, the
 * requirements those features hold and those modules serve, the tasks that change the paths or
 * deliver those criteria, and the test files tagged `@req` with those criteria. A change whose
 * paths belong to more than one feature gets a cross-feature warning, for a change request to explain.
 *
 * Reads the plan through `loadPlan()` and `parseFrontmatter()` (plan.ts) and the spec and tags
 * through `loadSpecIndex()` (check.ts). Paths are repository-relative with `/` separators.
 * A feature's `paths` may be written relative to `.site/` (`src/features/x/**`) or to the root.
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadSpecIndex } from "./check.ts";
import { loadPlan, parseFrontmatter } from "./plan.ts";

/** What one changed path belongs to. */
export type PathImpact = { path: string; features: string[]; modules: string[] };

export type ImpactReport = {
  paths: PathImpact[];
  features: string[];
  modules: string[];
  requirements: string[];
  /** Task IDs with their status, e.g. `T-01.08 (done)`. */
  tasks: string[];
  /** Test files tagged `@req` with any impacted criterion. */
  tests: string[];
  /** Plain sentences: the cross-feature warning, and paths no feature or module claims. */
  warnings: string[];
};

/** Analyzes `paths` (repository-relative) against the spec and plan under `root`. */
export function impact(root: string, paths: string[]): ImpactReport {
  const spec = loadSpecIndex(root);
  const plan = loadPlan(root);
  const features = loadFeatures(root);
  const modules = loadModules(root);
  const changed = paths.map((p) => p.replace(/\\/g, "/").replace(/^\.\//, ""));

  // A folder stands for what's in it: `book` (or `book/`) matches `book/**` as a file inside it would.
  const forms = (path: string) => [path, `${path.replace(/\/$/, "")}/x`];
  const claims = (globs: string[], path: string) =>
    forms(path).some((p) => globs.some((g) => matches(g, p) || (p.startsWith(".site/") && matches(g, p.slice(6)))));
  const perPath = changed.map((path) => ({
    path,
    features: features.filter((ft) => claims(ft.paths, path)).map((ft) => ft.id),
    modules: modules.filter((m) => claims(m.paths, path)).map((m) => m.id),
  }));
  const featureIds = unique(perPath.flatMap((p) => p.features));
  const moduleIds = unique(perPath.flatMap((p) => p.modules));

  // Criteria: every active criterion of the features' requirements, and those the modules serve (all, or the ACs named).
  const criteria = new Set<string>();
  const reqs = new Set<string>();
  const active = spec.requirements.filter((r) => !r.deferred);
  for (const ft of features.filter((x) => featureIds.includes(x.id)))
    for (const r of active.filter((x) => x.file === ft.file)) {
      reqs.add(r.id);
      r.criteria.forEach((c) => criteria.add(c));
    }
  for (const m of modules.filter((x) => moduleIds.includes(x.id)))
    for (const s of m.serves) {
      const r = active.find((x) => x.id === s.id);
      if (!r) continue;
      reqs.add(r.id);
      r.criteria
        .filter((c) => !s.criteria.length || s.criteria.includes(c.slice(r.id.length + 1)))
        .forEach((c) => criteria.add(c));
    }

  const tasks = plan.packets
    .filter((p) => {
      const files = Array.isArray(p.fields.files) ? p.fields.files : [];
      const delivers = Array.isArray(p.fields.delivers) ? p.fields.delivers : [];
      return files.some((g) => changed.some((c) => matches(g, c))) || delivers.some((d) => criteria.has(d));
    })
    .map((p) => `${p.id} (${p.status})`);
  const tests = unique([...criteria].flatMap((c) => spec.tags.get(c) ?? []));

  const warnings: string[] = [];
  if (featureIds.length > 1) {
    const where = featureIds.map(
      (id) =>
        `${id}: ${perPath
          .filter((p) => p.features.includes(id))
          .map((p) => p.path)
          .join(", ")}`,
    );
    warnings.push(
      `This change crosses feature boundaries (${featureIds.join(", ")}): ${where.join("; ")}. Explain why in the change request, or split it.`,
    );
  }
  for (const p of perPath)
    if (!p.features.length && !p.modules.length) warnings.push(`${p.path} belongs to no feature and no module.`);

  return {
    paths: perPath,
    features: featureIds,
    modules: moduleIds,
    requirements: sortIds([...reqs]),
    tasks,
    tests,
    warnings,
  };
}

/** The report as the CLI prints it: one block per path, then the totals, then warnings. */
export function formatImpact(r: ImpactReport): string {
  const list = (items: string[]) => (items.length ? items.join(", ") : "none");
  return [
    `Impact of ${r.paths.length} path(s):`,
    ...r.paths.map((p) => `  ${p.path}: ${list([...p.features, ...p.modules])}`),
    `Features: ${list(r.features)}`,
    `Modules: ${list(r.modules)}`,
    `Requirements: ${list(r.requirements)}`,
    `Tasks: ${list(r.tasks)}`,
    `Tests tagged @req: ${list(r.tests)}`,
    ...r.warnings.map((w) => `Warning: ${w}`),
  ].join("\n");
}

/** `**` matches any run of characters (folders included), `*` any within one folder; the rest is literal. */
export function matches(glob: string, path: string): boolean {
  const re = glob
    .trim()
    .split(/(\*\*\/?|\*)/)
    .map((part) =>
      part === "**/" || part === "**" ? ".*" : part === "*" ? "[^/]*" : part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"),
    )
    .join("");
  return new RegExp(`^${re}$`).test(path);
}

// ---------- internals ----------

type Feature = { id: string; file: string; paths: string[] };
type Module = { id: string; paths: string[]; serves: { id: string; criteria: string[] }[] };

/** Every specs/features/*.md file's `id` and `paths`, from its frontmatter. */
function loadFeatures(root: string): Feature[] {
  const dir = join(root, "specs/features");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .sort()
    .map((f) => {
      const fields = parseFrontmatter(readFileSync(join(dir, f), "utf8"));
      return {
        id: String(fields.id ?? f),
        file: `specs/features/${f}`,
        paths: Array.isArray(fields.paths) ? fields.paths : [],
      };
    });
}

/** Every `## MOD-…` entry in specs/modules.md: its `- Paths:` globs (notes in brackets dropped) and `- Serves:` IDs. */
function loadModules(root: string): Module[] {
  const file = join(root, "specs/modules.md");
  const text = existsSync(file) ? readFileSync(file, "utf8").replace(/\r\n/g, "\n") : "";
  return text
    .split(/^(?=## MOD-)/m)
    .slice(1)
    .map((section) => {
      const id = /^## (MOD-[\w-]+)/.exec(section)![1]!;
      const line = (key: string) => new RegExp(`^- ${key}:\\s*(.*)$`, "m").exec(section)?.[1] ?? "";
      const paths = line("Paths")
        .split(",")
        .map((p) => p.replace(/\(.*?\)/g, "").trim())
        .filter(Boolean);
      const serves = [...line("Serves").matchAll(/(REQ-[A-Z]+-\d+)(?:\s*\(([^)]*)\))?/g)].map((m) => ({
        id: m[1]!,
        criteria: m[2]?.match(/AC\d+/g) ?? [],
      }));
      return { id, paths, serves };
    });
}

function unique(items: string[]): string[] {
  return [...new Set(items)].sort();
}

function sortIds(ids: string[]): string[] {
  return ids.sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}
