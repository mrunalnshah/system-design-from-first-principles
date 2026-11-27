import { expect } from "@playwright/test";
import { test } from "./helpers.ts";

/** T-02.04: arrow keys between the fixture's Chapter 1 (computer-architecture) and Chapter 2 (tcp). */
const CHAPTER_1 = "book/computer-architecture/";
const CHAPTER_2 = "book/tcp/";

test.describe("keyboard previous/next", () => {
  // @req REQ-BOOK-005.AC1
  test("opens the next chapter with →, and comes back with ←", async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, "JavaScript on only");
    await page.goto(CHAPTER_1);
    await page.locator("h1").click(); // focus on the page, not the address bar
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/book\/tcp\/$/);
    await page.locator("h1").click();
    await page.keyboard.press("ArrowLeft");
    await expect(page).toHaveURL(/\/book\/computer-architecture\/$/);
  });

  test("stays put at the ends of the book and with a modifier held", async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, "JavaScript on only");
    await page.goto(CHAPTER_1);
    await page.locator("h1").click();
    await page.keyboard.press("ArrowLeft"); // Chapter 1 has no previous chapter
    await page.keyboard.press("Shift+ArrowRight");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/book\/computer-architecture\/$/);
    await page.goto(CHAPTER_2);
    await page.locator("h1").click();
    await page.keyboard.press("ArrowRight"); // Chapter 2 is the last
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/book\/tcp\/$/);
  });

  // @req REQ-BOOK-005.AC2
  test("does nothing while the full-screen diagram view is open", async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, "JavaScript on only");
    await page.goto(CHAPTER_1);
    await page.locator("figure[data-diagram]").first().getByRole("button").click();
    const viewer = page.locator("dialog[data-diagram-viewer]");
    await expect(viewer).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/book\/computer-architecture\/$/);
    await expect(viewer).toBeVisible();
    // Closed again, the arrow keys work.
    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await page.keyboard.press("ArrowRight");
    await expect(page).toHaveURL(/\/book\/tcp\/$/);
  });

  test("leaves a wide formula's arrow keys to scroll it", async ({ page, viewport, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled || viewport?.width !== 320, "320 px with JavaScript");
    await page.goto(CHAPTER_2);
    const formula = page.locator(".math-display").first();
    await formula.focus();
    expect(await formula.evaluate((f) => f.scrollWidth > f.clientWidth)).toBe(true);
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/book\/tcp\/$/);
  });

  test("puts the neighbours in the head for the browser and the keys", async ({ page }) => {
    await page.goto(CHAPTER_1);
    await expect(page.locator('link[rel="prev"]')).toHaveCount(0);
    await expect(page.locator('link[rel="next"]')).toHaveAttribute("href", /\/book\/tcp\/$/);
  });
});
