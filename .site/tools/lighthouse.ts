/**
 * TOOL-10 Lighthouse budgets (plan/tools.md, NFR-001): `npm --prefix .site run test:lighthouse`.
 * Runs Lighthouse CI on the built site (`lhci collect`, from `astro preview`, with Lighthouse's mobile emulation and
 * simulated slow 4G, as `.site/lighthouserc.json` sets), checks the budgets there (`lhci assert`: LCP ≤ 2.5 s,
 * CLS ≤ 0.1, every category ≥ 95), and then always lists LCP, CLS and the four scores for each page, in the log and,
 * in GitHub Actions, in the job summary. The command fails when a run or a budget fails (TOOL-10.AC1).
 * Reports stay in `.site/.lighthouseci/` (not committed); nothing is uploaded anywhere (NFR-008).
 * In CI, Chrome runs without its sandbox: Ubuntu 24.04 runners block the sandbox's user namespaces, and the only
 * page it opens is this site, served locally.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** One page's run: LCP in ms, CLS, and the category scores from 0 to 100. */
export type PageVitals = { url: string; lcp: number; cls: number; scores: Record<string, number> };

/** The pages' results from a collect run's `lhr-*.json` reports in `dir`. */
export function readRuns(dir: string): PageVitals[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^lhr-.*\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Lhr)
    .map((lhr) => ({
      url: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? lhr.requestedUrl ?? "?",
      lcp: lhr.audits["largest-contentful-paint"]?.numericValue ?? NaN,
      cls: lhr.audits["cumulative-layout-shift"]?.numericValue ?? NaN,
      scores: Object.fromEntries(Object.entries(lhr.categories).map(([k, c]) => [k, Math.round((c.score ?? 0) * 100)])),
    }))
    .sort((a, b) => a.url.localeCompare(b.url));
}

/** A Markdown table: one row per page with LCP, CLS and the scores. */
export function formatVitals(pages: PageVitals[]): string[] {
  const path = (u: string) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  };
  return [
    "| Page | LCP | CLS | Performance | Accessibility | Best practices | SEO |",
    "|---|---|---|---|---|---|---|",
    ...pages.map(
      (p) =>
        `| ${path(p.url)} | ${Number.isFinite(p.lcp) ? `${(p.lcp / 1000).toFixed(2)} s` : "–"} | ${Number.isFinite(p.cls) ? p.cls.toFixed(3) : "–"} | ${p.scores.performance ?? "–"} | ${p.scores.accessibility ?? "–"} | ${p.scores["best-practices"] ?? "–"} | ${p.scores.seo ?? "–"} |`,
    ),
  ];
}

/** Collects, asserts and reports; returns the exit code. `siteRoot` is `.site/`, where lighthouserc.json lives. */
export function runLighthouse(siteRoot: string, io: { log(t: string): void; error(t: string): void }): number {
  const dir = join(siteRoot, ".lighthouseci");
  rmSync(dir, { recursive: true, force: true });
  const flags = process.env.CI ? ["--collect.settings.chromeFlags=--no-sandbox --headless=new"] : [];
  const lhci = (command: string, extra: string[] = []) =>
    spawnSync(
      process.execPath,
      [join(siteRoot, "node_modules/@lhci/cli/src/cli.js"), command, "--config=lighthouserc.json", ...extra],
      {
        cwd: siteRoot,
        stdio: "inherit",
      },
    ).status ?? 1;
  const collected = lhci("collect", flags);
  const asserted = collected === 0 ? lhci("assert") : collected;
  const table = formatVitals(readRuns(dir));
  io.log(table.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Lighthouse (TOOL-10)\n\n${table.join("\n")}\n`);
  if (collected !== 0) io.error("Lighthouse couldn't run on every page (see above).");
  else if (asserted !== 0)
    io.error("A Lighthouse budget was exceeded (see above): LCP ≤ 2.5 s, CLS ≤ 0.1, every category ≥ 95 (NFR-001).");
  return asserted;
}

type Lhr = {
  finalDisplayedUrl?: string;
  finalUrl?: string;
  requestedUrl?: string;
  audits: Record<string, { numericValue?: number } | undefined>;
  categories: Record<string, { score: number | null }>;
};
