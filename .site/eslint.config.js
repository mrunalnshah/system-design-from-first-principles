// Lint rules for the website and its tools (specs/standards.md#tooling).
// No accessibility lint plugin (CR-0001): accessibility is checked by axe in every screen test
// (TOOL-09) and by the token contrast check (TOOL-08).
import { defineConfig, globalIgnores } from "eslint/config";
import astro from "eslint-plugin-astro";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["dist/", "dist-e2e/", ".astro/", "node_modules/", "tests/fixtures/"]),
  tseslint.configs.recommended,
  astro.configs.recommended,
  {
    files: ["**/*.astro"],
    rules: {
      // ADR-0007: every internal address goes through url() so the base path is never forgotten.
      "no-restricted-syntax": [
        "error",
        {
          selector: "JSXAttribute[name.name=/^(href|src|action)$/] > Literal[value=/^\\//]",
          message: "Build internal addresses with url() from MOD-site (ADR-0007), not a raw '/…' string.",
        },
      ],
    },
  },
);
