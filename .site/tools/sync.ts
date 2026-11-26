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
  if (branch === "HEAD") return stop("This folder isn't on any branch right now (a \"detached HEAD\"). Ask the AI agent to help get back to main.");
  if (branch !== "main") return stop(`Sync publishes from the main branch, but this folder is on "${branch}". Ask the AI agent to help switch back.`);

  // 1. Pull what's new on GitHub (merged updates, edits made on github.com), fast-forward only.
  log("Checking GitHub for new changes…");
  const fetched = git("fetch", "--quiet", "origin", "main");
  if (fetched.status !== 0)
    return stop("Couldn't get the latest changes from GitHub:", fetched.stderr.trim(), "Check your internet connection, and that you're signed in to GitHub on this computer.");
  const behind = git("rev-list", "--count", "HEAD..origin/main");
  if (behind.status !== 0) return stop("GitHub has no main branch to compare with. Ask the AI agent to check the repository.");
  if (behind.stdout.trim() !== "0") {
    const pulled = git("merge", "--ff-only", "--quiet", "origin/main");
    if (pulled.status !== 0)
      return stop(
        "GitHub has changes that can't combine automatically with the ones on this computer (both sides have new commits, or the same file changed).",
        pulled.stderr.trim(),
        "Ask the AI agent: \"sync says it can't combine the changes from GitHub; please help\".",
      );
    log(`Pulled ${behind.stdout.trim()} new change(s) from GitHub.`);
  }

  // 2–3. Collect diagram images, then make sure every drawing has current light and dark images.
  const collected = collectDiagramImages(root);
  if (collected.moved.length) log(`Collected ${collected.moved.length} diagram image(s) into diagram/ folders.`);
  const problems = [...collected.problems, ...staleDrawings(root)];
  if (problems.length) return stop("These drawings can't be published yet:", ...problems.map((p) => `  - ${p.drawing}: ${p.problem}`));

  // 4. Build the site exactly as GitHub will.
  log("Building the site…");
  const built = (opts.build ?? (() => npmBuild(root)))();
  if (built.status !== 0) return stop("The site doesn't build:", tail(built.stdout + "\n" + built.stderr));

  // 5. Stage everything now, so what's listed (and later committed) is exactly what was checked;
  //    edits Obsidian saves while the question is open wait for the next sync.
  if (git("add", "-A").status !== 0) return stop("Couldn't prepare the changes for publishing.");
  const staged = git("-c", "core.quotePath=false", "diff", "--cached", "--name-status").stdout.split(/\r?\n/).filter(Boolean);
  const unpushed = Number(git("rev-list", "--count", "origin/main..HEAD").stdout.trim() || "0");
  if (!staged.length && !unpushed) { log("Nothing new to publish."); return { ok: true }; }

  let message: string | undefined;
  if (staged.length) {
    log(`Ready to publish ${staged.length} change(s):`);
    staged.slice(0, 40).forEach((c) => log(`  ${describe(c)}`));
    if (staged.length > 40) log(`  … and ${staged.length - 40} more`);
    const fallback = `Update ${(opts.now ?? new Date()).toISOString().slice(0, 10)}`;
    const answer = (await opts.ask(`One-line message for this update (Enter for "${fallback}", or type cancel): `)).trim();
    if (answer.toLowerCase() === "cancel") { git("reset", "-q"); return stop("Cancelled."); }
    message = answer || fallback;

    // 6. Commit (the pre-commit hook still runs).
    const committed = git("commit", "-q", "-m", message);
    if (committed.status !== 0) {
      git("reset", "-q");
      return stop("The commit was refused:", tail(committed.stdout + "\n" + committed.stderr));
    }
  } else {
    log(`Pushing ${unpushed} earlier change(s) that hadn't reached GitHub yet.`);
  }

  // 7. Push everything GitHub doesn't have yet (including commits a failed earlier push left behind).
  const pushed = git("push", "--quiet", "origin", "HEAD:main");
  if (pushed.status !== 0) {
    log(message ? `Saved "${message}" on this computer, but couldn't push it to GitHub:` : "Couldn't push to GitHub:");
    log(tail(pushed.stderr));
    log("You may be offline or signed out of GitHub, or GitHub refused the push. Run sync again; it will push whatever is waiting.");
    return { ok: false, committed: message };
  }
  log(message ? `Published "${message}".` : "Published.");
  const links = linksFor(git("config", "--get", "remote.origin.url").stdout.trim());
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
 * `part-*` folder and `articles/`. Returns the vault-relative paths written, and a problem for any
 * image that couldn't be moved (usually because Obsidian has it open); moves already done are harmless.
 */
