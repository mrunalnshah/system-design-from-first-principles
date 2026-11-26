/**
 * The plan, as files: task packets (plan/tasks/*.md, template T9), the round table
 * (plan/rounds.md, template T10), project state (.blueprint/state.json) and the
 * progress log (.blueprint/progress.md). This module is the only code that knows
 * those formats; the tracker, the packer (TOOL-01) and the checker (TOOL-03) all
 * read the plan through `loadPlan()`.
 *
 * Paths are relative to the repository root (the Obsidian vault).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** A frontmatter value in the T9 subset: a string, number, boolean or list of strings. */
export type FrontValue = string | number | boolean | string[];

/** One task packet. `fields` keeps every frontmatter key; the typed ones are the ones tools rely on. An empty `id` is never loaded (it throws). */
export type Packet = {
  id: string;
  title: string;
  round: string;
  phase: number;
  points: number;
  care: string;
  dependsOn: string[];
  parallelSafe: boolean;
  status: string;
  /** Repository-relative path of the packet file. */
  path: string;
  fields: Record<string, FrontValue>;
};

/** One row of plan/rounds.md. `tasks` keeps the table's order, which is the order to work in. */
export type Round = { id: string; phase: number; goal: string; tasks: string[]; points: number; care: string; endsWith: string };

/** The whole plan as read from `root`: every packet (sorted by ID), the round table in order, and state.json as parsed JSON. */
export type Plan = { root: string; packets: Packet[]; rounds: Round[]; state: Record<string, unknown> };

/** Tasks that can start now (not done, every dependency done), grouped by round in round order. */
export type NextGroup = { round: string; tasks: { id: string; title: string; parallelSafe: boolean }[] };

/**
 * Parses the frontmatter subset used by the packets: `key: value` lines where a value is a
 * JSON-quoted string, `true`/`false`, a number, a `[a, b]` list or a bare string. Text after
 * ` #` in an unquoted value is a comment. List items may contain brackets (`[slug].astro`).
 */
export function parseFrontmatter(markdown: string): Record<string, FrontValue> {
  const block = frontmatterBlock(markdown);
  const fields: Record<string, FrontValue> = {};
  if (!block) return fields;
  for (const line of block.text.split("\n")) {
    const m = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (m) fields[m[1]!] = parseValue(m[2]!);
  }
  return fields;
}

/** Reads the whole plan from disk. Packets are sorted by ID. */
export function loadPlan(root: string): Plan {
  const tasksDir = join(root, "plan/tasks");
  const packets = readdirSync(tasksDir)
    .filter((f) => f.endsWith(".md")) // every packet file; bad IDs are the checker's to report (TOOL-03)
    .sort()
    .map((f) => toPacket(parseFrontmatter(readFileSync(join(tasksDir, f), "utf8")), `plan/tasks/${f}`));
  const rounds = parseRounds(readFileSync(join(root, "plan/rounds.md"), "utf8"));
  const state = JSON.parse(readFileSync(join(root, ".blueprint/state.json"), "utf8")) as Record<string, unknown>;
  return { root, packets, rounds, state };
}

/** Computes `next`: ready tasks grouped by round, rounds in plan order. */
export function nextTasks(plan: Plan): NextGroup[] {
  const done = new Set(plan.packets.filter((p) => p.status === "done").map((p) => p.id));
  const byId = new Map(plan.packets.map((p) => [p.id, p]));
  const groups: NextGroup[] = [];
  for (const round of plan.rounds) {
    const tasks = round.tasks
      .map((id) => byId.get(id))
      .filter((p): p is Packet => !!p && p.status !== "done" && p.dependsOn.every((d) => done.has(d)))
      .map((p) => ({ id: p.id, title: p.title, parallelSafe: p.parallelSafe }));
    if (tasks.length) groups.push({ round: round.id, tasks });
  }
  return groups;
}

/** A short human report: phase, gates, task counts, open conflicts, next tasks, last 5 progress lines. */
export function statusReport(plan: Plan): string {
  const next = nextTasks(plan);
  const firstOpen = plan.packets.find((p) => p.status !== "done");
  const counts = new Map<string, number>();
  for (const p of plan.packets) counts.set(p.status, (counts.get(p.status) ?? 0) + 1);
  const gates = (plan.state.gates ?? {}) as Record<string, string>;
  const conflicts = openConflicts(plan.root);
  const progress = readIfExists(join(plan.root, ".blueprint/progress.md")).trimEnd().split("\n").filter((l) => l && !l.startsWith("#"));
  return [
    `Phase: ${firstOpen ? firstOpen.phase : "all tasks done"}`,
    `Gates: ${Object.entries(gates).map(([g, s]) => `${g}: ${s}`).join(", ") || "none recorded"}`,
    `Tasks: ${[...counts].map(([s, n]) => `${s} ${n}`).join(", ")} (of ${plan.packets.length})`,
    `Open conflicts: ${conflicts.length ? conflicts.join(", ") : "none"}`,
    "Next:",
    ...(next.length ? next.slice(0, 2).flatMap(formatGroup) : ["  nothing is ready"]),
    "Recent progress:",
    ...progress.slice(-5).map((l) => `  ${l}`),
  ].join("\n");
}

