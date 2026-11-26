/**
 * MOD-site public interface (specs/modules.md#mod-site, specs/contracts/interfaces.md).
 * Other modules and pages import only from here, never from this folder's other files (TOOL-06).
 * (astro.config.ts is the one exception: it imports build-report.ts directly, because Astro loads its
 * config before it can read the .astro component exported below.)
 */
export { absoluteUrl, url, type Route } from "./url.ts";
export { buildIssues, createIssueCollector, type BuildIssue, type IssueCollector } from "./issues.ts";
export { buildReport, stopOnErrors } from "./build-report.ts";
export { vaultRoot } from "./vault-root.ts";
export { buildRun, type BuildRun } from "./build-run.ts";
export { default as BaseLayout } from "./BaseLayout.astro";