export function collectDiagramImages(root: string): { moved: string[]; problems: DrawingProblem[] } {
  const moved: string[] = [];
  const problems: DrawingProblem[] = [];
  for (const home of drawingHomes(root)) {
    const from = join(root, home, "excalidraw");
    if (!existsSync(from)) continue;
    for (const file of readdirSync(from)) {
      const m = /^(.+)\.excalidraw\.(light|dark)\.svg$/.exec(file);
      if (!m) continue;
      const target = `${home}/diagram/${m[1]}-${m[2]}.svg`;
      try {
        mkdirSync(join(root, home, "diagram"), { recursive: true });
        renameSync(join(from, file), join(root, target)); // keeps the export's time, used by staleDrawings
        moved.push(target);
      } catch (e) {
        const code = (e as { code?: string }).code ?? "error";
        problems.push({ drawing: `${home}/excalidraw/${file}`, problem: `couldn't be moved into diagram/ (${code}): close the drawing in Obsidian, then run sync again.` });
      }
    }
  }
  return { moved, problems };
}

/**
 * Every drawing (`<dir>/excalidraw/<name>.excalidraw.md`) whose images in `<dir>/diagram/` are
 * missing, one-sided, or older than the drawing itself (with a 2-second allowance for the
 * export finishing just after the save).
 */
export function staleDrawings(root: string): DrawingProblem[] {
  const SAVE = "open it in Obsidian and save it (Ctrl+S) so Excalidraw exports its light and dark images";
  const problems: DrawingProblem[] = [];
  const homes = drawingHomes(root);
  for (const home of homes) {
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
  // Drawings anywhere else (e.g. Excalidraw's default "Excalidraw/" folder) are never collected or published.
  for (const stray of strayDrawings(root, homes))
    problems.push({ drawing: stray, problem: "it isn't in a part's excalidraw/ folder, so its images won't be published: move it into part-<n>_<slug>/excalidraw/ (and its .svg exports with it)." });
  return problems;
}

/** `*.excalidraw.md` files outside `<home>/excalidraw/` (skipping dot folders, which hold tools and settings). */
function strayDrawings(root: string, homes: string[]): string[] {
  const allowed = new Set(homes.map((h) => `${h}/excalidraw`));
  const found: string[] = [];
  const walk = (dir: string, rel: string) => {
    for (const d of readdirSync(dir, { withFileTypes: true })) {
      if (d.name.startsWith(".") || d.name === "node_modules") continue;
      const path = rel ? `${rel}/${d.name}` : d.name;
      if (d.isDirectory()) walk(join(dir, d.name), path);
      else if (d.name.endsWith(".excalidraw.md") && !allowed.has(rel)) found.push(path);
    }
  };
  walk(root, "");
  return found;
}

/**
 * The GitHub Actions page and the Pages address for a github.com remote (https or ssh), or undefined
 * for any other remote. A repository named `<owner>.github.io` is served at the domain root.
 */
export function linksFor(remoteUrl: string): { actions: string; site: string } | undefined {
  const m = /^(?:https:\/\/(?:[^@/]+@)?github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?\/?$/.exec(remoteUrl);
  if (!m) return undefined;
  const [, owner, repo] = m;
  const host = `${owner!.toLowerCase()}.github.io`;
  return { actions: `https://github.com/${owner}/${repo}/actions`, site: repo!.toLowerCase() === host ? `https://${host}/` : `https://${host}/${repo}/` };
}

/** `git diff --cached --name-status` line → "new: …", "changed: …", "removed: …", "renamed: … → …". */
function describe(line: string): string {
  const [code = "", ...paths] = line.split("\t");
  if (code.startsWith("A")) return `new:     ${paths[0]}`;
  if (code.startsWith("D")) return `removed: ${paths[0]}`;
  if (code.startsWith("R")) return `renamed: ${paths[0]} → ${paths[1]}`;
  return `changed: ${paths[0]}`;
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
