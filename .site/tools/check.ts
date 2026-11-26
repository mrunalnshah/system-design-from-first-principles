/**
 * TOOL-03 Plan checker (plan/tools.md): turns the plan's promises into checks, so drift is
 * caught in CI instead of at review. Reads the spec (specs/features, specs/modules.md,
 * specs/product.md, plan/tools.md, specs/conflicts.md, specs/intake.md), the plan
 * (plan/tasks, plan/rounds.md) and the `@req` tags in `.site/` test and source files.
 *
 * Problems are plain sentences that name the file or ID to fix; the checker never changes anything.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadPlan, type Packet } from "./plan.ts";

export type CheckResult = { ok: boolean; problems: string[] };

/** One requirement from specs/features: its criteria, and whether it's deferred (kept only so its ID isn't reused). */
export type Requirement = { id: string; title: string; deferred: boolean; criteria: string[]; file: string };

/** Everything the plan can deliver or be traced to, read once from the spec. */
export type SpecIndex = {
  requirements: Requirement[];
  /** Active REQ criteria, NFR IDs and TOOL criteria: the IDs a task may deliver or a test may tag. */
  known: Set<string>;
  /** REQ IDs listed under `- Serves:` in specs/modules.md. */
  served: Set<string>;
  /** `@req` tags found in `.site/` test files (outside node_modules, build output and test fixtures): criterion → files. */
  tags: Map<string, string[]>;
};

