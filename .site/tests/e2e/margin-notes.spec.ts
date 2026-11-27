import { expect, type Locator, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoHorizontalScroll, test } from "./helpers.ts";

/** T-01.18: margin notes on the fixture's Chapter 2, whose first paragraph ends with footnote 1. */
const CHAPTER_2 = "book/tcp/";

/** The vertical middle of the text line the marker sits on (the character before it), and of the note's first line. */
async function lineMiddles(page: Page): Promise<{ ref: number; note: number }> {
  return page.evaluate(() => {
    const middle = (r: DOMRect) => r.top + r.height / 2;
    const marker = document.querySelector(".prose .ref[data-note='1']")!;
    const before = marker.previousSibling as Text;
    const r1 = document.createRange();
    r1.setStart(before, before.length - 1);
    r1.setEnd(before, before.length);
    const noteText = [...document.querySelector("#sn-1")!.childNodes].find(
      (n) => n.nodeType === Node.TEXT_NODE && n.textContent!.trim(),
    )!;
    const r2 = document.createRange();
    const start = noteText.textContent!.search(/\S/);
    r2.setStart(noteText, start);
    r2.setEnd(noteText, start + 1);
    return { ref: middle(r1.getBoundingClientRect()), note: middle(r2.getBoundingClientRect()) };
  });
}

const box = async (l: Locator) => (await l.boundingBox())!;

test.describe("margin notes", () => {
  // @req REQ-READ-006.AC1
  test("on a 1280 px screen, sets each note in the margin level with its line, below the note before it", async ({
    page,
    viewport,
  }) => {
    test.skip(viewport?.width !== 1280, "1280 px only");
    await page.goto(CHAPTER_2);
    const note = page.locator("#sn-1");
    await expect(note).toBeVisible();
    await expect(note).toContainText("a long enough outage");

    // In the margin: right of the text column, inside the page.
    const column = await box(page.locator(".reader-column"));
    const n = await box(note);
    expect(n.x).toBeGreaterThanOrEqual(column.x + column.width);
    expect(n.x + n.width).toBeLessThanOrEqual(1280);
    const { ref, note: first } = await lineMiddles(page);
    expect(Math.abs(first - ref), `note line at ${first}, its reference line at ${ref}`).toBeLessThanOrEqual(4);

    // A second note on the very next line must not overlap the first: copy the paragraph with its note right after it.
    await page.evaluate(() => {
      const p = document.querySelector("#sn-1")!.closest("p")!;
      const copy = p.cloneNode(true) as HTMLElement;
      copy.querySelectorAll("[id]").forEach((el) => (el.id = `${el.id}-copy`));
      p.after(copy);
    });
    const second = await box(page.locator("#sn-1-copy"));
    const firstBox = await box(note);
    expect(second.y).toBeGreaterThanOrEqual(firstBox.y + firstBox.height);
    await expectNoHorizontalScroll(page);
  });

  // @req REQ-READ-006.AC2
  test("on a 375 px screen, tapping marker 1 opens its note below that line, and tapping again closes it", async ({
    browser,
    colorScheme,
    javaScriptEnabled,
  }, testInfo) => {
    test.skip(testInfo.project.use.viewport?.width !== 320 || !javaScriptEnabled, "phone with JavaScript");
    // A touch phone, so the marker is tapped as a reader does.
    const context = await browser.newContext({
      viewport: { width: 375, height: 700 },
      hasTouch: true,
      isMobile: true,
      colorScheme: colorScheme ?? "light",
    });
    try {
      const page = await context.newPage();
      await page.goto(CHAPTER_2);
      const marker = page.getByRole("button", { name: "Note 1" });
      const note = page.locator("#sn-1");
      await expect(marker).toHaveAttribute("aria-expanded", "false");
      await expect(marker).toHaveAttribute("aria-controls", "sn-1");
      await expect(note).toBeHidden();

      await marker.tap();
      await expect(marker).toHaveAttribute("aria-expanded", "true");
      await expect(note).toBeVisible();
      // Below the marker's line, across the column.
      const m = await box(marker);
      const n = await box(note);
      expect(n.y).toBeGreaterThanOrEqual(m.y + m.height);
      expect(n.width).toBeGreaterThan(375 / 2);
      await expectNoA11yViolations(page);
      await expectNoHorizontalScroll(page);

      await marker.tap();
      await expect(marker).toHaveAttribute("aria-expanded", "false");
      await expect(note).toBeHidden();
      // The end list's way back still finds the marker.
      await expect(page.locator(".endnotes a[href='#ref-1']")).toHaveCount(1);
      await expect(page.locator("#ref-1")).toHaveCount(1);
    } finally {
      await context.close();
    }
  });

  test("moves between the margin and the toggle when the screen changes width", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(viewport?.width !== 1280 || !javaScriptEnabled, "1280 px with JavaScript");
    await page.goto(CHAPTER_2);
    await expect(page.locator("a.ref[data-note='1']")).toHaveCount(1);
    await expect(page.locator("#sn-1")).toBeVisible();
    await page.setViewportSize({ width: 600, height: 800 });
    await expect(page.getByRole("button", { name: "Note 1" })).toHaveAttribute("aria-expanded", "false");
    await expect(page.locator("#sn-1")).toBeHidden();
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect(page.locator("a.ref[data-note='1']")).toHaveCount(1);
    await expect(page.locator("#sn-1")).toBeVisible();
  });

  test("without JavaScript on a phone, the marker still links to the note in the end list", async ({
    page,
    viewport,
    javaScriptEnabled,
  }) => {
    test.skip(viewport?.width !== 320 || javaScriptEnabled, "phone without JavaScript");
    await page.goto(CHAPTER_2);
    await expect(page.locator("#sn-1")).toBeHidden();
    await page.locator("a.ref[data-note='1']").click();
    await expect(page).toHaveURL(/#fn-1$/);
    await expect(page.locator("#fn-1")).toBeInViewport();
  });
});
