/**
 * Entry point for the project tools (plan/tools.md): `npm --prefix .site run tools -- <command> [args]`.
 * Runs on Node's built-in TypeScript support (CR-0001), so this file uses erasable syntax only.
 *
 * Commands: `status`, `next`, `done <task>`, `pack <task-or-round> [--out FILE]`, `check`, `trace`,
 * `audit [--base <git-ref>] [--sbom FILE]`, `sync`, `tokens`, `contrast`, `size [--dist DIR]`, `links [--dist DIR]`,
 * `lighthouse`, `map [path] [--budget N]`, `impact <paths…>`, `gen-vault <dir> --chapters N --articles M`.
 * Returns the process exit code; never calls process.exit, so tests can call `main()` directly.
 */
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { checkContrast, findRawColours, formatRatio, MIN_RATIO } from "./contrast.ts";
import { sync } from "./sync.ts";
import { buildTokens, TOKENS_CSS } from "./tokens.ts";
import { audit, baseLockfileFor, lockfileChangedAt } from "./audit.ts";
import { check } from "./check.ts";
import { pack } from "./pack.ts";
import { formatGroup, loadPlan, markDone, nextTasks, statusReport } from "./plan.ts";
import { trace } from "./trace.ts";
import { formatSizes, measureSite } from "./size.ts";
import { checkLinks, sitePath } from "./links.ts";
import { runLighthouse } from "./lighthouse.ts";
import { codeMap } from "./map.ts";
import { formatImpact, impact } from "./impact.ts";
import { generateVault } from "./gen-vault.ts";

/** Where output goes; `console` in real use, a collector in tests. */
export type Io = { log(text: string): void; error(text: string): void };

/** The repository root: two folders up from `.site/tools/`. */
export const repoRoot = fileURLToPath(new URL("../../", import.meta.url));

const USAGE = "Usage: tools <command>\n  status         phase, gates, task counts, open conflicts, next tasks, recent progress\n  next           tasks whose dependencies are done, by round\n  done <task>    mark a task done and log it\n  pack <task-or-round> [--out FILE]\n                 bundle what a task or round needs; prints it, or writes FILE\n  check          check the plan's consistency; exits 1 on any problem\n  trace          write specs/trace.md (criterion → task → tagged tests)\n  audit [--base <git-ref>] [--sbom FILE]\n                 vulnerabilities, 7-day cooldown for entries changed since <git-ref>, licences\n  sync           publish: collect diagram images, check, build, commit and push (sync.cmd)\n  tokens         write .site/src/features/site/tokens.css from design/tokens.json\n  contrast       WCAG contrast of every token pair, and no raw colours outside tokens.css\n  size [--dist DIR]\n                 compressed JS and HTML+CSS+fonts per built page against NFR-002\n  links [--dist DIR]\n                 base path on every internal address, and every internal link resolves\n  lighthouse     Lighthouse CI budgets on the built site (npm run test:lighthouse)\n  map [path] [--budget N]\n                 exported signatures (functions, types, component props) under path (default .site/src), cut to N tokens\n  impact <paths…>\n                 features, modules, requirements, tasks and tagged tests a change touches; warns across features\n  gen-vault <dir> --chapters N --articles M\n                 write a realistic vault of that size into an empty folder outside the repository, for timing the build (TOOL-16)";

/**
 * Runs one tool command against the plan under `root` and returns its exit code:
 * 0 success, 1 a failed command (message on `io.error`, e.g. "Unknown task: T-99.99"), 2 usage error.
 * `sync` asks the author a question, so it returns a promise; every other command is synchronous.
 */
