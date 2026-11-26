/**
 * Entry point for the project tools (plan/tools.md): `npm --prefix .site run tools -- <command> [args]`.
 * Runs on Node's built-in TypeScript support (CR-0001), so this file uses erasable syntax only.
 *
 * Commands: `status`, `next`, `done <task>`. Returns the process exit code; never calls
 * process.exit, so tests can call `main()` directly.
 */
import { fileURLToPath } from "node:url";
import { formatGroup, loadPlan, markDone, nextTasks, statusReport } from "./plan.ts";

/** Where output goes; `console` in real use, a collector in tests. */
export type Io = { log(text: string): void; error(text: string): void };

/** The repository root: two folders up from `.site/tools/`. */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const USAGE = "Usage: tools <command>\n  status         phase, gates, task counts, open conflicts, next tasks, recent progress\n  next           tasks whose dependencies are done, by round\n  done <task>    mark a task done and log it";

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
