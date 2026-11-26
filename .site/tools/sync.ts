/**
 * Sync (REQ-AUTH-001, REQ-AUTH-002, CR-0005): the author's one-step publish.
 *
 *   1. pull new commits from GitHub (fast-forward only)
 *   2. move Excalidraw's exports into each part's diagram/ folder
 *   3. check every drawing has current light and dark images
 *   4. build the site
 *   5. show what changed and ask for a one-line message
 *   6. commit (the pre-commit hook still scans for secrets) and push to main
 *
 * It stops before committing at the first problem, with a message that says what to do. The only
 * change it makes in the vault is moving exported images; it never edits chapter text.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

export type RunResult = { status: number; stdout: string; stderr: string };

export type SyncOptions = {
  /** Repository root (the vault). */
  root: string;
  /** Asks the author a question and returns the answer (a line typed in the window). */
  ask(question: string): Promise<string>;
  /** Prints one line for the author. */
  log(line: string): void;
  /** Builds the site and reports how it went. Defaults to `npm run build` in `.site/`. */
  build?: () => RunResult;
  /** Today's date, for the default commit message. */
  now?: Date;
};

export type SyncResult = { ok: boolean; committed?: string };

/** A drawing whose images can't be published, and what to do about it. */
export type DrawingProblem = { drawing: string; problem: string };

/** Runs the whole sync. Never throws for expected problems: they're logged and `ok` is false. */
export async function sync(opts: SyncOptions): Promise<SyncResult> {
  const { root, log } = opts;
  const git = (...args: string[]) => run("git", ["-C", root, ...args], root);
  const stop = (...lines: string[]): SyncResult => {
    lines.forEach((l) => log(l));
    log("Nothing was committed or pushed. Fix the above, then run sync again.");
    return { ok: false };
  };

  // 0. Only ever publish from main.
  const branch = git("rev-parse", "--abbrev-ref", "HEAD").stdout.trim();
  if (branch !== "main") return stop(`Sync publishes from the main branch, but this folder is on "${branch}". Ask the AI agent to help switch back.`);

  // 1. Pull what's new on GitHub (merged updates, edits made on github.com), fast-forward only.
  log("Checking GitHub for new changes…");
  const fetched = git("fetch", "--quiet", "origin", "main");
  if (fetched.status !== 0) return stop("Couldn't reach GitHub to check for new changes:", fetched.stderr.trim(), "Check your internet connection.");
  const behind = git("rev-list", "--count", "HEAD..origin/main").stdout.trim();
  if (behind !== "0") {
    const pulled = git("merge", "--ff-only", "--quiet", "origin/main");
    if (pulled.status !== 0)
      return stop(
        "GitHub has changes that can't combine automatically with the ones on this computer (both sides have new commits, or the same file changed).",
        pulled.stderr.trim(),
        "Ask the AI agent: \"sync says it can't combine the changes from GitHub; please help\".",
      );
    log(`Pulled ${behind} new change(s) from GitHub.`);
  }

  // 2–3. Collect diagram images, then make sure every drawing has current light and dark images.
  const moved = collectDiagramImages(root);
  if (moved.length) log(`Collected ${moved.length} diagram image(s) into diagram/ folders.`);
  const problems = staleDrawings(root);
  if (problems.length) return stop("These drawings can't be published yet:", ...problems.map((p) => `  - ${p.drawing}: ${p.problem}`));

  // 4. Build the site exactly as GitHub will.
  log("Building the site…");
  const built = (opts.build ?? (() => npmBuild(root)))();
  if (built.status !== 0) return stop("The site doesn't build:", tail(built.stdout + "\n" + built.stderr));

  // 5. What would be published?
  const changes = git("status", "--porcelain").stdout.split(/\r?\n/).filter(Boolean);
  if (!changes.length) { log("Nothing new to publish."); return { ok: true }; }
  log(`Ready to publish ${changes.length} change(s):`);
  changes.slice(0, 30).forEach((c) => log(`  ${describe(c)}`));
  if (changes.length > 30) log(`  … and ${changes.length - 30} more`);
  const fallback = `Update ${(opts.now ?? new Date()).toISOString().slice(0, 10)}`;
  const answer = (await opts.ask(`One-line message for this update (Enter for "${fallback}", or type cancel): `)).trim();
  if (answer.toLowerCase() === "cancel") return stop("Cancelled.");
  const message = answer || fallback;

  // 6. Commit (the pre-commit hook still runs) and push.
  if (git("add", "-A").status !== 0) return stop("Couldn't stage the changes.");
  const committed = git("commit", "-q", "-m", message);
  if (committed.status !== 0) {
    git("reset", "-q");
    return stop("The commit was refused:", tail(committed.stdout + "\n" + committed.stderr));
  }
  const pushed = git("push", "--quiet", "origin", "HEAD:main");
  if (pushed.status !== 0) {
    log(`Committed "${message}" on this computer, but couldn't push it to GitHub:`, );
    log(tail(pushed.stderr));
    log("Run sync again when you're back online; it will push this commit.");
    return { ok: false, committed: message };
  }
  log(`Published "${message}".`);
  const links = linksFor(git("remote", "get-url", "origin").stdout.trim());
  if (links) {
    log(`Watch it build: ${links.actions}`);
    log(`Live in a few minutes at: ${links.site}`);
  }
  return { ok: true, committed: message };
}

