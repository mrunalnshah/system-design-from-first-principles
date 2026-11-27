import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/** T-03.04: an address no page has, under the base path (design/screens/not-found.md; CNF-005 checked the host live). */
const MISSING = "book/does-not-exist/";
const BASE = "/system-design-from-first-principles/";

test.describe("not-found page", () => {
  // @req REQ-SITE-004.AC1
  test("answers /book/does-not-exist/ with 404 and the friendly page", async ({ page }) => {
    const response = await page.goto(MISSING);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Page not found");
    await expect(page).toHaveTitle(/^Page not found · System Design from First Principles$/);
    // The big faint number is decoration, drawn by CSS: screen readers hear the heading.
    const code = page.locator(".not-found-code");
    expect(await code.evaluate((el) => getComputedStyle(el, "::before").content)).toBe('"404"');
    await expect(code).toHaveAttribute("aria-hidden", "true");
    await expect(code).toBeVisible();
    await expect(page.locator(".not-found-why")).toHaveText("This page may have moved when a chapter was renamed.");
    // The ways back: Chapter 1, the contents and the homepage, all under the base path.
    const back = page.getByRole("navigation", { name: "Ways back" });
    await expect(back.getByRole("link", { name: "Read from the start" })).toHaveAttribute(
      "href",
      `${BASE}book/computer-architecture/`,
    );
    await expect(back.getByRole("link", { name: "Contents" })).toHaveAttribute("href", `${BASE}book/`);
    await expect(back.getByRole("link", { name: "Home" })).toHaveAttribute("href", BASE);
    // In the site's look: the shared header and footer. Not for search engines.
    await expect(page.locator(".site-header")).toBeVisible();
    await expect(page.locator(".site-footer")).toBeVisible();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await expectOnlySameOriginRequests(page);
  });

  test("keeps the ways back comfortable targets on a phone", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(MISSING);
    for (const link of await page.locator(".not-found-actions a").all())
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  });
});