/** One `next` group as indented lines; shared by `status` and the `next` command. */
export function formatGroup(g: NextGroup): string[] {
  return [`  ${g.round}:`, ...g.tasks.map((t) => `    ${t.id}  ${t.title}${t.parallelSafe ? "  (parallel-safe)" : ""}`)];
}

// ---------- internals ----------

/** The frontmatter text and the offset just past its closing `---` line. */
function frontmatterBlock(markdown: string): { text: string; end: number } | undefined {
  const m = /^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(markdown);
  return m ? { text: m[1]!.replace(/\r/g, ""), end: m[0].length } : undefined;
}

function parseValue(raw: string): FrontValue {
  const v = raw.trim();
  if (v.startsWith('"')) return JSON.parse(v.slice(0, closingQuote(v) + 1)) as string;
  const bare = v.replace(/\s+#.*$/, "").trim();
  if (bare.startsWith("[") && bare.endsWith("]")) {
    const inner = bare.slice(1, -1).trim();
    return inner ? inner.split(",").map((s) => s.trim()).filter(Boolean) : [];
  }
  if (bare === "true" || bare === "false") return bare === "true";
  if (/^-?\d+(\.\d+)?$/.test(bare)) return Number(bare);
  return bare;
}

/** Index of the quote that closes a JSON string starting at index 0. */
function closingQuote(v: string): number {
  for (let i = 1; i < v.length; i++) {
    if (v[i] === "\\") i++;
    else if (v[i] === '"') return i;
  }
  throw new Error(`Unterminated string in frontmatter: ${v}`);
}

function toPacket(f: Record<string, FrontValue>, path: string): Packet {
  const list = (v: FrontValue | undefined) => (Array.isArray(v) ? v : []);
  if (!f.id) throw new Error(`${path} has no readable frontmatter id: it must start with a '---' block containing 'id: T-xx.yy'`);
  return {
    id: String(f.id),
    title: String(f.title ?? ""),
    round: String(f.round ?? ""),
    phase: Number(f.phase ?? 0),
    points: Number(f.points ?? 0),
    care: String(f.care ?? ""),
    dependsOn: list(f.depends_on),
    parallelSafe: f.parallel_safe === true,
    status: String(f.status ?? ""),
    path,
    fields: f,
  };
}

function parseRounds(markdown: string): Round[] {
  const rows: Round[] = [];
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^\|\s*(R-\d+)\s*\|\s*(\d+)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(\d+)\s*\|\s*(\w+)\s*\|\s*(.*?)\s*\|\s*$/.exec(line);
    if (!m) continue;
    rows.push({ id: m[1]!, phase: Number(m[2]), goal: m[3]!, tasks: m[4]!.split(",").map((s) => s.trim()).filter(Boolean), points: Number(m[5]), care: m[6]!, endsWith: m[7]! });
  }
  return rows;
}

function openConflicts(root: string): string[] {
  const text = readIfExists(join(root, "specs/conflicts.md"));
  const open: string[] = [];
  for (const section of text.split(/^### /m).slice(1)) {
    const id = /^(CNF-\d+)/.exec(section)?.[1];
    if (id && /^- Status:\s*open\b/m.test(section)) open.push(id);
  }
  return open;
}

function readIfExists(path: string): string {
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

/** `2026-11-26T16:45Z`: the time format progress.md uses. */
function stamp(now: Date): string {
  return now.toISOString().slice(0, 16) + "Z";
}

/**
 * Marks a task done: sets `status: done` in its packet, appends
 * `<UTC time> · <round> · <task> · done` to progress.md, and records it as
 * `build.last_done` (and its round as `build.current_round`) in state.json.
 * Throws `Unknown task: <id>` when no packet has that ID.
 */
export function markDone(root: string, taskId: string, now: Date = new Date()): void {
  const packet = loadPlan(root).packets.find((p) => p.id === taskId);
  if (!packet) throw new Error(`Unknown task: ${taskId}`);

  // Every rewrite keeps the file's own line endings (the vault is edited on Windows: CRLF).
  const file = join(root, packet.path);
  const text = readFileSync(file, "utf8");
  const block = frontmatterBlock(text)!;
  const statusLine = /^status:[^\r\n]*/m;
  if (!statusLine.test(text.slice(0, block.end))) throw new Error(`${packet.path} has no 'status:' line in its frontmatter, so it can't be marked done`);
  writeFileSync(file, text.slice(0, block.end).replace(statusLine, "status: done") + text.slice(block.end));

  const progress = join(root, ".blueprint/progress.md");
  const existing = readIfExists(progress);
  const eol = lineEnding(existing);
  const sep = !existing || existing.endsWith("\n") ? "" : eol;
  writeFileSync(progress, existing + sep + `${stamp(now)} · ${packet.round} · ${taskId} · done` + eol);

  const statePath = join(root, ".blueprint/state.json");
  const raw = readFileSync(statePath, "utf8");
  const state = JSON.parse(raw) as { build?: Record<string, unknown> };
  state.build = { ...(state.build ?? {}), current_round: packet.round, last_done: taskId };
  const stateEol = lineEnding(raw);
  const json = JSON.stringify(state, null, 2).replace(/\n/g, stateEol);
  writeFileSync(statePath, json + (/\r?\n$/.test(raw) ? stateEol : ""));
}

/** The line ending a file already uses: CRLF if it has any, else LF. */
function lineEnding(text: string): string {
  return text.includes("\r\n") ? "\r\n" : "\n";
}
