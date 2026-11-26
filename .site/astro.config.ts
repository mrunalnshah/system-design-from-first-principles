import { defineConfig } from "astro/config";

/**
 * Build settings for the whole site.
 *
 * The site is a GitHub Pages project site, so every page lives under `base`
 * (CNF-003, ADR-0007). Internal addresses must always be built with `url()` from
 * MOD-site (T-00.08), never written by hand, so that moving to a custom domain later
 * only changes `site` and `base` here (REQ-SITE-013).
 */
export default defineConfig({
  site: "https://mrunalnshah.github.io",
  base: "/system-design-from-first-principles/",
  trailingSlash: "always",
  output: "static",
});