/** Reads the spec and the `@req` tags under `root`. Shared by `check` and `trace`. */
export function loadSpecIndex(root: string): SpecIndex {
  const requirements: Requirement[] = [];
  const featuresDir = join(root, "specs/features");
  if (!existsSync(featuresDir)) throw new Error(`No specs/features folder under ${root}: the plan checker needs the feature specs.`);
  for (const f of readdirSync(featuresDir).filter((x) => x.endsWith(".md")).sort()) {
    const text = readText(join(featuresDir, f));
    for (const section of text.split(/^(?=### REQ-)/m).slice(1)) {
      const head = /^### (REQ-[A-Z]+-\d+)\s*(.*)$/m.exec(section);
      if (!head) continue;
      const id = head[1]!;
      const criteria = [...section.matchAll(new RegExp(`^- (${id}\\.AC\\d+):`, "gm"))].map((m) => m[1]!);
      requirements.push({ id, title: head[2]!.trim(), deferred: /\(deferred\)/.test(head[2]!), criteria, file: `specs/features/${f}` });
    }
  }
  const known = new Set<string>();
  for (const r of requirements) if (!r.deferred) r.criteria.forEach((c) => known.add(c));
  for (const m of readText(join(root, "specs/product.md")).matchAll(/^\| (NFR-\d+) \|/gm)) known.add(m[1]!);
  for (const m of readText(join(root, "plan/tools.md")).matchAll(/^\s+- (TOOL-\d+\.AC\d+):/gm)) known.add(m[1]!);
  const served = new Set<string>();
  for (const m of readText(join(root, "specs/modules.md")).matchAll(/^- Serves: (.*)$/gm)) for (const id of m[1]!.match(/REQ-[A-Z]+-\d+/g) ?? []) served.add(id);
  return { requirements, known, served, tags: scanTags(root) };
}

/** Runs every check in plan/tools.md#tool-03-plan-checker. `ok` is true only when `problems` is empty. */
export function check(root: string): CheckResult {
  const spec = loadSpecIndex(root);
  const plan = loadPlan(root);
  const problems: string[] = [];
  const add = (p: string) => problems.push(p);
  const byId = new Map(plan.packets.map((p) => [p.id, p]));

  // Requirements: criteria, a module, a task.
  const delivered = new Set(plan.packets.flatMap((p) => list(p, "delivers")));
  for (const r of spec.requirements.filter((x) => !x.deferred)) {
    if (!r.criteria.length) add(`${r.id} (${r.file}) has no acceptance criteria.`);
    if (!spec.served.has(r.id)) add(`${r.id} is served by no module: add it to a "- Serves:" line in specs/modules.md.`);
    for (const c of r.criteria) if (!delivered.has(c)) add(`${c} is delivered by no task.`);
  }
  for (const id of spec.known) if (/^TOOL-/.test(id) && !delivered.has(id)) add(`${id} is delivered by no task.`);

  // Tasks: known IDs, dependencies, sections, size and points.
  for (const p of plan.packets) {
    const size = String(p.fields.size ?? "");
    const files = list(p, "files");
    for (const d of list(p, "delivers")) if (!spec.known.has(d)) add(`${p.id} delivers ${d}, which isn't a known criterion, NFR or tool criterion.`);
    for (const d of p.dependsOn) if (!byId.has(d)) add(`${p.id} depends on ${d}, which doesn't exist.`);
    const body = readText(join(root, p.path));
    for (const s of REQUIRED_SECTIONS) if (!new RegExp(`^## ${s}\\s*$`, "m").test(body)) add(`${p.id} (${p.path}) is missing its "## ${s}" section.`);
    if (size !== "S" && size !== "M") add(`${p.id} has size ${size || "(none)"}: tasks must be S or M; split anything larger.`);
    else {
      const allowed = size === "S" ? [1, 2] : [3, 5];
      if (!allowed.includes(p.points)) add(`${p.id} has ${p.points} points, which doesn't match size ${size} (${allowed.join(" or ")}).`);
      const maxFiles = size === "S" ? 3 : 6;
      if (files.length > maxFiles) add(`${p.id} changes ${files.length} files, more than size ${size} allows (${maxFiles}).`);
    }
    if (!CARE_LEVELS.includes(careOf(p))) add(`${p.id} has care "${p.care}": it must be quick, standard or careful.`);
    if (careOf(p) === "careful" && (p.points < 3 || size !== "M")) add(`${p.id} is Careful but sized ${size}/${p.points}: Careful tasks are M with at least 3 points.`);
  }
  for (const cycle of findCycles(plan.packets)) add(`Dependency cycle: ${cycle.join(" → ")}.`);

  // Done tasks: every delivered criterion has a tagged test.
  for (const p of plan.packets.filter((x) => x.status === "done"))
    for (const d of list(p, "delivers")) if (spec.known.has(d) && !spec.tags.has(d)) add(`${d} has no test tagged @req, but ${p.id} is done.`);
  for (const [tag, files] of spec.tags) if (!spec.known.has(tag)) add(`@req ${tag} in ${files.join(", ")} names no known criterion.`);

  // Rounds: budget, Careful rule, membership, order.
  const rounds = readText(join(root, "plan/rounds.md"));
  const budget = Number(/Round budget:\s*(\d+)\s*points/.exec(rounds)?.[1] ?? NaN);
  if (!Number.isFinite(budget)) add('plan/rounds.md has no "Round budget: N points" line.');
  const roundOf = new Map<string, string>();
  plan.rounds.forEach((r, index) => {
    const tasks = r.tasks.map((id) => byId.get(id));
    r.tasks.forEach((id, i) => {
      if (!tasks[i]) add(`${r.id} lists ${id}, which doesn't exist.`);
      else if (roundOf.has(id)) add(`${id} is listed in both ${roundOf.get(id)} and ${r.id}.`);
      else roundOf.set(id, r.id);
    });
    const real = tasks.filter((t): t is Packet => !!t);
    const points = real.reduce((s, t) => s + t.points, 0);
    if (points !== r.points) add(`${r.id} lists ${r.points} points, but its tasks add up to ${points}.`);
    // A finished round was planned under the budget of its day; recalibration only regroups rounds not yet done.
    const finished = real.length > 0 && real.every((t) => t.status === "done");
    if (Number.isFinite(budget) && points > budget && !finished) add(`${r.id} has ${points} points, over the round budget of ${budget}.`);
    const careful = real.filter((t) => careOf(t) === "careful");
    if (careful.length > 1) add(`${r.id} has ${careful.length} Careful tasks; a round may hold at most one.`);
    if (careful.length && real[0] !== careful[0]) add(`${r.id}: Careful task ${careful[0]!.id} isn't first in its round.`);
    for (const t of real) for (const d of t.dependsOn) {
      const depRound = plan.rounds.findIndex((x) => x.tasks.includes(d));
      if (depRound > index || (depRound === index && r.tasks.indexOf(d) > r.tasks.indexOf(t.id))) add(`${t.id} (${r.id}) comes before its dependency ${d}.`);
    }
  });
  for (const p of plan.packets) {
    const r = roundOf.get(p.id);
    if (!r) add(`${p.id} isn't in any round in plan/rounds.md.`);
    else if (r !== p.round) add(`${p.id} says round ${p.round}, but plan/rounds.md lists it in ${r}.`);
  }

  // Conflicts and the coverage map.
  for (const section of readText(join(root, "specs/conflicts.md")).split(/^(?=### CNF-)/m).slice(1)) {
    const id = /^### (CNF-\d+)/.exec(section)?.[1] ?? "(unnamed conflict)";
    const type = /^- Type:\s*(.+)$/m.exec(section)?.[1]?.trim();
    const status = /^- Status:\s*(\w+)/m.exec(section)?.[1];
    const decision = /^- Decision:\s*(.+)$/m.exec(section)?.[1]?.trim();
    if (!type) add(`${id} in specs/conflicts.md has no Type.`);
    if (!status || status.toLowerCase() === "open") add(`${id} in specs/conflicts.md is still open.`);
    if (!decision || /^pending\b/i.test(decision)) add(`${id} in specs/conflicts.md has no recorded decision.`);
  }
  const coverage = /## Coverage map\s*\n([\s\S]*?)(?:\n## |\n?$)/.exec(readText(join(root, "specs/intake.md")))?.[1] ?? "";
  for (const row of coverage.split("\n").slice(2)) {
    const cells = row.split("|").map((c) => c.trim());
    if (cells.length > 3 && /^open\b/i.test(cells[2]!)) add(`Coverage-map topic "${cells[1]}" in specs/intake.md is still open.`);
  }

  return { ok: problems.length === 0, problems };
}

// ---------- internals ----------

const REQUIRED_SECTIONS = ["Goal", "Interface to honour", "Acceptance tests", "Steps", "Verify", "Done when", "Out of scope"];
const CARE_LEVELS = ["quick", "standard", "careful"];

/** Care levels are compared case-insensitively, so `Careful` (as rounds.md spells it) can't slip past the Careful rules. */
function careOf(p: Packet): string {
  return p.care.toLowerCase();
}

/** Folders under `.site/` that never hold real tags: dependencies, build output, and test fixtures (which seed fake ones). */
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro"]);

function scanTags(root: string): Map<string, string[]> {
  const tags = new Map<string, string[]>();
  const site = join(root, ".site");
  const walk = (dir: string, rel: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name), relPath = rel ? `${rel}/${name}` : name;
      if (statSync(path).isDirectory()) {
        if (!SKIP_DIRS.has(name) && relPath !== "tests/fixtures") walk(path, relPath);
      } else if (/\.(test|spec)\.(ts|tsx|js|mjs)$/.test(name) || (/^tests\//.test(relPath) && /\.(ts|tsx|js|mjs)$/.test(name))) {
        // Only tests are evidence: `*.test.*` / `*.spec.*` files anywhere, or code under .site/tests/.
        for (const m of readText(path).matchAll(/@req\s+([A-Z][\w.-]*[\w])/g)) {
          const files = tags.get(m[1]!) ?? [];
          if (!files.includes(`.site/${relPath}`)) files.push(`.site/${relPath}`);
          tags.set(m[1]!, files);
        }
      }
    }
  };
  if (existsSync(site)) walk(site, "");
  return tags;
}

/** Each dependency cycle once, as the list of task IDs around it (first ID repeated at the end). */
function findCycles(packets: Packet[]): string[][] {
  const deps = new Map(packets.map((p) => [p.id, p.dependsOn]));
  const state = new Map<string, "visiting" | "done">();
  const cycles: string[][] = [];
  const visit = (id: string, path: string[]) => {
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") { cycles.push([...path.slice(path.indexOf(id)), id]); return; }
    state.set(id, "visiting");
    for (const d of deps.get(id) ?? []) if (deps.has(d)) visit(d, [...path, id]);
    state.set(id, "done");
  };
  for (const id of deps.keys()) visit(id, []);
  return cycles;
}

function list(p: Packet, key: string): string[] {
  const v = p.fields[key];
  return Array.isArray(v) ? v : [];
}

function readText(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8").replace(/\r\n/g, "\n") : "";
}
