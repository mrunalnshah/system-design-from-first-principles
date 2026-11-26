import { defineConfig } from "vitest/config";

/**
 * Unit and golden tests (specs/standards.md#testing). End-to-end tests are Playwright's
 * (tests/e2e, TOOL-09) and fixtures are data, so neither is collected here.
 */
export default defineConfig({
  test: {
    include: ["tools/**/*.test.ts", "src/**/*.test.ts", "tests/**/*.test.ts"],
    exclude: ["node_modules/**", "dist/**", "tests/e2e/**", "tests/fixtures/**"],
  },
});
