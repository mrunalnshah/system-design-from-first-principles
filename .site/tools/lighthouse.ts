/**
 * TOOL-10 Lighthouse budgets (plan/tools.md, NFR-001): `npm --prefix .site run test:lighthouse`.
 * Runs Lighthouse CI on the built site (`lhci collect`, from `astro preview`, with Lighthouse's mobile emulation and
 * simulated slow 4G, as `.site/lighthouserc.json` sets), checks the budgets there (`lhci assert`: LCP ≤ 2.5 s,
 * CLS ≤ 0.1, every category ≥ 95). Each page is run three times and judged on its median run, chosen as LHCI's
 * `median-run` chooses it, so one slow moment on a shared runner can't fail the push (R-14: the homepage scored 70 and
 * 91 in CI and 100 locally). It then always lists, for each page's median run, LCP, CLS, FCP, Speed Index, Total
 * Blocking Time, the four scores and every run's performance score, and names the elements that shifted, in the log
 * and, in GitHub Actions, in the job summary. The command fails when a run or a budget fails (TOOL-10.AC1).
 * Reports stay in `.site/.lighthouseci/` (not committed); nothing is uploaded anywhere (NFR-008).
 * In CI, Chrome runs without its sandbox: Ubuntu 24.04 runners block the sandbox's user namespaces, and the only
 * page it opens is this site, served locally.
 */
import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/** One page's run: LCP, FCP, Speed Index, TBT and time to interactive in ms, CLS, what shifted, and the scores (0–100). */
export type PageVitals = {
  url: string;
  lcp: number;
  cls: number;
  fcp: number;
  si: number;
  tbt: number;
  tti: number;
  /** Each layout shift's element (its selector) and weight, with the cause Lighthouse found, if any. */
  shifts: string[];
  scores: Record<string, number>;
};

/** A page's median run, and the performance score of each of its runs, in run order. */
export type PageResult = PageVitals & { runs: number[] };

/** The pages' results from a collect run's `lhr-*.json` reports in `dir`. */
export function readRuns(dir: string): PageVitals[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => /^lhr-.*\.json$/.test(f))
    .map((f) => JSON.parse(readFileSync(join(dir, f), "utf8")) as Lhr)
    .map((lhr) => {
      const value = (id: string) => lhr.audits[id]?.numericValue ?? NaN;
      return {
        url: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? lhr.requestedUrl ?? "?",
        lcp: value("largest-contentful-paint"),
        cls: value("cumulative-layout-shift"),
        fcp: value("first-contentful-paint"),
        si: value("speed-index"),
        tbt: value("total-blocking-time"),
        tti: value("interactive"),
        // The shifted element is `node` when Lighthouse knows it; each cause may name its own culprit, an element
        // (an image without a size) or a file (a web font), in `extra`.
        shifts: (lhr.audits["layout-shifts"]?.details?.items ?? []).map((item) => {
          const causes = (item.subItems?.items ?? []).map((c) => {
            const culprit = c.extra?.selector ?? c.extra?.value?.split("/").pop();
            return culprit ? `${c.cause ?? "?"}: ${culprit}` : (c.cause ?? "?");
          });
          const element = item.node?.selector ?? item.node?.nodeLabel ?? "an unnamed element";
          return `${element} (${(item.score ?? 0).toFixed(3)}${causes.length ? `; ${causes.join("; ")}` : ""})`;
        }),
        scores: Object.fromEntries(
          Object.entries(lhr.categories).map(([k, c]) => [k, Math.round((c.score ?? 0) * 100)]),
        ),
      };
    })
    .sort((a, b) => a.url.localeCompare(b.url));
}

/**
 * Each page's median run, picked as LHCI's `median-run` assertions pick it (@lhci/utils computeRepresentativeRuns):
 * the run closest to the page's median first contentful paint and median time to interactive. The table then shows
 * the very run the budgets were checked on.
 */
export function medianRuns(runs: PageVitals[]): PageResult[] {
  const byUrl = Map.groupBy(runs, (r) => r.url);
  return [...byUrl.values()].map((page) => {
    const median = (key: "fcp" | "tti") =>
      page.map((r) => r[key] || 0).sort((a, b) => a - b)[Math.floor(page.length / 2)]!;
    const fcp = median("fcp");
    const tti = median("tti");
    const distance = (r: PageVitals) => (fcp - (r.fcp || 0)) ** 2 + (tti - (r.tti || 0)) ** 2;
    const best = page.reduce((a, b) => (distance(b) < distance(a) ? b : a));
    return { ...best, runs: page.map((r) => r.scores.performance ?? NaN) };
  });
}

/** A Markdown table, one row per page's median run, then a line per page whose layout shifted, naming the elements. */
export function formatVitals(pages: PageResult[]): string[] {
  const path = (u: string) => {
    try {
      return new URL(u).pathname;
    } catch {
      return u;
    }
  };
  const seconds = (ms: number) => (Number.isFinite(ms) ? `${(ms / 1000).toFixed(2)} s` : "–");
  const shifted = pages.filter((p) => p.shifts.length);
  return [
    "| Page | LCP | CLS | FCP | Speed Index | TBT | Performance | Accessibility | Best practices | SEO | Runs (performance) |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
    ...pages.map(
      (p) =>
        `| ${path(p.url)} | ${seconds(p.lcp)} | ${Number.isFinite(p.cls) ? p.cls.toFixed(3) : "–"} | ${seconds(p.fcp)} | ${seconds(p.si)} | ${Number.isFinite(p.tbt) ? `${Math.round(p.tbt)} ms` : "–"} | ${p.scores.performance ?? "–"} | ${p.scores.accessibility ?? "–"} | ${p.scores["best-practices"] ?? "–"} | ${p.scores.seo ?? "–"} | ${p.runs.join(", ")} |`,
    ),
    ...(shifted.length
      ? ["", "Layout shifts in the median run:", ...shifted.map((p) => `- ${path(p.url)}: ${p.shifts.join("; ")}`)]
      : []),
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
  const table = formatVitals(medianRuns(readRuns(dir)));
  io.log(table.join("\n"));
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `### Lighthouse (TOOL-10)\n\n${table.join("\n")}\n`);
  if (collected !== 0) io.error("Lighthouse couldn't run on every page (see above).");
  else if (asserted !== 0)
    io.error(
      "A Lighthouse budget was exceeded on a page's median run (see above): LCP ≤ 2.5 s, CLS ≤ 0.1, every category ≥ 95 (NFR-001).",
    );
  return asserted;
}

type Lhr = {
  finalDisplayedUrl?: string;
  finalUrl?: string;
  requestedUrl?: string;
  audits: Record<
    string,
    | {
        numericValue?: number;
        details?: {
          items?: {
            node?: { selector?: string; nodeLabel?: string };
            score?: number;
            subItems?: { items?: { cause?: string; extra?: { selector?: string; value?: string } }[] };
          }[];
        };
      }
    | undefined
  >;
  categories: Record<string, { score: number | null }>;
};
