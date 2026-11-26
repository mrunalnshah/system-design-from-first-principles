import { describe, expect, it } from "vitest";
import config from "../../../astro.config.ts";
import { buildReport, formatReport } from "./build-report.ts";
import { createIssueCollector, type BuildIssue } from "./issues.ts";

const error: BuildIssue = {
  severity: "error",
  code: "E-EMBED-MISSING",
  file: "part-1_foundations/chapter-1_computer-architecture.md",
  line: 3,
  message: 'The diagram "01-ligth.svg" can\'t be found in the vault.',
  fix: "check the spelling, or export the diagram from Excalidraw into a diagram/ folder.",
};
const warning = (code: string, file: string): BuildIssue => ({ severity: "warning", code, file, message: "Something minor.", fix: "Optional." });

/** Runs the integration's end-of-build hook the way Astro does, capturing what it prints and how it exits. */
async function runBuildDone(issues: BuildIssue[]) {
  const collector = createIssueCollector();
  issues.forEach((i) => collector.add(i));
  const out: string[] = [];
  const exits: number[] = [];
  const integration = buildReport({ issues: collector, write: async (t) => void out.push(t), exit: (c) => void exits.push(c) });
  const hook = integration.hooks["astro:build:done"] as unknown as () => Promise<void>;
  await hook();
  return { text: out.join(""), exits };
}

describe("build issues and build report", () => {
  // @req REQ-CNT-007.AC2
  it("lists one error and two warnings together at the end, errors first, and exits non-zero", async () => {
    const { text, exits } = await runBuildDone([warning("W-ARTICLE-UNDATED", "articles/a.md"), error, warning("W-ABOUT-MISSING", "about.md")]);
    const heads = text.split("\n").filter((l) => /^(✖|⚠) /.test(l));
    expect(heads).toEqual([
      "✖ ERROR E-EMBED-MISSING  part-1_foundations/chapter-1_computer-architecture.md:3",
      "⚠ WARNING W-ABOUT-MISSING  about.md",
      "⚠ WARNING W-ARTICLE-UNDATED  articles/a.md",
    ]);
    expect(text.trimEnd().split("\n").at(-1)).toBe("The build found 1 error and 2 warnings. Errors stop the publish: fix them, then build again.");
    expect(exits).toEqual([1]);
  });

  it("prints a block in the contract's form (specs/contracts/build-messages.md)", () => {
    expect(formatReport([error])).toContain(
      [
        "✖ ERROR E-EMBED-MISSING  part-1_foundations/chapter-1_computer-architecture.md:3",
        '  The diagram "01-ligth.svg" can\'t be found in the vault.',
        "  Fix: check the spelling, or export the diagram from Excalidraw into a diagram/ folder.",
      ].join("\n"),
    );
  });

  it("keeps multi-line fix text inside its block", () => {
    expect(formatReport([{ ...error, fix: "Example:\n---\ntitle: X\n---" }])).toContain("  Fix: Example:\n  ---\n  title: X\n  ---");
  });

  it("prints warnings without failing the build, and prints nothing when all is well", async () => {
    const warned = await runBuildDone([warning("W-ABOUT-MISSING", "about.md")]);
    expect(warned.text).toContain("Warnings don't stop the publish.");
    expect(warned.exits).toEqual([]);
    expect(await runBuildDone([])).toEqual({ text: "", exits: [] });
  });

  it("collects issues once each and knows when there's an error", () => {
    const c = createIssueCollector();
    c.add(warning("W-ABOUT-MISSING", "about.md"));
    expect(c.hasErrors()).toBe(false);
    c.add(error);
    c.add({ ...error });
    expect(c.all()).toHaveLength(2);
    expect(c.hasErrors()).toBe(true);
  });

  it("refuses an issue whose code doesn't match its severity (a programmer error)", () => {
    expect(() => createIssueCollector().add({ ...error, severity: "warning" })).toThrow(/E-EMBED-MISSING must have severity error/);
    expect(() => createIssueCollector().add({ ...error, code: "embed-missing" })).toThrow(/isn't of the form/);
  });

  it("is registered in astro.config.ts", () => {
    expect(config.integrations?.map((i) => (i as { name: string }).name)).toContain("sdfp:build-report");
  });
});
