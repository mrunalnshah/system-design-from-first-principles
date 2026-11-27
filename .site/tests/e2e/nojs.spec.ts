import { expect } from "@playwright/test";
import { expectNoHorizontalScroll, test } from "./helpers.ts";

/**
 * T-04.04: reading with JavaScript turned off (NFR-004, ADR-0006). Runs in the JavaScript-off projects only (light and
 * dark, 320, 768 and 1280 px): every screen's text, the diagrams in the reader's theme, the math, the contents and
 * previous/next all work, and the enhancements fall back as design/screens/chapter.md says (sections as a plain
 * list, notes as an end list, diagrams as links to their SVG).
 */
const BASE = "/system-design-from-first-principles/";

test.describe("without JavaScript", () => {
  test.beforeEach(({ javaScriptEnabled }) => {
    test.skip(javaScriptEnabled, "JavaScript off only");
  });

  // @req NFR-004
  test("reads every screen: the text is all there", async ({ page }) => {
    const screens: [string, RegExp][] = [
      ["", /A book that starts from the computer itself\./],
      ["book/", /Computer Architecture/],
      ["book/computer-architecture/", /Before we can learn how to design large-scale distributed system/],
      ["book/tcp/", /Packets get lost\. TCP hides that\./],
      ["articles/", /Why Caches/],
      ["articles/why-caches/", /A disk read feels slow because it is\./],
      ["about/", /I write about systems\./],
      ["book/does-not-exist/", /Page not found/],
    ];
    for (const [path, text] of screens) {
      await page.goto(path);
      await expect(page.locator("main"), path || "/").toContainText(text);
      await expectNoHorizontalScroll(page);
    }
  });

  // @req NFR-004
  test("shows the diagrams in the reader's theme, each a link to its SVG, and the math typeset", async ({
    page,
    colorScheme,
  }) => {
    const theme = colorScheme === "dark" ? "dark" : "light";
    await page.goto("book/computer-architecture/");
    const figures = page.locator("figure.diagram");
    expect(await figures.count()).toBeGreaterThan(0);
    for (const figure of await figures.all()) {
      await figure.scrollIntoViewIfNeeded();
      const img = figure.locator("img");
      await expect
        .poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc))
        .toMatch(new RegExp(`-${theme}\\.svg$`));
      await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.complete && i.naturalWidth > 0)).toBe(true);
      await expect(figure.locator("a.diagram-link")).toHaveAttribute("href", /\.svg$/);
    }
    // KaTeX's HTML is made at build time, so formulas are typeset with no script; the MathML copy is for screen readers.
    const math = page.locator(".katex").first();
    await expect(math.locator(".katex-html")).toBeVisible();
    await expect(math.locator(".katex-mathml math")).toHaveCount(1);
    // The enhancements didn't run: no full-screen button was added to the figures, and no dialog is open.
    await expect(page.locator("figure[data-diagram] button")).toHaveCount(0);
    await expect(page.locator("dialog[open]")).toHaveCount(0);
  });

  // @req NFR-004
  test("moves through the book: contents → a section → previous/next, with sections as a plain list and notes at the end", async ({
    page,
  }) => {
    await page.goto("book/");
    await page.locator(".contents-sections").first().getByRole("link", { name: "Limitations" }).click();
    await expect(page).toHaveURL(`${BASE}book/computer-architecture/#limitations`);
    await expect(page.locator(".chapter-toc")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sections", exact: true })).toBeHidden();
    const nav = page.getByRole("navigation", { name: "Chapter navigation" });
    await nav.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(`${BASE}book/tcp/`);
    // Margin notes become a numbered list at the end, each linked both ways.
    await expect(page.locator(".endnotes")).toBeVisible();
    await page.getByRole("link", { name: "Note 1", exact: true }).click(); // not "Back to the text of note 1"
    await expect(page).toHaveURL(/#fn-1$/);
    await expect(page.locator(".endnotes a[href='#ref-1']")).toHaveCount(1);
    await nav.getByRole("link", { name: /Previous/ }).click();
    await expect(page).toHaveURL(`${BASE}book/computer-architecture/`);
  });
});
