import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/** T-03.01: the fixture vault's one article, `articles/why-caches.md`, dated 2026-11-01 (design/screens/article.md). */
const ARTICLE = "articles/why-caches/";

test.describe("article page", () => {
  // @req REQ-ART-001.AC1
  test("serves articles/why-caches.md at /articles/why-caches/, in the calm reader", async ({ page }) => {
    const response = await page.goto(ARTICLE);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/system-design-from-first-principles/articles/why-caches/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^why caches$/i);
    await expect(page.locator(".reader-eyebrow")).toHaveText("Article");
    await expect(page.locator(".prose")).toContainText("A disk read feels slow because it is.");
    // No chapter menu, no big number, no previous/next: an article stands alone.
    await expect(page.locator(".reader-menu, .chapter-number, .prev-next")).toHaveCount(0);
    // The header shows Articles as the section this page is in.
    await expect(page.locator(".nav-inline [aria-current='true']")).toHaveText("Articles");
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await expectOnlySameOriginRequests(page);
  });

  // @req REQ-READ-009.AC1
  test("reads the date 2026-11-01 as 1 November 2026, with the reading time and the end links", async ({ page }) => {
    await page.goto(ARTICLE);
    const date = page.locator(".reader-meta time");
    await expect(date).toHaveText("1 November 2026");
    await expect(date).toHaveAttribute("datetime", "2026-11-01");
    await expect(page.locator(".reader-meta")).toHaveText(/^1 November 2026 · \d+ min read$/);
    const end = page.getByRole("navigation", { name: "After the article" });
    await expect(end.getByRole("link", { name: "All articles →" })).toHaveAttribute("href", "/system-design-from-first-principles/articles/");
    await expect(end.getByRole("link", { name: "Read the book →" })).toHaveAttribute("href", "/system-design-from-first-principles/book/");
  });

  test("keeps the end links comfortable targets on a phone", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(ARTICLE);
    for (const link of await page.locator(".article-end a").all())
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  });
});
