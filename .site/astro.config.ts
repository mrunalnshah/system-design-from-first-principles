import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
// Imported directly, not through ./src/features/site/index.ts: that also exports an .astro component,
// which Astro can't load while it's still reading this config.
import { buildReport } from "./src/features/site/build-report.ts";

/**
 * Build settings for the whole site.
 *
 * The site is a GitHub Pages project site, so every page lives under `base`
 * (CNF-003, ADR-0007). Internal addresses must always be built with `url()` from
 * MOD-site (T-00.08), never written by hand, so that moving to a custom domain later
 * only changes `site` and `base` here (REQ-SITE-013).
 *
 * `buildReport()` prints every content problem together at the end of the build and
 * fails it on any error (REQ-CNT-007). The sitemap lists every page with an address of its own: drafts have no
 * page, and the 404 and the diagram images are left out (REQ-SITE-005).
 *
 * The vault is the folder above .site/; the screen tests build the fixture vault instead, by setting SDFP_VAULT.
 */
const vault = process.env.SDFP_VAULT ? resolve(process.env.SDFP_VAULT) : fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  site: "https://mrunalnshah.github.io",
  base: "/system-design-from-first-principles/",
  trailingSlash: "always",
  output: "static",
  // The vault is the folder above .site/, wherever the build is started from (site/vault-root.ts).
  vite: { define: { "import.meta.env.SDFP_VAULT_ROOT": JSON.stringify(vault) } },
  // Keep buildReport() last: when there's an error it ends the build, so hooks after it wouldn't run.
  integrations: [sitemap({ filter: (page) => !/\/404\/?$|\/diagrams\//.test(page) }), buildReport()],
});
