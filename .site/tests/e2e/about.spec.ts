import { cpSync, existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { expect } from "@playwright/test";
import { buildFixtureSite } from "../build-site.ts";
import { cleanUp, tempFolder } from "../../tools/test-site.ts";
import { expectNoA11yViolations, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/** T-03.03: the fixture vault's about.md ("I write about systems.", by Mrunal Nirajkumar Shah, design/screens/about.md). */
const ABOUT = "about/";
const BASE = "/system-design-from-first-principles/";

test.describe("about page", () => {
  // @req REQ-SITE-003.AC1
  test("shows about.md at /about/ in the reading view, under the author's name", async ({ page }) => {
    const response = await page.goto(ABOUT);
    expect(response?.status()).toBe(200);
    await expect(page.locator(".reader-eyebrow")).toHaveText("About");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mrunal Nirajkumar Shah");
    await expect(page.locator(".reader--page .prose")).toContainText("I write about systems.");
    // The header's name and its About link lead here, and the About link is this page.
    await expect(page.locator(".byline a")).toHaveAttribute("href", `${BASE}about/`);
    await expect(page.locator(".nav-inline [aria-current='page']")).toHaveText("About");
    const end = page.getByRole("navigation", { name: "After the page" });
    await expect(
      end.getByRole("link", { name: /^Portfolio: mrunalnshah\.github\.io \(external site\) →$/ }),
    ).toHaveAttribute("href", "https://mrunalnshah.github.io/");
    await expect(end.getByRole("link", { name: "Start reading the book →" })).toHaveAttribute(
      "href",
      `${BASE}book/computer-architecture/`,
    );
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await expectOnlySameOriginRequests(page);
  });

  test("keeps the end links comfortable targets on a phone", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(ABOUT);
    for (const link of await page.locator(".reader-end a").all())
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  });
});

/**
 * The same site from a copy of the fixture vault without about.md: a build of its own, so only one project runs it
 * (the result doesn't depend on theme, size or JavaScript).
 */
test.describe("without about.md", () => {
  let dist = "";
  let printed = "";
  test.beforeAll(async ({}, info) => {
    if (info.project.name !== "light-js-1280") return;
    test.setTimeout(240_000);
    const vault = tempFolder("sdfp-no-about-vault-");
    cpSync(join(import.meta.dirname, "../fixtures/vault"), vault, { recursive: true });
    rmSync(join(vault, "about.md"));
    dist = tempFolder("sdfp-no-about-site-");
    printed = buildFixtureSite(dist, undefined, vault);
  });
  test.afterAll(cleanUp);

  // @req REQ-SITE-003.AC2
  test("builds no About page, links the header's name to the portfolio, and warns", async ({}, info) => {
    test.skip(info.project.name !== "light-js-1280", "one build, in one project");
    expect(existsSync(join(dist, "about", "index.html"))).toBe(false);
    for (const page of ["index.html", "book/index.html", "articles/index.html", "articles/why-caches/index.html", "404.html"]) {
      const html = readFileSync(join(dist, page), "utf8");
      expect(html, page).toMatch(
        /class="byline"[^>]*>\s*by\s*<a class="external" href="https:\/\/mrunalnshah\.github\.io\/"[^>]*>\s*Mrunal Nirajkumar Shah/,
      );
      // No link to the missing page anywhere: not the header's About, not the footer's.
      expect(html, page).not.toContain(`href="${BASE}about/"`);
    }
    expect(printed).toMatch(/W-ABOUT-MISSING\s+about\.md/);
    expect(printed).toContain("Create about.md to get an About page.");
  });
});
