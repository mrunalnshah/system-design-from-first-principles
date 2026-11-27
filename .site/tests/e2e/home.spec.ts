import { expect } from "@playwright/test";
import {
  expectNoA11yViolations,
  expectNoCspViolations,
  expectNoHorizontalScroll,
  expectOnlySameOriginRequests,
  test,
} from "./helpers.ts";

/** T-02.05: the homepage of the fixture vault (book.md has hero_image: 01-light.svg; Chapter 1 comes first). */
const HOME = "";

test.describe("homepage hero", () => {
  // @req REQ-HOME-001.AC1
  test("shows the book's title as the page's only h1", async ({ page }) => {
    const response = await page.goto(HOME);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toHaveCount(1);
    await expect(page.locator("h1")).toHaveText("System Design from First Principles");
    await expect(page.locator(".hero-subtitle")).toHaveText("How large systems work, from the hardware up.");
    await expect(page.locator(".hero-author")).toHaveText("by Mrunal Nirajkumar Shah");
    await expect(page.locator(".hero-pitch")).toContainText("A book that starts from the computer itself.");
    await expect(page.locator(".hero-stats")).toHaveText(/^2 chapters · \d+ min read$/);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
    await expectOnlySameOriginRequests(page);
    await expectNoCspViolations(page);
  });

  // @req REQ-HOME-001.AC2
  test("opens Chapter 1 from Read from the start", async ({ page }) => {
    await page.goto(HOME);
    const button = page.getByRole("link", { name: "Read from the start" });
    expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await button.click();
    await expect(page).toHaveURL(/\/book\/computer-architecture\/$/);
    await page.goBack();
    await page.getByRole("link", { name: "Contents →" }).click();
    await expect(page).toHaveURL(/\/book\/$/);
  });

  // @req REQ-HOME-001.AC3
  test("shows 01-dark.svg in the hero for a reader in dark mode, and 01-light.svg in light", async ({
    page,
    colorScheme,
  }) => {
    await page.goto(HOME);
    const img = page.locator(".hero-art img");
    await expect(img).toBeVisible();
    await expect(img).toHaveAttribute("loading", "eager");
    await expect
      .poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc))
      .toMatch(colorScheme === "dark" ? /-01-dark\.svg$/ : /-01-light\.svg$/);
    // And it's there: the image loaded (the diagram route publishes the hero's pair too).
    await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
  });

  // @req REQ-HOME-001.AC4
  test("without a hero image, the text takes the whole width and no empty column is left", async ({
    page,
    viewport,
  }) => {
    test.skip(viewport?.width !== 1280, "1280 px only: narrower screens are one column anyway");
    await page.goto(HOME);
    const columns = () => page.locator(".hero-text").evaluate((t) => getComputedStyle(t).gridTemplateColumns);
    const widths = async () => ({
      text: (await page.locator(".hero-text").boundingBox())!.width,
      title: (await page.locator(".hero h1").boundingBox())!.width,
      pitch: (await page.locator(".hero-pitch").boundingBox())!.width,
    });
    // With the image: two columns, the text in the left one (so this test can tell the difference).
    expect((await columns()).split(" ")).toHaveLength(2);
    expect((await widths()).title).toBeLessThan((await widths()).text * 0.7);
    // The page as it's built without hero_image: no figure, and the hero marked as such (home.test.ts checks the markup).
    await page.evaluate(() => {
      document.querySelector(".hero-art")!.remove();
      document.querySelector(".hero")!.classList.add("hero--no-image");
    });
    // One column: the title spans the hero, and the pitch keeps its reading width rather than a column's.
    expect(await columns()).toBe("none");
    const w = await widths();
    expect(w.title).toBeGreaterThanOrEqual(w.text - 1);
    expect(w.pitch).toBeGreaterThan(w.text * 0.5);
  });

  // @req REQ-HOME-004.AC1
  test("loads no script at all", async ({ page }) => {
    const scripts: string[] = [];
    page.on("request", (r) => void (r.resourceType() === "script" && scripts.push(r.url())));
    await page.goto(HOME);
    await page.waitForLoadState("networkidle");
    expect(scripts).toEqual([]);
    await expect(page.locator("script")).toHaveCount(0);
  });

  test("puts the diagram beside the text at 1280 px and under the title on a phone", async ({ page, viewport }) => {
    await page.goto(HOME);
    const art = (await page.locator(".hero-art").boundingBox())!;
    const title = (await page.locator("h1").boundingBox())!;
    const pitch = (await page.locator(".hero-pitch").boundingBox())!;
    if (viewport!.width >= 1100) {
      expect(art.x).toBeGreaterThan(title.x + title.width / 2);
    } else {
      expect(art.y).toBeGreaterThan(title.y);
      expect(art.y).toBeLessThan(pitch.y);
    }
  });
});
