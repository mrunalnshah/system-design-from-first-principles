import { expect } from "@playwright/test";
import { test } from "./helpers.ts";

/**
 * T-03.05: the fixture's Chapter 2 (`chapter-2_tcp.md`, moved_from: [transmission-control]) and its article
 * (`why-caches.md`, moved_from: [caches]). The old addresses must land on the new ones, with JavaScript on and off.
 */
const BASE = "/system-design-from-first-principles/";
const SITE = "https://mrunalnshah.github.io";

test.describe("redirects from old addresses", () => {
  // @req REQ-BOOK-007.AC1
  test("takes a reader who opens book/transmission-control/ to book/tcp/", async ({ page }) => {
    await page.goto("book/transmission-control/");
    await page.waitForURL(`**${BASE}book/tcp/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/Tcp$/);
  });

  test("says where the page went, with a link, for a browser that doesn't follow the refresh", async ({ request }) => {
    const html = await (await request.get("book/transmission-control/")).text();
    expect(html).toContain(`<meta http-equiv="refresh" content="0; url=${BASE}book/tcp/">`);
    expect(html).toMatch(new RegExp(`<a class="primary-button"[^>]*href="${BASE}book/tcp/"[^>]*>\\s*Go to “Tcp”\\s*</a>`));
    expect(html).toContain("<h1");
    expect(html).toContain("This chapter has moved");
  });

  // @req REQ-BOOK-007.AC3
  test("keeps redirect pages out of the sitemap and out of search, pointing search at the new page", async ({ request }) => {
    const sitemap = await (await request.get("sitemap-0.xml")).text();
    expect(sitemap).toContain(`<loc>${SITE}${BASE}book/tcp/</loc>`);
    expect(sitemap).toContain(`<loc>${SITE}${BASE}articles/why-caches/</loc>`);
    expect(sitemap).not.toContain("transmission-control");
    expect(sitemap).not.toContain(`${BASE}articles/caches/`);
    for (const [old, now] of [["book/transmission-control/", "book/tcp/"], ["articles/caches/", "articles/why-caches/"]]) {
      const html = await (await request.get(old!)).text();
      expect(html, old).toContain('<meta name="robots" content="noindex">');
      expect(html, old).toContain(`<link rel="canonical" href="${SITE}${BASE}${now}">`);
    }
  });

  // @req REQ-BOOK-007.AC4
  test("puts an article's redirect under articles/caches/, landing on articles/why-caches/", async ({ page }) => {
    const response = await page.goto("articles/caches/");
    expect(response?.status()).toBe(200);
    await page.waitForURL(`**${BASE}articles/why-caches/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/^why caches$/i);
  });
});
