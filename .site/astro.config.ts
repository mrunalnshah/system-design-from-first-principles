import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";
// Imported directly, not through ./src/features/site/index.ts: that also exports an .astro component,
// which Astro can't load while it's still reading this config.
import { buildReport } from "./src/features/site/build-report.ts";
import { indexablePages } from "./src/features/site/sitemap.ts";

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
 * page, the diagram images are left out, and so is every page that says noindex, the 404 and the redirects from
 * old addresses among them (REQ-SITE-005, REQ-BOOK-007.AC3).
 *
 * The vault is the folder above .site/; the screen tests build the fixture vault instead, by setting SDFP_VAULT.
 */
/** The output folder and base path Astro settled on (a `--outDir` or `--base` changes them), for the sitemap's noindex check. */
const built = { outDir: "", base: "" };
const indexable = indexablePages(built);
const vault = process.env.SDFP_VAULT ? resolve(process.env.SDFP_VAULT) : fileURLToPath(new URL("..", import.meta.url));
export default defineConfig({
  site: "https://mrunalnshah.github.io",
  base: "/system-design-from-first-principles/",
  trailingSlash: "always",
  output: "static",
  // The vault is the folder above .site/, wherever the build is started from (site/vault-root.ts).
  vite: {
    define: { "import.meta.env.SDFP_VAULT_ROOT": JSON.stringify(vault) },
    // Every asset is its own file, never an inline data: URL, so the CSP's font-src 'self' and script-src 'self'
    // allow them all (security.md B4: small KaTeX and JetBrains Mono fonts were being inlined).
    build: { assetsInlineLimit: 0 },
  },
  // Keep buildReport() last: when there's an error it ends the build, so hooks after it wouldn't run.
  integrations: [
    {
      name: "sdfp-built-site",
      hooks: {
        "astro:config:done": ({ config }) =>
          void Object.assign(built, { outDir: fileURLToPath(config.outDir), base: config.base }),
      },
    },
    // The sitemap integration already leaves out the 404 (which says noindex too); diagram images aren't pages.
    sitemap({ filter: (page) => !/\/diagrams\//.test(page) && indexable(page) }),
    buildReport(),
  ],
});
