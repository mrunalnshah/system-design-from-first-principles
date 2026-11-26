/**
 * Which Astro command is running, and a fresh identity for each run (MOD-site). Set by `buildReport()` when Astro
 * reads its config, so every module can tell a build from `astro dev`, `check` or `sync` without guessing from the
 * command line, and can key its per-build caches by the run, so two builds in one process never share them.
 * Kept on `globalThis` because Astro loads the config and the content loader in separate module graphs.
 */

/** One run of Astro. `command` is Astro's own: "build", "dev", "preview" or "sync" (`astro check` syncs). */
export type BuildRun = { readonly id: object; readonly command: string };

const KEY = Symbol.for("sdfp.buildRun");
const shared = globalThis as typeof globalThis & { [KEY]?: BuildRun };

/** Starts a new run: called once per Astro start, from the build report's `astro:config:setup` hook. */
export function startBuildRun(command: string): BuildRun {
  return (shared[KEY] = { id: {}, command });
}

/** The current run. Outside Astro (unit tests, tools) it's a plain run with the command "test". */
export function buildRun(): BuildRun {
  return (shared[KEY] ??= { id: {}, command: "test" });
}
