import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoCspViolations, expectNoHorizontalScroll, test } from "./helpers.ts";

/** T-01.17: the chapter menu on Chapter 1 of the fixture vault (1.1 Components, 1.2 Limitations, 1.3 Moore's Law). */
const CHAPTER = "book/computer-architecture/";

test.describe("chapter menu", () => {
  // @req REQ-READ-007.AC1
  test("highlights Limitations in the panel once the reader scrolls into section 1.2", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(viewport?.width !== 1280 || !javaScriptEnabled, "1280 px with JavaScript");
    await page.goto(CHAPTER);
    const panel = page.getByRole("navigation", { name: "Chapter" });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("link", { name: "System Design from First Principles" })).toBeVisible();
    const current = panel.locator('a[aria-current="location"]');

    // Scroll the way a reader does, with the wheel, until 1.2's heading sits just under the header (above the
    // reading line, 104 px), and 1.3's below it. How far one wheel tick goes differs by platform (Linux in CI went
    // past 1.3), so it steps in small ticks, waits for each to land, and steps back if it went too far.
    await page.evaluate(() => document.fonts.ready);
    const top = (id: string) => page.locator(`#${id}`).evaluate((h) => h.getBoundingClientRect().top);
    const settled = () =>
      page.evaluate(
        () =>
          new Promise<void>((done) => {
            let last = NaN;
            const tick = () =>
              scrollY === last ? done() : ((last = scrollY), requestAnimationFrame(() => requestAnimationFrame(tick)));
            tick();
          }),
      );
    for (let i = 0; i < 200; i++) {
      const at = await top("limitations");
      if (at > 100) await page.mouse.wheel(0, 40);
      else if (at < 70) await page.mouse.wheel(0, -20);
      else break;
      await settled();
    }
    const limitations = await top("limitations");
    expect(limitations, "1.2's heading just under the header").toBeGreaterThanOrEqual(70);
    expect(limitations).toBeLessThanOrEqual(100);
    expect(await top("moores-law"), "1.3's heading still below the reading line").toBeGreaterThan(104);
    await expect(current).toHaveCount(1);
    await expect(current).toHaveText(/1\.2\s+Limitations/);

    // Back up to 1.1.4 Cache: the highlight follows.
    await page.locator("#cache").evaluate((h) => h.scrollIntoView());
    await expect(current).toHaveText(/1\.1\.4\s+Cache/);

    // The panel stays in view, held at its place under the header (4rem + 2rem) however far the page scrolled.
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(300);
    expect(Math.abs((await panel.boundingBox())!.y - 96)).toBeLessThanOrEqual(2);
    await expectNoA11yViolations(page);
    await expectNoCspViolations(page);
  });

  // @req REQ-READ-007.AC2
  test("opens the sections sheet on a phone, moves focus into it, and Escape closes it back to the button", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(viewport?.width !== 320 || !javaScriptEnabled, "phone with JavaScript");
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(CHAPTER);
    const button = page.getByRole("button", { name: "Sections", exact: true });
    await expect(button).toBeVisible();
    await expect(page.locator(".chapter-panel")).toBeHidden();

    await button.click();
    const sheet = page.getByRole("dialog", { name: /1 · Computer Architecture/ });
    await expect(sheet).toBeVisible();
    await expect(button).toHaveAttribute("aria-expanded", "true");
    expect(await sheet.evaluate((d) => d.contains(document.activeElement))).toBe(true);
    // Focus stays in the sheet: Tab past its last link comes back into it.
    for (let i = 0; i < 12; i++) await page.keyboard.press("Tab");
    expect(
      await sheet.evaluate((d) => d.contains(document.activeElement) || document.activeElement === document.body),
    ).toBe(true);
    await expectNoA11yViolations(page);

    await page.keyboard.press("Escape");
    await expect(sheet).toBeHidden();
    await expect(button).toBeFocused();
    await expect(button).toHaveAttribute("aria-expanded", "false");

    // Choosing a section closes the sheet and goes there, with its heading below the bar, not under it.
    await button.click();
    await sheet.getByRole("link", { name: /1\.2\s+Limitations/ }).click();
    await expect(sheet).toBeHidden();
    await expect(page).toHaveURL(/#limitations$/);
    const barBottom = (await page.locator(".chapter-bar").boundingBox())!;
    await expect
      .poll(() => page.locator("#limitations").evaluate((h) => h.getBoundingClientRect().top))
      .toBeGreaterThanOrEqual(barBottom.y + barBottom.height);
    expect(await page.locator("#limitations").evaluate((h) => h.getBoundingClientRect().top)).toBeLessThanOrEqual(
      barBottom.y + barBottom.height + 40,
    );
    // Focus moves on to the chosen section, so the next Tab continues from there.
    await expect(page.locator("#limitations")).toBeFocused();
    await expectNoHorizontalScroll(page);
  });

  // @req REQ-READ-007.AC2
  test("closes the sheet with its close button and with a tap outside it", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(viewport?.width !== 320 || !javaScriptEnabled, "phone with JavaScript");
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(CHAPTER);
    const button = page.getByRole("button", { name: "Sections", exact: true });
    const sheet = page.locator("dialog[data-sections-sheet]");
    await button.click();
    await sheet.getByRole("button", { name: "Close sections" }).click();
    await expect(sheet).toBeHidden();
    await expect(button).toBeFocused();

    await button.click();
    await expect(sheet).toBeVisible();
    await page.mouse.click(187, 20); // above the sheet, on the backdrop
    await expect(sheet).toBeHidden();
  });

  // @req REQ-READ-007.AC3
  test("without JavaScript, lists the sections plainly under the title, and the links work", async ({
    page,
    javaScriptEnabled,
  }) => {
    test.skip(javaScriptEnabled, "JavaScript off only");
    await page.goto(CHAPTER);
    const list = page.locator(".chapter-toc");
    await expect(list).toBeVisible();
    await expect(list).toContainText("In this chapter");
    // Under the title: inside the chapter's header, after the h1.
    expect(
      await list.evaluate(
        (nav) =>
          !!nav.closest(".chapter-head") &&
          !!(document.querySelector("h1")!.compareDocumentPosition(nav) & Node.DOCUMENT_POSITION_FOLLOWING),
      ),
    ).toBe(true);
    await expect(page.locator(".chapter-panel")).toBeHidden();
    await expect(page.getByRole("button", { name: "Sections", exact: true })).toBeHidden();

    await list.getByRole("link", { name: /1\.2\s+Limitations/ }).click();
    await expect(page).toHaveURL(/#limitations$/);
    const top = await page.locator("#limitations").evaluate((h) => h.getBoundingClientRect().top);
    expect(top).toBeGreaterThanOrEqual(0);
    expect(top).toBeLessThan(200);
    await expectNoA11yViolations(page);
  });

  test("with JavaScript, shows no plain list (the panel or the bar has the sections)", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(!javaScriptEnabled, "JavaScript on only");
    await page.goto(CHAPTER);
    await expect(page.locator(".chapter-toc")).toBeHidden();
    const wide = (viewport?.width ?? 0) >= 1100;
    await expect(page.locator(".chapter-panel")).toBeVisible({ visible: wide });
    await expect(page.getByRole("button", { name: "Sections", exact: true })).toBeVisible({ visible: !wide });
    await expectNoHorizontalScroll(page);
  });
});
