import { defineConfig, type Project } from "@playwright/test";

/**
 * TOOL-09 screen tests (plan/tools.md, specs/standards.md#testing): every screen spec in tests/e2e runs in light and
 * dark, with JavaScript on and off, at 320, 768 and 1280 px, against `astro preview` of the built site.
 * The harness's own spec (helpers.spec.ts) tests the shared checks once, on pages it makes itself.
 * Never hits the network: the site is served locally, and specs route anything else away.
 */
const PORT = 4321;
const BASE = "/system-design-from-first-principles/";

const sizes = [
  { label: "320", viewport: { width: 320, height: 640 } },
  { label: "768", viewport: { width: 768, height: 1024 } },
  { label: "1280", viewport: { width: 1280, height: 800 } },
];

const screens: Project[] = (["light", "dark"] as const).flatMap((colorScheme) =>
  [true, false].flatMap((javaScriptEnabled) =>
    sizes.map(({ label, viewport }) => ({
      name: `${colorScheme}-${javaScriptEnabled ? "js" : "nojs"}-${label}`,
      testIgnore: /helpers\.spec\.ts/,
      use: { browserName: "chromium" as const, colorScheme, javaScriptEnabled, viewport },
    })),
  ),
);

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["github"]] : "list",
  use: { baseURL: `http://localhost:${PORT}${BASE}`, trace: "retain-on-failure" },
  projects: [
    { name: "harness", testMatch: /helpers\.spec\.ts/, use: { browserName: "chromium", viewport: { width: 320, height: 640 } } },
    ...screens,
  ],
  webServer: {
    // The site as it ships; the vault loader (T-01.14) points the build at the fixture vault.
    command: `npm run build && npx astro preview --port ${PORT}`,
    url: `http://localhost:${PORT}${BASE}`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