/** Folders that hold drawings: every `part-*` folder, and `articles/`. */
function drawingHomes(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((d) => d.isDirectory() && (/^part-\d+_/.test(d.name) || d.name === "articles"))
    .map((d) => d.name);
}

/**
 * Moves every `<dir>/excalidraw/<name>.excalidraw.light.svg` and `.dark.svg` to
 * `<dir>/diagram/<name>-light.svg` / `-dark.svg` (replacing older copies), for `<dir>` = each
 * `part-*` folder and `articles/`. Returns the vault-relative paths written.
 */
export function collectDiagramImages(root: string): string[] {
  const written: string[] = [];
  for (const home of drawingHomes(root)) {
    const from = join(root, home, "excalidraw");
    if (!existsSync(from)) continue;
    for (const file of readdirSync(from)) {
      const m = /^(.+)\.excalidraw\.(light|dark)\.svg$/.exec(file);
      if (!m) continue;
      mkdirSync(join(root, home, "diagram"), { recursive: true });
      const target = `${home}/diagram/${m[1]}-${m[2]}.svg`;
      renameSync(join(from, file), join(root, target)); // keeps the export's time, used by staleDrawings
      written.push(target);
    }
  }
  return written;
}

/**
 * Every drawing (`<dir>/excalidraw/<name>.excalidraw.md`) whose images in `<dir>/diagram/` are
 * missing, one-sided, or older than the drawing itself (with a 2-second allowance for the
 * export finishing just after the save).
 */
export function staleDrawings(root: string): DrawingProblem[] {
  const SAVE = "open it in Obsidian and save it (Ctrl+S) so Excalidraw exports its light and dark images";
  const problems: DrawingProblem[] = [];
  for (const home of drawingHomes(root)) {
    const dir = join(root, home, "excalidraw");
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir)) {
      const m = /^(.+)\.excalidraw\.md$/.exec(file);
      if (!m) continue;
      const drawing = `${home}/excalidraw/${file}`;
      const drawn = statSync(join(dir, file)).mtimeMs;
      const image = (theme: string) => join(root, home, "diagram", `${m[1]}-${theme}.svg`);
      const has = { light: existsSync(image("light")), dark: existsSync(image("dark")) };
      if (!has.light && !has.dark) problems.push({ drawing, problem: `it has no images yet: ${SAVE}.` });
      else if (!has.light || !has.dark) problems.push({ drawing, problem: `its ${has.light ? "dark" : "light"} image is missing: ${SAVE}.` });
      else if (Math.min(statSync(image("light")).mtimeMs, statSync(image("dark")).mtimeMs) < drawn - 2000)
        problems.push({ drawing, problem: `it was changed after its images were exported: ${SAVE}.` });
    }
  }
  return problems;
}

/** The GitHub Actions page and the Pages address for a GitHub remote URL, or undefined for any other remote. */
export function linksFor(remoteUrl: string): { actions: string; site: string } | undefined {
  const m = /github\.com[/:]([^/]+)\/([^/]+?)(?:\.git)?\/?$/.exec(remoteUrl);
  if (!m) return undefined;
  const [, owner, repo] = m;
  return { actions: `https://github.com/${owner}/${repo}/actions`, site: `https://${owner!.toLowerCase()}.github.io/${repo}/` };
}

/** `git status --porcelain` line → "new: …", "changed: …", "removed: …". */
function describe(line: string): string {
  const code = line.slice(0, 2), path = line.slice(3).replace(/^"|"$/g, "");
  if (code.includes("?") || code.includes("A")) return `new:     ${path}`;
  if (code.includes("D")) return `removed: ${path}`;
  if (code.includes("R")) return `renamed: ${path}`;
  return `changed: ${path}`;
}

function tail(text: string, lines = 40): string {
  return text.trim().split(/\r?\n/).slice(-lines).join("\n");
}

/** `npm run build` in .site/, without a shell (npm's own script via npm_execpath, as in tools/audit.ts). */
function npmBuild(root: string): RunResult {
  const cli = process.env.npm_execpath;
  const site = join(root, ".site");
  if (cli && /\.c?js$/.test(cli)) return run(process.execPath, [cli, "run", "build"], site);
  if (process.platform === "win32") return { status: 1, stdout: "", stderr: "Run sync through sync.cmd or `npm --prefix .site run sync`, so npm can be found." };
  return run("npm", ["run", "build"], site);
}

export function run(cmd: string, args: string[], cwd: string): RunResult {
  const r = spawnSync(cmd, args, { cwd, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  return { status: r.status ?? 1, stdout: r.stdout ?? "", stderr: (r.stderr ?? "") + (r.error ? String(r.error) : "") };
}
