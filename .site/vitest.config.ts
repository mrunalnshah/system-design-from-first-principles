/// <reference types="vitest/config" />
import { getViteConfig } from "astro/config";

/**
 * Unit and golden tests (specs/standards.md#testing). End-to-end tests are Playwright's
 * (tests/e2e, TOOL-09) and fixtures are data, so neither is collected here.
 * Run through Astro's own Vite setup, so tests can import a module's public index even when it
 * exports an .astro component (TOOL-06: other modules only through index.ts).
 */
export default getViteConfig({
  test: {
    include: ["tools/**/*.test.ts", "src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**", "tests/fixtures/**"],
  },
});
