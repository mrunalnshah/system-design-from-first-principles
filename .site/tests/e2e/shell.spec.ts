import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, test } from "./helpers.ts";

/** T-01.15: what every page shares, on the homepage and Chapter 1 (fixture vault). */
const PAGES = ["", "book/computer-architecture/"];

test.describe("site shell", () => {
  // @req REQ-SITE-001.AC1
  test("shows the author and the portfolio from book.md in the header", async ({ page, viewport }) => {
    await page.goto(PAGES[1]!);
    const header = page.locator("header.site-header");
    await expect(header.locator(".byline")).toHaveText("by Mrunal Nirajkumar Shah");
    const portfolio = header.locator('a.external[href="https://mrunalnshah.github.io/"]');
    await expect(portfolio).toHaveCount(2); // the row (wide) and the menu (narrow); one shows at a time
    await expect(header.locator(viewport!.width >= 768 ? ".nav-inline a.external" : ".nav-menu a.external")).toBeAttached();
  });

  // @req REQ-SITE-001.AC2
  test("fits the header on one row at 375 px, with Contents, Articles and the portfolio in a menu", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(PAGES[1]!);
    const row = page.locator(".header-row");
    const brand = await row.locator(".brand").boundingBox();
    const menu = page.locator(".nav-menu summary");
    await expect(menu).toBeVisible();
    await expect(page.locator(".nav-inline")).toBeHidden();
    const button = (await menu.boundingBox())!;
    expect(Math.abs(button.y + button.height / 2 - (brand!.y + brand!.height / 2))).toBeLessThan(brand!.height / 2); // the same row
    await menu.click();
    const links = page.locator(".nav-menu nav a");
    await expect(links.filter({ hasText: "Contents" })).toBeVisible();
    await expect(links.filter({ hasText: "Articles" })).toBeVisible();
    await expect(links.filter({ hasText: "Portfolio" })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  // @req REQ-SITE-001.AC3
  test("opens the portfolio in the same tab and announces it as an external site", async ({ page }) => {
    await page.goto(PAGES[1]!);
    for (const link of await page.locator('a.external[href="https://mrunalnshah.github.io/"]').all()) {
      expect(await link.getAttribute("target")).toBeNull();
      await expect(link).toContainText("(external site)");
    }
  });

  // @req REQ-SITE-002.AC1
  test("shows the dark theme from the first paint for a reader in dark mode, without JavaScript", async ({ page, colorScheme }) => {
    test.skip(colorScheme !== "dark", "dark mode only");
    await page.goto(PAGES[1]!, { waitUntil: "commit" });
    await page.waitForFunction(() => document.body !== null);
    // The theme is CSS only: render-blocking stylesheets in <head>, switched by prefers-color-scheme.
    const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    expect(bg).toBe("rgb(18, 18, 18)");
    expect(await page.locator("head script").count()).toBe(0);
  });

  // @req REQ-SITE-005.AC1
  test("titles Chapter 1 'Computer Architecture · System Design from First Principles'", async ({ page }) => {
    await page.goto(PAGES[1]!);
    await expect(page).toHaveTitle("Computer Architecture · System Design from First Principles");
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute("content", "Computer Architecture · System Design from First Principles");
    await expect(page.locator('meta[http-equiv="Content-Security-Policy"]')).toHaveCount(1);
  });

  // @req REQ-SITE-005.AC2
  test("leaves drafts out of the sitemap, and lists the published chapters", async ({ request }) => {
    const index = await (await request.get("sitemap-index.xml")).text();
    const map = /<loc>([^<]+sitemap-0\.xml)<\/loc>/.exec(index)![1]!;
    const urls = await (await request.get(new URL(map).pathname.replace(/^\/system-design-from-first-principles\//, ""))).text();
    expect(urls).toContain("/book/computer-architecture/");
    expect(urls).toContain("/book/tcp/");
    expect(urls).not.toContain("/book/queues/"); // the draft
    expect(urls).not.toMatch(/404|diagrams\//);
  });

  // @req REQ-SITE-008.AC1
  test("signs the footer '© <year> Mrunal Nirajkumar Shah'", async ({ page }) => {
    await page.goto(PAGES[0]!);
    await expect(page.locator("footer .copyright")).toHaveText(`© ${new Date().getUTCFullYear()} Mrunal Nirajkumar Shah`);
  });

  test("passes the accessibility check on every page it frames", async ({ page }) => {
    for (const path of PAGES) {
      await page.goto(path);
      await expectNoA11yViolations(page);
    }
  });
});
