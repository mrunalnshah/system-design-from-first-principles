import { expect, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoCspViolations, expectNoHorizontalScroll, test } from "./helpers.ts";

/** T-01.19: the full-screen view, on Chapter 1 of the fixture vault (two diagrams) and Chapter 2 (none). */
const CHAPTER_1 = "book/computer-architecture/";
const CHAPTER_2 = "book/tcp/";

/** The diagram's zoom in the open view: the horizontal scale of its transform (1 when untouched). */
const scale = (page: Page) =>
  page.locator(".diagram-viewer-image").evaluate((img) => {
    const t = getComputedStyle(img).transform;
    return t === "none" ? 1 : new DOMMatrixReadOnly(t).a;
  });

test.describe("diagram viewer", () => {
  // @req REQ-DIAG-003.AC1
  test("on a phone, a tap opens the diagram full screen, and it pinch-zooms to 400%", async ({
    browser,
    colorScheme,
    javaScriptEnabled,
  }, testInfo) => {
    test.skip(testInfo.project.use.viewport?.width !== 320 || !javaScriptEnabled, "phone with JavaScript");
    const context = await browser.newContext({
      viewport: { width: 375, height: 700 },
      hasTouch: true,
      isMobile: true,
      colorScheme: colorScheme ?? "light",
    });
    try {
      const page = await context.newPage();
      await page.goto(CHAPTER_1);
      const figure = page.locator("figure[data-diagram]").first();
      await figure.scrollIntoViewIfNeeded();
      await figure.getByRole("button").tap();

      const viewer = page.getByRole("dialog", { name: /^Diagram/ });
      await expect(viewer).toBeVisible();
      const box = (await viewer.boundingBox())!;
      expect(box).toEqual({ x: 0, y: 0, width: 375, height: 700 });
      // On the theme's diagram background, showing the variant the page already shows.
      const bg = await viewer.evaluate((d) => getComputedStyle(d).backgroundColor);
      expect(bg).toBe(colorScheme === "dark" ? "rgb(18, 18, 18)" : "rgb(255, 255, 255)");
      const shown = await figure.locator("img").evaluate((i: HTMLImageElement) => i.currentSrc);
      expect(await page.locator(".diagram-viewer-image").getAttribute("src")).toBe(shown);

      // Two fingers spread across the diagram, the way a reader pinches, and then some more: it stops at 400%.
      const cdp = await context.newCDPSession(page);
      const y = 400;
      const touch = (type: "touchStart" | "touchMove" | "touchEnd", points: { x: number; y: number }[]) =>
        cdp.send("Input.dispatchTouchEvent", { type, touchPoints: points.map((p, id) => ({ ...p, id })) });
      await touch("touchStart", [
        { x: 170, y },
        { x: 205, y },
      ]);
      for (let step = 1; step <= 20; step++) {
        const spread = 17.5 + step * 8;
        await touch("touchMove", [
          { x: 187.5 - spread, y },
          { x: 187.5 + spread, y },
        ]);
      }
      await touch("touchEnd", []);
      await expect.poll(() => scale(page)).toBeCloseTo(4, 1);
      expect(await scale(page)).toBeLessThanOrEqual(4);
    } finally {
      await context.close();
    }
  });

  // @req REQ-DIAG-003.AC2
  test("Escape closes the full-screen view and puts focus back on the diagram", async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, "JavaScript on only");
    await page.goto(CHAPTER_1);
    const opener = page.locator("figure[data-diagram]").first().getByRole("button");
    await opener.focus();
    await page.keyboard.press("Enter");
    const viewer = page.locator("dialog[data-diagram-viewer]");
    await expect(viewer).toBeVisible();
    expect(await viewer.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    await expectNoA11yViolations(page);

    await page.keyboard.press("Escape");
    await expect(viewer).toBeHidden();
    await expect(opener).toBeFocused();
    await expectNoCspViolations(page);
  });

  // The rest of the statement (REQ-DIAG-003): wheel, + and − keys and buttons, the close button, a tap beside it.
  test("zooms with the + and − keys and buttons and the wheel, and closes with the close button or a tap beside it", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(viewport?.width !== 1280 || !javaScriptEnabled, "1280 px with JavaScript");
    await page.goto(CHAPTER_1);
    const opener = page.locator("figure[data-diagram]").first().getByRole("button");
    await opener.click();
    const viewer = page.locator("dialog[data-diagram-viewer]");
    await expect(viewer).toBeVisible();

    await page.keyboard.press("+");
    await expect.poll(() => scale(page)).toBeGreaterThan(1);
    await page.keyboard.press("0");
    await expect.poll(() => scale(page)).toBeCloseTo(1, 2);
    for (let i = 0; i < 10; i++) await viewer.getByRole("button", { name: "Zoom in" }).click();
    await expect.poll(() => scale(page)).toBeCloseTo(4, 2);
    await viewer.getByRole("button", { name: "Zoom out" }).click();
    await expect.poll(() => scale(page)).toBeLessThan(4);
    await page.keyboard.press("0");
    await page.mouse.move(640, 450);
    await page.mouse.wheel(0, -300);
    await expect.poll(() => scale(page)).toBeGreaterThan(1);

    await viewer.getByRole("button", { name: "Close full screen view" }).click();
    await expect(viewer).toBeHidden();
    await expect(opener).toBeFocused();

    // A tap beside the diagram closes it too; the diagram fits the screen, so there's room at its sides.
    await opener.click();
    await expect(viewer).toBeVisible();
    const img = (await page.locator(".diagram-viewer-image").boundingBox())!;
    expect(img.x).toBeGreaterThan(20);
    await page.mouse.click(10, img.y + img.height / 2);
    await expect(viewer).toBeHidden();
    await expect(opener).toBeFocused();
  });

  // @req REQ-DIAG-003.AC3
  test("without JavaScript, selecting a diagram opens its SVG on its own in the same tab", async ({
    page,
    context,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, "JavaScript off only");
    await page.goto(CHAPTER_1);
    const link = page.locator("figure[data-diagram] a.diagram-link").first();
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/system-design-from-first-principles\/diagrams\/[0-9a-f]{8}-.+\.svg$/);
    const pages = context.pages().length;
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().endsWith(href!)), link.click()]);
    await expect(page).toHaveURL(new RegExp(`${href!.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
    expect(response.headers()["content-type"]).toMatch(/^image\/svg\+xml/);
    expect(context.pages().length).toBe(pages);
  });

  test("loads no viewer on a chapter without diagrams", async ({ page, javaScriptEnabled }) => {
    test.skip(!javaScriptEnabled, "JavaScript on only");
    const scripts: string[] = [];
    page.on("response", async (r) => {
      if (r.request().resourceType() === "script") scripts.push(await r.text());
    });
    await page.goto(CHAPTER_2);
    await page.waitForLoadState("networkidle");
    await expect(page.locator("dialog[data-diagram-viewer]")).toHaveCount(0);
    expect(scripts.length).toBeGreaterThan(0);
    expect(scripts.some((s) => s.includes("panzoom"))).toBe(false);
    await expectNoHorizontalScroll(page);
  });
});
