import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { cleanUp, tempFolder } from "../tools/test-site.ts";
import { baseProblems, brokenLinks, siteRootOf } from "../tools/links.ts";
import { buildFixtureSite } from "./build-site.ts";

/**
 * T-03.07: two proofs about what reaches the live site.
 * - REQ-SITE-013.AC2 (ADR-0007): the base path lives in one setting, so a build at the root of a custom domain
 *   (base `/`) links as well as the project site does. The fixture vault is built with `--base /` and both halves
 *   of the link check (TOOL-12) run over it under that base. The real base path isn't changed (out of scope).
 * - REQ-SITE-007.AC2 (specs/operations.md#deploy): a push with a broken embed never deploys, and the run page shows
 *   the REQ-CNT-007 message. The build of a vault with a broken embed exits non-zero with the message; the workflow
 *   builds before it uploads anything, lets no failure through to the upload or the deploy, and on a failed build
 *   writes the build report into the job summary, which GitHub shows on the run page.
 */
afterAll(cleanUp);

const workflow = readFileSync(join(import.meta.dirname, "../../.github/workflows/publish.yml"), "utf8").replace(
  /\r\n/g,
  "\n",
);
const job = (name: string) => new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)*)`, "m").exec(workflow)?.[1] ?? "";
/** A job's steps, each as its text (from one `- ` at six spaces to the next). */
const steps = (jobText: string) => jobText.split(/\n(?=      - )/).filter((s) => s.trimStart().startsWith("- "));

describe("the site at the root of a domain", () => {
  // @req REQ-SITE-013.AC2
  it("links correctly when the base path is / (the link check passes)", async () => {
    const dist = tempFolder("sdfp-base-root-");
    buildFixtureSite(dist, "/");
    expect(readFileSync(join(dist, "index.html"), "utf8")).toContain('href="/book/');
    expect(baseProblems(dist, "/")).toEqual([]);
    const { problems, checked } = await brokenLinks(siteRootOf(), dist, "/");
    expect(problems).toEqual([]);
    expect(checked).toBeGreaterThan(20); // the crawl reached the site's pages, not just a start page
  }, 180_000);
});

describe("a push with a broken embed", () => {
  // @req REQ-SITE-007.AC2
  it("fails the build with the plain-language message (REQ-CNT-007)", () => {
    const vault = join(import.meta.dirname, "fixtures/broken/E-EMBED-MISSING");
    let output = "";
    let failed = false;
    try {
      buildFixtureSite(tempFolder("sdfp-broken-embed-"), undefined, vault);
    } catch (e) {
      failed = true;
      const err = e as { status?: number; stdout?: string; stderr?: string };
      expect(err.status).not.toBe(0);
      output = `${err.stdout ?? ""}${err.stderr ?? ""}`;
    }
    expect(failed, "the build exits non-zero").toBe(true);
    expect(output).toContain("✖ ERROR E-EMBED-MISSING  part-1_foundations/chapter-1_computer-architecture.md:3");
    expect(output).toContain("Fix: Check the spelling, or add the file.");
    expect(output).toContain("Errors stop the publish");
  }, 120_000);

  // @req REQ-SITE-007.AC2
  it("leaves the live site unchanged: the workflow builds before it uploads, and a failure stops the deploy", () => {
    const build = steps(job("build"));
    const buildAt = build.findIndex((s) => /run: npm run build\b/.test(s));
    const uploadAt = build.findIndex((s) => s.includes("actions/upload-pages-artifact@"));
    expect(buildAt, "the build job runs npm run build").toBeGreaterThanOrEqual(0);
    expect(uploadAt, "the build job uploads the site").toBeGreaterThan(buildAt);
    // Nothing lets a failed step through: no continue-on-error anywhere, and nothing from the build on to the upload
    // runs after a failure.
    expect(workflow).not.toMatch(/continue-on-error/);
    for (const s of build.slice(buildAt, uploadAt + 1)) {
      if (/\bif:/.test(s)) expect(s, s).toMatch(/if: failure\(\)/); // only the report step, which uploads nothing
    }
    expect(build[uploadAt]).not.toMatch(/\bif:/);
    const deploy = job("deploy");
    expect(deploy).toMatch(/needs: build/);
    expect(deploy).not.toMatch(/always\(\)|failure\(\)|cancelled\(\)/);
  });

  // @req REQ-SITE-007.AC2
  it("shows the build report on the run page when the build fails", () => {
    const build = steps(job("build"));
    const buildStep = build.find((s) => /npm run build\b/.test(s)) ?? "";
    // The report is kept; an explicit `shell: bash` is `bash -eo pipefail`, so the build's own exit code still fails
    // the step through tee (the default shell has no pipefail, and tee would turn the failure into a pass).
    expect(buildStep).toMatch(/id: build\b/);
    expect(buildStep).toMatch(/shell: bash\n/);
    expect(buildStep).toMatch(/run: npm run build 2>&1 \| tee build\.log/);
    const report = build.find((s) => s.includes("GITHUB_STEP_SUMMARY")) ?? "";
    expect(report, "a step writes the report into the job summary").not.toBe("");
    expect(report).toMatch(/if: failure\(\) && steps\.build\.outcome == 'failure'/);
    expect(report, "the report step only writes the summary").not.toMatch(/uses:/);
    // From the first issue block (the build-messages.md form) to the summary line: every message, nothing after.
    expect(report).toContain("sed -n '/^✖ ERROR \\|^⚠ WARNING /,/^The build found /p' build.log");
  });
});
