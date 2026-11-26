import { expect } from "@playwright/test";
import { expectNoA11yViolations, expectNoCspViolations, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/** T-01.16: the reading page, on Chapter 1 and on the fixture's Chapter 2 (epigraph, wide formula, footnote). */
const CHAPTER_1 = "book/computer-architecture/";
const CHAPTER_2 = "book/tcp/";

test.describe("reader layout", () => {
  // @req REQ-READ-001.AC1
  test("keeps the text column between 60 and 75 characters on a 1280 px screen", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 1280, "1280 px only");
    await page.goto(CHAPTER_1);
    const chars = await page.evaluate(() => {
      const p = document.querySelector(".prose p")!;
      const ctx = document.createElement("canvas").getContext("2d")!;
      ctx.font = getComputedStyle(p).font;
      const text = p.textContent!;
      return document.querySelector(".reader-column")!.getBoundingClientRect().width / (ctx.measureText(text).width / text.length);
    });
    expect(chars).toBeGreaterThanOrEqual(60);
    expect(chars).toBeLessThanOrEqual(75);
  });

  // @req REQ-READ-001.AC2
  test("sets body text at 18 px or more on a 320 px screen, with no sideways scroll", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(CHAPTER_1);
    const size = await page.locator(".prose p").first().evaluate((p) => parseFloat(getComputedStyle(p).fontSize));
    expect(size).toBeGreaterThanOrEqual(18);
    await expectNoHorizontalScroll(page);
  });

  // @req REQ-READ-002.AC1
  // The chapter menu arrives in T-01.17, which extends this test to it (CR-0008); until then the site menu stands in.
  test("opens menus without animation for a reader who asks for reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto(CHAPTER_1);
    await page.locator(".nav-menu summary").click();
    const moving = await page.evaluate(() =>
      [...document.querySelectorAll("*")].filter((el) => {
        const s = getComputedStyle(el);
        // Durations come back in seconds; 0.01 ms (site.css) is no visible motion, anything from 1 ms up would be.
        const longest = (list: string) => Math.max(...list.split(",").map((d) => parseFloat(d) * (d.trim().endsWith("ms") ? 0.001 : 1)));
        return longest(s.transitionDuration) >= 0.001 || longest(s.animationDuration) >= 0.001;
      }).length,
    );
    expect(moving).toBe(0);
  });

  // @req REQ-READ-002.AC2
  test("lets nothing cover the text when the page loads", async ({ page }) => {
    await page.goto(CHAPTER_1);
    const covered = await page.evaluate(() => {
      const p = document.querySelector(".prose p")!;
      const r = p.getBoundingClientRect();
      const top = document.elementFromPoint(r.left + Math.min(40, r.width / 2), r.top + Math.min(10, r.height / 2));
      return !p.contains(top);
    });
    expect(covered).toBe(false);
    await expect(page.locator("dialog[open], [role=dialog]")).toHaveCount(0);
  });

  // @req REQ-READ-003.AC1
  test("puts a large '1' beside 'Computer Architecture', hidden from screen readers, which hear 'Chapter 1: Computer Architecture'", async ({ page }) => {
    await page.goto(CHAPTER_1);
    const number = page.locator(".chapter-title .chapter-number");
    await expect(number).toHaveText("1");
    await expect(number).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("heading", { level: 1 })).toHaveAccessibleName("Chapter 1: Computer Architecture");
    const [n, h] = [await number.boundingBox(), await page.locator(".chapter-title h1").boundingBox()];
    expect(n!.x + n!.width).toBeLessThanOrEqual(h!.x + 1); // beside, before the title
    expect(n!.height).toBeGreaterThan(h!.height / 2);
  });

  // @req REQ-READ-005.AC1
  test("shows the epigraph and '— Anonymous' above the first paragraph", async ({ page }) => {
    await page.goto(CHAPTER_2);
    const epigraph = page.locator("figure.epigraph");
    await expect(epigraph.locator("blockquote")).toHaveText("Everything is a trade-off.");
    await expect(epigraph.locator("figcaption")).toHaveText("— Anonymous");
    const [e, p] = [await epigraph.boundingBox(), await page.locator(".prose p").first().boundingBox()];
    expect(e!.y + e!.height).toBeLessThanOrEqual(p!.y);
  });

  // @req REQ-READ-005.AC2
  test("leaves no empty quote space when a chapter has no epigraph", async ({ page }) => {
    await page.goto(CHAPTER_1);
    await expect(page.locator(".epigraph")).toHaveCount(0);
  });

  // @req REQ-READ-008.AC3
  test("scrolls a formula wider than a 320 px screen inside its own box, not the page", async ({ page, viewport }) => {
    test.skip(viewport?.width !== 320, "320 px only");
    await page.goto(CHAPTER_2);
    const box = page.locator(".math-display").first();
    const { scroll, client } = await box.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(scroll).toBeGreaterThan(client);
    await expectNoHorizontalScroll(page);
  });

  // @req REQ-READ-004.AC3
  test("reveals a link to a section when the reader hovers over or focuses its heading", async ({ page }) => {
    await page.goto(CHAPTER_1);
    const heading = page.locator(".prose .heading").first();
    const anchor = heading.locator(".heading-anchor");
    await expect(anchor).toHaveAttribute("href", "#components");
    await expect(anchor).toHaveCSS("opacity", "0");
    await heading.hover();
    await expect(anchor).toHaveCSS("opacity", "1");
    await page.mouse.move(0, 0);
    await anchor.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(anchor).toHaveCSS("opacity", "1");
  });

  // @req REQ-READ-008.AC5
  test("loads KaTeX's styles and fonts from the site itself, asking no other host", async ({ page }) => {
    await page.goto(CHAPTER_1);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some((f) => f.family === "KaTeX_Main" && f.status === "loaded"))).toBe(true);
    await expectOnlySameOriginRequests(page);
    await expectNoCspViolations(page);
  });

  test("passes the accessibility check on a chapter with an epigraph, a formula and a note", async ({ page }) => {
    await page.goto(CHAPTER_2);
    await expectNoA11yViolations(page);
    await expectNoHorizontalScroll(page);
  });
});
