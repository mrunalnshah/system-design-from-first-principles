/**
 * Entry point for the project tools (plan/tools.md): `npm --prefix .site run tools -- <command> [args]`.
 * Runs on Node's built-in TypeScript support (CR-0001), so this file uses erasable syntax only.
 *
 * Commands: `status`, `next`, `done <task>`, `pack <task-or-round> [--out FILE]`, `check`, `trace`.
 * Returns the process exit code; never calls process.exit, so tests can call `main()` directly.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { check } from "./check.ts";
import { pack } from "./pack.ts";
import { formatGroup, loadPlan, markDone, nextTasks, statusReport } from "./plan.ts";
import { trace } from "./trace.ts";

/** Where output goes; `console` in real use, a collector in tests. */
export type Io = { log(text: string): void; error(text: string): void };

/** The repository root: two folders up from `.site/tools/`. */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const USAGE = "Usage: tools <command>\n  status         phase, gates, task counts, open conflicts, next tasks, recent progress\n  next           tasks whose dependencies are done, by round\n  done <task>    mark a task done and log it\n  pack <task-or-round> [--out FILE]\n                 bundle what a task or round needs; prints it, or writes FILE\n  check          check the plan's consistency; exits 1 on any problem\n  trace          write specs/trace.md (criterion → task → tagged tests)";

/**
 * Runs one tool command against the plan under `root` and returns its exit code:
 * 0 success, 1 a failed command (message on `io.error`, e.g. "Unknown task: T-99.99"), 2 usage error.
 */
export function main(argv: string[], root: string = repoRoot, io: Io = console): number {
  const [command, ...args] = argv;
  try {
    switch (command) {
      case "status":
        io.log(statusReport(loadPlan(root)));
        return 0;
      case "next": {
        const groups = nextTasks(loadPlan(root));
        io.log(groups.length ? groups.flatMap(formatGroup).join("\n") : "Nothing is ready: every task is done or waiting on a dependency.");
        return 0;
      }
      case "done":
        if (!args[0]) throw new Error("done needs a task ID, e.g. done T-00.02");
        markDone(root, args[0]);
        io.log(`${args[0]} marked done.`);
        return 0;
      case "pack": {
        const target = args[0];
        if (!target || target.startsWith("--")) throw new Error("pack needs a task or round ID, e.g. pack R-02");
        const outAt = args.indexOf("--out");
        const outArg = outAt >= 0 ? args[outAt + 1] : undefined;
        if (outAt >= 0 && !outArg) throw new Error("--out needs a file name");
        // `npm --prefix .site` runs inside .site/; INIT_CWD is the folder the user typed the command in.
        const out = outArg ? resolve(process.env.INIT_CWD ?? process.cwd(), outArg) : undefined;
        const result = pack(target, { root, out });
        // The bundle goes to stdout only when no file was asked for, so it can be piped cleanly.
        if (!out) io.log(result.text);
        io.error(`${out ? `Wrote ${out}: ` : ""}about ${result.tokens} tokens`);
        result.warnings.forEach((w) => io.error(`Warning: ${w}`));
        return 0;
      }
      case "check": {
        const result = check(root);
        if (result.ok) {
          const plan = loadPlan(root);
          io.log(`Plan check passed: ${plan.packets.length} tasks in ${plan.rounds.length} rounds.`);
          return 0;
        }
        io.error(`Plan check found ${result.problems.length} problem(s):\n` + result.problems.map((p) => `  - ${p}`).join("\n"));
        return 1;
      }
      case "trace":
        trace(root);
        io.log("Wrote specs/trace.md");
        return 0;
      default:
        io.error(USAGE);
        return 2;
    }
  } catch (e) {
    io.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = main(process.argv.slice(2));
}
