import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { collectDiagramImages, linksFor, staleDrawings, sync, type SyncOptions } from "./sync.ts";

const tempRoots: string[] = [];
afterAll(() => tempRoots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const git = (cwd: string, ...args: string[]) => execFileSync("git", ["-C", cwd, ...args], { encoding: "utf8", stdio: "pipe" }).trim();

function put(root: string, rel: string, text: string, mtime?: Date) {
  mkdirSync(dirname(join(root, rel)), { recursive: true });
  writeFileSync(join(root, rel), text);
  if (mtime) utimesSync(join(root, rel), mtime, mtime);
}

/** A vault cloned from a local bare "GitHub", with one published chapter. Returns both paths. */
function vault(): { root: string; origin: string } {
  const base = mkdtempSync(join(tmpdir(), "sdfp-sync-"));
  tempRoots.push(base);
  const origin = join(base, "origin.git");
  const root = join(base, "vault");
  execFileSync("git", ["init", "-q", "--bare", "-b", "main", origin]);
  execFileSync("git", ["clone", "-q", origin, root], { stdio: "pipe" });
  git(root, "config", "user.name", "Author");
  git(root, "config", "user.email", "author@example.invalid");
  put(root, ".gitignore", "*.excalidraw.md\n");
  put(root, "part-1_foundations/chapter-1_computer-architecture.md", "Intro.\n");
  git(root, "add", "-A");
  git(root, "commit", "-q", "-m", "start");
  git(root, "push", "-q", "origin", "HEAD:main");
  return { root, origin };
}

/** Collects what sync says and answers its question with `answer`. */
function options(root: string, answer = "Add chapter 2", build = () => ({ status: 0, stdout: "built", stderr: "" })) {
  const lines: string[] = [];
  const opts: SyncOptions = { root, log: (l) => lines.push(l), ask: async () => answer, build, now: new Date("2026-11-26T12:00:00Z") };
  return { opts, lines, text: () => lines.join("\n") };
}

const old = new Date("2026-11-20T10:00:00Z");
const newer = new Date("2026-11-26T10:00:00Z");
/** A drawing saved at `drawn`, with Excalidraw's exports written at `exported` (or not at all). */
function drawing(root: string, name: string, drawn: Date, exported?: { light?: Date; dark?: Date }) {
  put(root, `part-1_foundations/excalidraw/${name}.excalidraw.md`, "drawing", drawn);
  if (exported?.light) put(root, `part-1_foundations/excalidraw/${name}.excalidraw.light.svg`, `<svg>${name} light</svg>`, exported.light);
  if (exported?.dark) put(root, `part-1_foundations/excalidraw/${name}.excalidraw.dark.svg`, `<svg>${name} dark</svg>`, exported.dark);
}
const remoteLog = (origin: string) => execFileSync("git", ["--git-dir", origin, "log", "--format=%s", "main"], { encoding: "utf8" }).trim().split("\n");
const remoteFiles = (origin: string) => execFileSync("git", ["--git-dir", origin, "ls-tree", "-r", "--name-only", "main"], { encoding: "utf8" }).trim().split("\n");

// Each test runs real git commands against temp repositories, which can take more than Vitest's 5 s on a slow disk.
describe("sync", { timeout: 30_000 }, () => {
  // @req REQ-AUTH-001.AC1
  it("commits a new chapter with its diagram images under the author's message, and pushes it", async () => {
    const { root, origin } = vault();
    put(root, "part-1_foundations/chapter-2_memory.md", "![[02_memory.excalidraw|Memory]]\n");
    drawing(root, "02_memory", old, { light: newer, dark: newer });
    const { opts } = options(root, "Add chapter 2");
    expect(await sync(opts)).toMatchObject({ ok: true });
    expect(remoteLog(origin)[0]).toBe("Add chapter 2");
    const files = remoteFiles(origin);
    expect(files).toEqual(expect.arrayContaining(["part-1_foundations/chapter-2_memory.md", "part-1_foundations/diagram/02_memory-light.svg", "part-1_foundations/diagram/02_memory-dark.svg"]));
    expect(files.some((f) => f.includes(".excalidraw"))).toBe(false); // the drawing source and raw exports never reach git
  });

  // @req REQ-AUTH-001.AC2
  it("stops before committing when a drawing was saved after its images were exported", async () => {
    const { root, origin } = vault();
    drawing(root, "02_memory", newer, { light: old, dark: old });
    const { opts, text } = options(root);
    expect((await sync(opts)).ok).toBe(false);
    expect(text()).toMatch(/02_memory.*open it in Obsidian and save it \(Ctrl\+S\)/s);
    expect(remoteLog(origin)).toEqual(["start"]);
  });

  // @req REQ-AUTH-001.AC3
  it("stops before committing when the site doesn't build, and shows the build report", async () => {
    const { root, origin } = vault();
    put(root, "part-1_foundations/chapter-2_memory.md", "Text.\n");
    const { opts, text } = options(root, "x", () => ({ status: 1, stdout: "✖ ERROR E-EMBED-MISSING  part-1_foundations/chapter-2_memory.md:3", stderr: "" }));
    expect((await sync(opts)).ok).toBe(false);
    expect(text()).toContain("E-EMBED-MISSING");
    expect(remoteLog(origin)).toEqual(["start"]);
    expect(git(root, "log", "--format=%s")).toBe("start");
  });

  // @req REQ-AUTH-001.AC4
  it("says there's nothing new to publish when nothing changed, and makes no commit", async () => {
    const { root, origin } = vault();
    const { opts, text } = options(root);
    expect(await sync(opts)).toEqual({ ok: true });
    expect(text()).toContain("Nothing new to publish");
    expect(remoteLog(origin)).toEqual(["start"]);
  });

  // @req REQ-AUTH-001.AC5
  it("pulls new commits from GitHub first, and stops with an explanation when it can't fast-forward", async () => {
    const { root, origin } = vault();
    const other = join(dirname(root), "other");
    execFileSync("git", ["clone", "-q", origin, other], { stdio: "pipe" });
    git(other, "-c", "user.name=Bot", "-c", "user.email=bot@example.invalid", "commit", "-q", "--allow-empty", "-m", "dependabot update");
    git(other, "push", "-q", "origin", "HEAD:main");
    put(root, "part-1_foundations/chapter-2_memory.md", "Text.\n");
    expect((await sync(options(root, "Add chapter 2").opts)).ok).toBe(true);
    expect(remoteLog(origin).slice(0, 3)).toEqual(["Add chapter 2", "dependabot update", "start"]);

    // Now a local commit nobody pushed, plus a new remote one: no fast-forward is possible.
    git(root, "commit", "-q", "--allow-empty", "-m", "local only");
    git(other, "pull", "-q", "--ff-only");
    git(other, "-c", "user.name=Bot", "-c", "user.email=bot@example.invalid", "commit", "-q", "--allow-empty", "-m", "remote only");
    git(other, "push", "-q", "origin", "HEAD:main");
    const { opts, text } = options(root);
    expect((await sync(opts)).ok).toBe(false);
    expect(text()).toMatch(/can't combine|couldn't be combined/i);
  });

  it("works out the Actions page and the site address from a GitHub remote", () => {
    expect(linksFor("https://github.com/mrunalnshah/system-design-from-first-principles.git")).toEqual({
      actions: "https://github.com/mrunalnshah/system-design-from-first-principles/actions",
      site: "https://mrunalnshah.github.io/system-design-from-first-principles/",
    });
    expect(linksFor("git@github.com:mrunalnshah/system-design-from-first-principles.git")?.site).toBe("https://mrunalnshah.github.io/system-design-from-first-principles/");
    expect(linksFor("C:/tmp/origin.git")).toBeUndefined();
    expect(linksFor("https://evilgithub.com/a/b.git")).toBeUndefined();
    expect(linksFor("https://github.com/MrunalNShah/mrunalnshah.github.io")?.site).toBe("https://mrunalnshah.github.io/");
  });

  // @req REQ-AUTH-001.AC6
  it("logs the Actions link and the site address after a successful push to a GitHub remote", async () => {
    const { root, origin } = vault();
    // The remote is named like GitHub, but git is told to use the local bare repository for it.
    const url = "https://github.com/test-owner/test-book.git";
    git(root, "remote", "set-url", "origin", url);
    git(root, "config", `url.${origin.replace(/\\/g, "/")}.insteadOf`, url);
    put(root, "part-1_foundations/chapter-2_memory.md", "Text.\n");
    const { opts, text } = options(root);
    expect((await sync(opts)).ok).toBe(true);
    expect(text()).toContain("Watch it build: https://github.com/test-owner/test-book/actions");
    expect(text()).toContain("Live in a few minutes at: https://test-owner.github.io/test-book/");
    expect(remoteLog(origin)[0]).toBe("Add chapter 2");
  });

  it("pushes a commit that an earlier failed push left behind, even with nothing new", async () => {
    const { root, origin } = vault();
    put(root, "part-1_foundations/chapter-2_memory.md", "Text.\n");
    git(root, "add", "-A");
    git(root, "commit", "-q", "-m", "stranded");
    const { opts, text } = options(root);
    expect((await sync(opts)).ok).toBe(true);
    expect(text()).not.toContain("Nothing new to publish");
    expect(remoteLog(origin)[0]).toBe("stranded");
  });

  it("commits exactly what it listed, and lists every new file (not just its folder)", async () => {
    const { root, origin } = vault();
    put(root, "notes/a.md", "a\n");
    put(root, "notes/b.md", "b\n");
    const { opts, text } = options(root);
    opts.ask = async () => { put(root, "notes/c.md", "saved while the question was open\n"); return "Two notes"; };
    expect((await sync(opts)).ok).toBe(true);
    expect(text()).toContain("new:     notes/a.md");
    expect(text()).toContain("new:     notes/b.md");
    expect(remoteFiles(origin)).toEqual(expect.arrayContaining(["notes/a.md", "notes/b.md"]));
    expect(remoteFiles(origin)).not.toContain("notes/c.md"); // published by the next sync, after it's been built
  });

  it("refuses a drawing outside a part's excalidraw/ folder", async () => {
    const { root, origin } = vault();
    put(root, "Excalidraw/Drawing 2026-11-26.excalidraw.md", "drawing");
    const { opts, text } = options(root);
    expect((await sync(opts)).ok).toBe(false);
    expect(text()).toMatch(/Excalidraw\/Drawing 2026-11-26\.excalidraw\.md.*move it into part-<n>_<slug>\/excalidraw/);
    expect(remoteLog(origin)).toEqual(["start"]);
  });

  it("treats a question that can't be asked as cancel, and leaves nothing staged", async () => {
    const { root, origin } = vault();
    put(root, "part-1_foundations/chapter-2_memory.md", "Text.\n");
    const { opts } = options(root);
    opts.ask = async () => { throw new Error("readline was closed"); };
    expect((await sync(opts)).ok).toBe(false);
    expect(git(root, "diff", "--cached", "--name-only")).toBe("");
    expect(remoteLog(origin)).toEqual(["start"]);
  });

  it("stops when the author answers 'cancel'", async () => {
    const { root, origin } = vault();
    put(root, "part-1_foundations/chapter-2_memory.md", "Text.\n");
    expect((await sync(options(root, "cancel").opts)).ok).toBe(false);
    expect(remoteLog(origin)).toEqual(["start"]);
  });
});

describe("diagram images", () => {
  // @req REQ-AUTH-002.AC1
  it("moves Excalidraw's exports into diagram/ with clean names", () => {
    const { root } = vault();
    drawing(root, "01_computer-architecture", old, { light: newer, dark: newer });
    put(root, "part-1_foundations/diagram/01_computer-architecture-light.svg", "<svg>stale copy</svg>", old);
    const { moved, problems } = collectDiagramImages(root);
    expect(problems).toEqual([]);
    expect(moved.sort()).toEqual(["part-1_foundations/diagram/01_computer-architecture-dark.svg", "part-1_foundations/diagram/01_computer-architecture-light.svg"]);
    expect(readFileSync(join(root, "part-1_foundations/diagram/01_computer-architecture-light.svg"), "utf8")).toBe("<svg>01_computer-architecture light</svg>");
    expect(existsSync(join(root, "part-1_foundations/excalidraw/01_computer-architecture.excalidraw.light.svg"))).toBe(false);
    expect(staleDrawings(root)).toEqual([]);
  });

  // @req REQ-AUTH-002.AC2
  it("refuses a drawing with a light image but no dark one", () => {
    const { root } = vault();
    drawing(root, "02_memory", old, { light: newer });
    collectDiagramImages(root);
    expect(staleDrawings(root)).toEqual([{ drawing: "part-1_foundations/excalidraw/02_memory.excalidraw.md", problem: expect.stringMatching(/dark image.*missing/) }]);
    const { opts, text } = options(root);
    return sync(opts).then((r) => {
      expect(r.ok).toBe(false);
      expect(text()).toMatch(/02_memory.*dark image.*missing/s);
    });
  });

  // @req REQ-AUTH-002.AC3
  it("refuses a drawing with no images at all, saying to open and save it", async () => {
    const { root, origin } = vault();
    drawing(root, "03_cpu", old);
    expect(staleDrawings(root)[0]?.problem).toMatch(/open it in Obsidian and save it \(Ctrl\+S\)/);
    const { opts, text } = options(root);
    expect((await sync(opts)).ok).toBe(false);
    expect(text()).toMatch(/03_cpu.*open it in Obsidian and save it/s);
    expect(remoteLog(origin)).toEqual(["start"]);
  });
});
