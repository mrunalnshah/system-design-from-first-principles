import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoCookies, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/** T-01.14: Chapter 1 from the fixture vault (the real text, with drawing embeds), in every project. */
const CHAPTER = "book/computer-architecture/";

test.describe("Chapter 1", () => {
  // @req REQ-BOOK-002.AC1
  test("is published at book/computer-architecture/", async ({ page }) => {
    const response = await page.goto(CHAPTER);
    expect(response?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe("/system-design-from-first-principles/book/computer-architecture/");
  });

  // @req NFR-009
  test("shows the chapter as written: both diagrams, typeset math and numbered sections", async ({ page }) => {
    await page.goto(CHAPTER);
    await expect(page.locator("figure.diagram")).toHaveCount(2);
    await expect(page.locator(".prose .katex").first()).toBeVisible();
    await expect(page.locator(".prose h2").first()).toHaveText(/1\.1\s*Components/);
    await expect(page.locator(".prose")).not.toContainText("![[");
    await expect(page.locator(".prose")).not.toContainText("$\\mu");
  });

  // @req REQ-DIAG-001.AC2
  test("in dark mode, shows the dark diagram and never downloads the light one", async ({ page, colorScheme }) => {
    test.skip(colorScheme !== "dark", "dark mode only");
    const svgs: string[] = [];
    page.on("request", (r) => void (r.url().endsWith(".svg") && svgs.push(r.url())));
    await page.goto(CHAPTER);
    const img = page.locator("figure.diagram img").first();
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(/01-computer-architecture-dark\.svg$/);
    expect(svgs.some((u) => /01-computer-architecture-dark\.svg$/.test(u))).toBe(true);
    expect(svgs.some((u) => /01-computer-architecture-light\.svg$/.test(u))).toBe(false);
  });

  // @req REQ-DIAG-001.AC5
  test("switches the figure when the system theme changes, with JavaScript off", async ({ page, javaScriptEnabled }) => {
    test.skip(javaScriptEnabled, "JavaScript off only");
    await page.emulateMedia({ colorScheme: "light" });
    await page.goto(CHAPTER);
    const img = page.locator("figure.diagram img").first();
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(/-light\.svg$/);
    await page.emulateMedia({ colorScheme: "dark" });
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(/-dark\.svg$/);
  });

  // @req REQ-DIAG-002.AC3
  test("fits every diagram on a 320 px screen with no sideways page scroll", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(CHAPTER);
    for (const fig of await page.locator("figure.diagram").all()) expect((await fig.boundingBox())!.width).toBeLessThanOrEqual(320);
    await expectNoHorizontalScroll(page);
  });

  // @req REQ-DIAG-005.AC1
  test("keeps layout shift at or under 0.1 while the diagrams arrive slowly", async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, "needs the page's PerformanceObserver");
    await page.route("**/*.svg", async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto(CHAPTER);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForLoadState("networkidle");
    const cls = await page.evaluate(
      () =>
        new Promise<number>((done) => {
          let total = 0;
          new PerformanceObserver((list) => {
            for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) total += e.value;
          }).observe({ type: "layout-shift", buffered: true });
          setTimeout(() => done(total), 500);
        }),
    );
    expect(cls).toBeLessThanOrEqual(0.1);
  });

  test("passes the shared checks: accessibility, no foreign requests or cookies, no sideways scroll", async ({ page, context }) => {
    await page.goto(CHAPTER);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await expectOnlySameOriginRequests(page);
    await expectNoCookies(context);
  });
});
