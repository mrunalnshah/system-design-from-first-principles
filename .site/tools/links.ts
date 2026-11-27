/**
 * TOOL-12 link check (plan/tools.md, REQ-SITE-013, specs/contracts/routes.md): `<tools> links [--dist DIR]`.
 * Two checks over the built site:
 * 1. Base path: every internal address a page writes (`href`, `src`, `srcset`, `action`, and `url()` in its inline
 *    styles) that starts with "/" must start with the base path, or it breaks on GitHub Pages; each one is named with
 *    its page (TOOL-12.AC1). Only `url()` in `style` attributes and `<style>` counts, not text that shows one.
 * 2. Every internal link and asset resolves: linkinator crawls the site from the homepage over `astro preview`,
 *    under the real base path, following links within the site and the files the pages and stylesheets use; any
 *    address that doesn't answer 200 fails, named with the page it's on (TOOL-12.AC2). Nothing on another host is
 *    requested (NFR-008, and the check never depends on the network).
 * CR-0008: the header and footer link to Contents, Articles and About before their pages exist (R-11, R-13), so
 * exactly those three addresses may be missing, and only while the build has no page for them.
 */
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { htmlFiles, pageName } from "./dist.ts";

/** Articles and About: linked from every page before they're built (CR-0008, routes.md); Contents is built (T-02.03). */
export const NOT_YET_BUILT = ["articles/", "about/"];

export type LinkProblem = { page: string; address: string; problem: string };

/** The site's base path, from astro.config.ts (e.g. "/system-design-from-first-principles/"). */
export function sitePath(siteRoot: string): string {
  const config = readFileSync(join(siteRoot, "astro.config.ts"), "utf8");
  const base = /\bbase\s*:\s*["']([^"']+)["']/.exec(config)?.[1];
  // Without it every root-relative address would look fine, and check 1 would check nothing.
  if (!base) throw new Error('No base path found in astro.config.ts (`base: "/…/"`, REQ-SITE-013).');
  return base.endsWith("/") ? base : `${base}/`;
}

/** Check 1: root-relative addresses that skip the base path, per page. */
export function baseProblems(dist: string, base: string): LinkProblem[] {
  const out: LinkProblem[] = [];
  for (const file of htmlFiles(dist)) {
    const html = readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "");
    const page = pageName(dist, file);
    const addresses = [
      ...[...html.matchAll(/\s(?:href|src|action|poster|data)\s*=\s*["']([^"']*)["']/gi)].map((m) => m[1]!),
      ...[...html.matchAll(/\ssrcset\s*=\s*["']([^"']*)["']/gi)].flatMap((m) =>
        m[1]!.split(",").map((c) => c.trim().split(/\s+/)[0]!),
      ),
      ...styles(html).flatMap((css) => [...css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/gi)].map((m) => m[1]!)),
    ];
    for (const address of new Set(addresses)) {
      if (address.startsWith("/") && !address.startsWith("//") && !address.startsWith(base)) {
        out.push({
          page,
          address,
          problem: `doesn't start with the base path ${base}, so it breaks on the live site (REQ-SITE-013)`,
        });
      }
    }
  }
  return out;
}

/** The page's CSS: `<style>` contents and `style` attributes. */
function styles(html: string): string[] {
  return [
    ...[...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]!),
    ...[...html.matchAll(/\sstyle\s*=\s*"([^"]*)"|\sstyle\s*=\s*'([^']*)'/gi)].map((m) => m[1] ?? m[2]!),
  ];
}

/** Check 2: crawls the site served by `astro preview` and returns every internal address that doesn't resolve. */
export async function brokenLinks(
  siteRoot: string,
  dist: string,
  base: string,
): Promise<{ problems: LinkProblem[]; checked: number; allowed: string[] }> {
  const { check, LinkState } = await import("linkinator");
  const port = await freePort();
  const server = await startPreview(siteRoot, dist, port);
  const origin = `http://localhost:${port}`;
  try {
    const result = await check({
      path: `${origin}${base}`,
      recurse: true,
      checkCss: true,
      concurrency: 20,
      timeout: 20_000,
      // Only this site: another host is never requested.
      linksToSkip: async (link) => !link.startsWith(`${origin}/`),
    });
    const problems: LinkProblem[] = [];
    const allowed = new Set<string>();
    for (const link of result.links) {
      if (link.state !== LinkState.BROKEN) continue;
      const path = new URL(link.url).pathname;
      const inSite = path.startsWith(base) ? path.slice(base.length) : path;
      const aheadOfPlan = NOT_YET_BUILT.includes(inSite);
      if (aheadOfPlan && !existsSync(join(dist, inSite, "index.html"))) {
        allowed.add(inSite);
        continue;
      }
      const page = link.parent ? new URL(link.parent).pathname : "(the start page)";
      problems.push({
        page: page.startsWith(base) ? page.slice(base.length) || "/" : page,
        address: path,
        problem: `doesn't resolve (${link.status || "no answer"})`,
      });
    }
    return {
      problems,
      checked: result.links.filter((l) => l.state !== LinkState.SKIPPED).length,
      allowed: [...allowed],
    };
  } finally {
    await server.stop();
  }
}

/** Both checks; the CLI's `links`. */
export async function checkLinks(
  siteRoot: string,
  dist: string,
): Promise<{ problems: LinkProblem[]; checked: number; allowed: string[] }> {
  if (!existsSync(dist)) throw new Error(`No built site at ${dist}. Run \`npm --prefix .site run build\` first.`);
  const base = sitePath(siteRoot);
  const crawl = await brokenLinks(siteRoot, dist, base);
  return { ...crawl, problems: [...baseProblems(dist, base), ...crawl.problems] };
}

/**
 * `astro preview` of `dist` on `port`, as its own process (it behaves the same under Node and under Vitest's Vite);
 * resolves once it answers, with a way to stop it.
 */
async function startPreview(siteRoot: string, dist: string, port: number): Promise<{ stop(): Promise<void> }> {
  const astro = join(siteRoot, "node_modules/astro/bin/astro.mjs");
  const args = [astro, "preview", "--port", String(port), "--host", "localhost", "--outDir", dist];
  const child = spawn(process.execPath, args, { cwd: siteRoot, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  child.stdout.on("data", (d: Buffer) => void (output += d));
  child.stderr.on("data", (d: Buffer) => void (output += d));
  const stop = () =>
    new Promise<void>((done) => {
      if (child.exitCode !== null) return done();
      child.once("exit", () => done());
      child.kill();
    });
  const deadline = Date.now() + 60_000;
  for (;;) {
    if (child.exitCode !== null) throw new Error(`astro preview stopped:\n${output}`);
    try {
      await fetch(`http://localhost:${port}/`);
      return { stop };
    } catch {
      if (Date.now() > deadline) {
        await stop();
        throw new Error(`astro preview didn't answer within a minute:\n${output}`);
      }
      await new Promise((r) => setTimeout(r, 200));
    }
  }
}

/** The site folder (`.site/`), next to this file's folder. */
export const siteRootOf = () => fileURLToPath(new URL("../", import.meta.url));

function freePort(): Promise<number> {
  return new Promise((done, fail) => {
    const s = createServer();
    s.once("error", fail);
    s.listen(0, "localhost", () => {
      const { port } = s.address() as { port: number };
      s.close(() => done(port));
    });
  });
}