export function main(argv: string[], root: string = repoRoot, io: Io = console): number | Promise<number> {
  const [command, ...args] = argv;
  if (command === "sync") return runSync(root, io);
  if (command === "links") return runLinks(root, args, io);
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
      case "audit": {
        const flag = (name: string): string | undefined => {
          if (!args.includes(name)) return undefined;
          const value = args[args.indexOf(name) + 1];
          if (!value || value.startsWith("--")) throw new Error(`${name} needs a value`);
          return value;
        };
        const base = flag("--base");
        const sbom = flag("--sbom");
        const result = audit({
          root,
          baseLockfile: base ? baseLockfileFor(root, base) : undefined,
          changedAt: lockfileChangedAt(root),
          sbomPath: sbom ? resolve(process.env.INIT_CWD ?? process.cwd(), sbom) : undefined,
        });
        result.notes.forEach((n) => io.log(n));
        if (result.ok) { io.log("Dependency audit passed."); return 0; }
        io.error(`Dependency audit found ${result.problems.length} problem(s):\n` + result.problems.map((p) => `  - ${p}`).join("\n"));
        return 1;
      }
      case "tokens": {
        const css = buildTokens(JSON.parse(readFileSync(join(root, "design/tokens.json"), "utf8")));
        writeFileSync(join(root, ".site", TOKENS_CSS), css);
        io.log(`Wrote .site/${TOKENS_CSS}`);
        return 0;
      }
      case "size": {
        const report = measureSite(distArg(root, args), sitePath(join(root, ".site")));
        formatSizes(report).forEach((l) => io.log(l));
        report.warnings.forEach((w) => io.log(`Warning: ${w}`));
        if (report.errors.length) {
          io.error("Build-size check failed:\n" + report.errors.map((e) => `  - ${e}`).join("\n"));
          return 1;
        }
        io.log(`Build-size check passed: ${report.pages.length} pages within NFR-002.`);
        return 0;
      }
      case "lighthouse":
        return runLighthouse(join(root, ".site"), io);
      case "map": {
        const at = args.indexOf("--budget");
        const budgetArg = at >= 0 ? args[at + 1] : undefined;
        if (at >= 0 && !/^[1-9]\d*$/.test(budgetArg ?? "")) throw new Error("--budget needs a whole number of tokens, e.g. --budget 500");
        const targets = args.filter((a, i) => !a.startsWith("--") && (at < 0 || i !== at + 1));
        if (targets.length > 1) throw new Error("map takes one path, e.g. map .site/src/features/book");
        const target = targets[0];
        const result = codeMap(target ? typedPath(target) : join(root, ".site/src"), { root, budget: budgetArg ? Number(budgetArg) : undefined });
        io.log(result.text.trimEnd());
        io.error(`about ${result.tokens} tokens${result.truncated ? `, cut to the budget of ${budgetArg}` : ""}`);
        return 0;
      }
      case "impact": {
        if (!args.length) throw new Error("impact needs one or more paths, e.g. impact .site/src/features/diagrams/pairs.ts");
        io.log(formatImpact(impact(root, args.map((a) => relative(root, typedPath(a)).replace(/\\/g, "/")))));
        return 0;
      }
      case "gen-vault": {
        const dir = args[0];
        if (!dir || dir.startsWith("--")) throw new Error("gen-vault needs a folder, e.g. gen-vault ../../vault-60 --chapters 60 --articles 100");
        const target = typedPath(dir);
        // Never inside the repository: the repository root is the author's vault, and sync commits everything in it.
        const rel = relative(root, target);
        if (!isAbsolute(rel) && rel !== ".." && !rel.startsWith(`..${sep}`)) throw new Error(`${dir} is inside the repository (the author's vault, which sync commits and pushes). Use a folder outside it, such as your temp folder or $RUNNER_TEMP in CI.`);
        const count = (flag: string) => {
          const at = args.indexOf(flag);
          return at < 0 ? NaN : Number(args[at + 1]);
        };
        const made = generateVault(target, { chapters: count("--chapters"), articles: count("--articles") });
        io.log(`Wrote ${made.chapters} chapters in ${made.parts} part${made.parts === 1 ? "" : "s"} and ${made.articles} articles (${made.files} files) to ${dir}.`);
        return 0;
      }
      case "contrast": {
        const result = checkContrast(JSON.parse(readFileSync(join(root, "design/tokens.json"), "utf8")));
        const raw = findRawColours(styleFiles(join(root, ".site")));
        for (const p of result.pairs.filter((x) => !x.ok)) io.error(`${p.theme}: ${p.foreground} on ${p.background} is ${formatRatio(p.ratio)}:1, below ${MIN_RATIO}:1 (WCAG 2.2 AA).`);
        for (const r of raw) io.error(`.site/${r.path}:${r.line}: raw colour ${r.value}; use a var(--color-…) from tokens.css (TOOL-08.AC3).`);
        if (!result.ok || raw.length) return 1;
        io.log(`Contrast passed: ${result.pairs.length} pairs, lowest ${formatRatio(result.lowest.ratio)}:1 (${result.lowest.theme} ${result.lowest.foreground} on ${result.lowest.background}); no raw colours.`);
        return 0;
      }
      default:
        io.error(USAGE);
        return 2;
    }
  } catch (e) {
    io.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

/** A path as the user typed it: `npm --prefix .site` runs inside .site/, and INIT_CWD is the folder they typed it in. */
function typedPath(path: string): string {
  return resolve(process.env.INIT_CWD ?? process.cwd(), path);
}

/** `--dist DIR` (from the folder the command was typed in), else `.site/dist`. */
function distArg(root: string, args: string[]): string {
  const at = args.indexOf("--dist");
  if (at < 0) return join(root, ".site", "dist");
  const value = args[at + 1];
  if (!value || value.startsWith("--")) throw new Error("--dist needs a folder");
  return resolve(process.env.INIT_CWD ?? process.cwd(), value);
}

/** TOOL-12: both link checks over the built site. */
async function runLinks(root: string, args: string[], io: Io): Promise<number> {
  try {
    const result = await checkLinks(join(root, ".site"), distArg(root, args));
    if (result.allowed.length) io.log(`Not built yet, allowed until they are (CR-0008): ${result.allowed.join(", ")}`);
    if (result.problems.length) {
      io.error(`Link check found ${result.problems.length} problem(s):\n` + result.problems.map((p) => `  - ${p.page}: ${p.address} ${p.problem}`).join("\n"));
      return 1;
    }
    io.log(`Link check passed: ${result.checked} internal addresses resolve, all under the base path.`);
    return 0;
  } catch (e) {
    io.error(e instanceof Error ? e.message : String(e));
    return 1;
  }
}

/** Every .css and .astro file under `<site>/src`, paths relative to `.site/`. */
function styleFiles(site: string): { path: string; text: string }[] {
  const out: { path: string; text: string }[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(css|astro)$/.test(name)) out.push({ path: relative(site, p).replace(/\\/g, "/"), text: readFileSync(p, "utf8") });
    }
  };
  walk(join(site, "src"));
  return out;
}

/** Sync with its question asked in the terminal window. */
async function runSync(root: string, io: Io): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  // Closing the window, Ctrl+C, or input that ends before an answer all mean "cancel": never a silent exit.
  const closed = new Promise<string>((resolve) => rl.once("close", () => resolve("cancel")));
  rl.on("SIGINT", () => rl.close());
  try {
    // `closed` goes first: if input has already ended, it has settled and wins over the rejected question.
    const result = await sync({ root, log: (l) => io.log(l), ask: (q) => Promise.race([closed, rl.question(q).catch(() => "cancel")]) });
    return result.ok ? 0 : 1;
  } catch (e) {
    io.error(`Sync stopped unexpectedly: ${e instanceof Error ? e.message : String(e)}`);
    return 1;
  } finally {
    rl.close();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const code = main(process.argv.slice(2));
  if (typeof code === "number") process.exitCode = code;
  else code.then((c) => (process.exitCode = c));
}
