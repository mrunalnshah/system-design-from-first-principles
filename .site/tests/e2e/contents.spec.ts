import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/** T-02.03: the contents page of the fixture vault (Part I: Chapter 1; Part II: Chapter 2, and a draft Chapter 3). */
const CONTENTS = "book/";

test.describe("contents page", () => {
  // @req REQ-BOOK-001.AC1
  test("shows I. Foundations, then 1. Computer Architecture with Components, Limitations and Moore's Law", async ({
    page,
  }) => {
    const response = await page.goto(CONTENTS);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contents");
    const parts = page.locator(".contents-part");
    await expect(parts.locator("h2")).toHaveText([/^I\.\s+Foundations$/, /^II\.\s+Networks$/]);
    const chapter = parts.first().locator(".contents-chapter").first();
    await expect(chapter.locator(".contents-number")).toHaveText("1.");
    await expect(chapter.getByRole("link", { name: "Chapter 1: Computer Architecture" })).toBeVisible();
    await expect(chapter.locator(".contents-sections a")).toHaveText(["Components", "Limitations", "Moore's Law"]);
    // The book's title and how much there is to read.
    await expect(page.locator(".contents-meta")).toHaveText(
      /^System Design from First Principles · 2 chapters · \d+ min$/,
    );
    // The header marks Contents as this page.
    await expect(page.locator(".site-header [aria-current='page']").first()).toHaveText("Contents");
    // The draft Chapter 3 isn't listed.
    await expect(page.locator(".contents-chapter")).toHaveCount(2);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await expectOnlySameOriginRequests(page);
  });

  // @req REQ-BOOK-001.AC3
  test("opens the chapter scrolled to a section when its sub-item is selected", async ({ page }) => {
    await page.goto(CONTENTS);
    await page.locator(".contents-sections").first().getByRole("link", { name: "Limitations" }).click();
    await expect(page).toHaveURL(/\/book\/computer-architecture\/#limitations$/);
    const heading = page.locator("#limitations");
    await expect(heading).toBeInViewport();
    // Below the sticky header (and the chapter bar on narrow screens), not under it.
    const top = await heading.evaluate((h) => h.getBoundingClientRect().top);
    const covers = await page.evaluate(() =>
      Math.max(
        ...[".site-header", ".chapter-bar"].map((s) => document.querySelector(s)?.getBoundingClientRect().bottom ?? 0),
      ),
    );
    expect(top).toBeGreaterThanOrEqual(covers - 1);
  });

  // @req REQ-ART-003.AC1
  test("lists no article", async ({ page }) => {
    await page.goto(CONTENTS);
    const main = page.locator("main");
    await expect(main).not.toContainText(/why caches/i);
    expect(await main.locator("a[href*='/articles/']").count()).toBe(0);
  });

  test("keeps every title and sub-item a comfortable target on a phone", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(CONTENTS);
    for (const link of await page.locator("main .contents a").all())
      expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(24);
  });
});
