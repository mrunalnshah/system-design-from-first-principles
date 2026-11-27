import { expect, type Page } from "@playwright/test";
import { expectNoHorizontalScroll, test } from "./helpers.ts";

/**
 * T-04.04: the reader's journeys end to end (specs/product.md#journeys, design/flows.md) on the fixture site, in every
 * project (light and dark, JavaScript on and off, 320, 768 and 1280 px), each step by what a reader clicks; then the
 * responsive checks (NFR-010, NFR-011) on every screen from 320 to 1920 px.
 * J5 (publishing) has no screen: it's the build's messages (tests/messages.test.ts) and the workflow.
 */
const BASE = "/system-design-from-first-principles/";
const CHAPTER_1 = `${BASE}book/computer-architecture/`;
const CHAPTER_2 = `${BASE}book/tcp/`;

/** Jumps to "1.2 Limitations" through the chapter menu this reader has: the panel, the Sections sheet, or the plain list. */
async function jumpToLimitations(page: Page, javaScriptEnabled: boolean, width: number): Promise<void> {
  const name = /1\.2\s+Limitations/;
  if (!javaScriptEnabled) await page.locator(".chapter-toc").getByRole("link", { name }).click();
  else if (width >= 1100)
    await page.getByRole("navigation", { name: "Chapter", exact: true }).getByRole("link", { name }).click();
  else {
    await page.getByRole("button", { name: "Sections", exact: true }).click();
    await page
      .getByRole("dialog", { name: /1 · Computer Architecture/ })
      .getByRole("link", { name })
      .click();
  }
  await expect(page).toHaveURL(/#limitations$/);
  await expect
    .poll(() => page.locator("#limitations").evaluate((h) => h.getBoundingClientRect().top))
    .toBeLessThan(250);
}

/** The header's link to `name`: in the row on wide screens, in the menu on narrow ones (opened first). */
async function headerLink(page: Page, name: string, width: number) {
  if (width >= 768) return page.locator(".nav-inline").getByRole("link", { name, exact: true });
  await page.locator(".nav-menu summary").click();
  return page.locator(".nav-menu nav").getByRole("link", { name, exact: true });
}

test.describe("journeys", () => {
  test("J1 start the book: Home → Read from the start → Chapter 1 → read to the end → Next chapter", async ({
    page,
  }) => {
    await page.goto("");
    await page.getByRole("link", { name: "Read from the start" }).click();
    await expect(page).toHaveURL(CHAPTER_1);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Computer Architecture");
    const next = page.getByRole("navigation", { name: "Chapter navigation" }).getByRole("link", { name: /Next/ });
    await next.scrollIntoViewIfNeeded();
    await expect(next).toBeInViewport();
    await next.click();
    await expect(page).toHaveURL(CHAPTER_2);
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Tcp");
  });

  test("J2 featured chapter: Home → a chapter card → jump to a section with the chapter menu → the contents page", async ({
    page,
    javaScriptEnabled,
    viewport,
  }) => {
    await page.goto("");
    const cards = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Start here" }) });
    await cards.getByRole("link", { name: "Chapter 1: Computer Architecture" }).click();
    await expect(page).toHaveURL(CHAPTER_1);
    await jumpToLimitations(page, javaScriptEnabled, viewport!.width);
    await (await headerLink(page, "Contents", viewport!.width)).click();
    await expect(page).toHaveURL(`${BASE}book/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Contents");
  });

  test("J3 read an article: Home → Latest articles → the article; and Home → All articles → the archive → the article", async ({
    page,
  }) => {
    await page.goto("");
    const latest = page.locator("section", { has: page.getByRole("heading", { level: 2, name: "Latest articles" }) });
    await latest.getByRole("link", { name: "Why Caches" }).click();
    await expect(page).toHaveURL(`${BASE}articles/why-caches/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Why Caches");
    await expect(page.locator(".prose")).toContainText("A disk read feels slow because it is.");

    await page.goto("");
    await latest.getByRole("link", { name: "All articles →" }).click();
    await expect(page).toHaveURL(`${BASE}articles/`);
    await expect(page.getByRole("heading", { level: 2, name: "2026" })).toBeVisible();
    await page.getByRole("link", { name: "Why Caches" }).click();
    await expect(page).toHaveURL(`${BASE}articles/why-caches/`);
  });

  test("J4 move through the book: Next and Previous between chapters, then the contents page → any chapter", async ({
    page,
  }) => {
    await page.goto(CHAPTER_1);
    const nav = page.getByRole("navigation", { name: "Chapter navigation" });
    await nav.getByRole("link", { name: /Next/ }).click();
    await expect(page).toHaveURL(CHAPTER_2);
    await nav.getByRole("link", { name: /Previous/ }).click();
    await expect(page).toHaveURL(CHAPTER_1);
    // The first chapter's back link and the last chapter's forward link both lead to the contents.
    await nav.getByRole("link", { name: /Contents/ }).click();
    await expect(page).toHaveURL(`${BASE}book/`);
    await page.getByRole("link", { name: "Chapter 2: Tcp" }).click();
    await expect(page).toHaveURL(CHAPTER_2);
    await nav.getByRole("link", { name: /contents/i }).click(); // the last chapter's forward link
    await expect(page).toHaveURL(`${BASE}book/`);
  });

  test("J6 get to know the author: the header's name → About → the portfolio link", async ({ page }) => {
    await page.goto(CHAPTER_1);
    await page.locator("header .byline").getByRole("link", { name: "Mrunal Nirajkumar Shah" }).click();
    await expect(page).toHaveURL(`${BASE}about/`);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Mrunal Nirajkumar Shah");
    // The portfolio is another site: its link is checked, not followed (tests never use the network).
    const portfolio = page
      .getByRole("navigation", { name: "After the page" })
      .getByRole("link", { name: /^Portfolio:/ });
    await expect(portfolio).toHaveAttribute("href", "https://mrunalnshah.github.io/");
    await expect(portfolio).toBeVisible();
  });
});

/** Every screen and its states that the fixture site has (design/screens/*.md). */
const SCREENS = [
  "",
  "book/",
  "book/computer-architecture/",
  "book/tcp/",
  "articles/",
  "articles/why-caches/",
  "about/",
  "book/does-not-exist/",
];
const WIDTHS = [320, 375, 414, 768, 1024, 1100, 1280, 1440, 1920];

test.describe("responsive", () => {
  // One test per width, each over every screen (once per theme and JavaScript setting: the 320 px projects).
  for (const width of WIDTHS) {
    // @req NFR-011
    test(`never scrolls sideways on any screen at ${width} px`, async ({ page, viewport, colorScheme }) => {
      test.skip(viewport!.width !== 320, "sets its own width; once per theme and JavaScript setting");
      await page.setViewportSize({ width, height: 900 });
      for (const path of SCREENS) {
        await page.goto(path);
        await expectNoHorizontalScroll(page).catch((e: Error) => {
          throw new Error(`${path || "/"} at ${width} px: ${e.message}`);
        });
      }
      // The chapter at this width, for the record (not compared: baselines differ by platform, CR-0012).
      await test
        .info()
        .attach(`chapter-${colorScheme}-${width}.png`, {
          body: await page.goto("book/computer-architecture/").then(() => page.screenshot()),
          contentType: "image/png",
        });
    });
  }

  // @req NFR-010
  test("keeps diagrams vector, as wide as the reading column up to 900 px, and inside the screen at 320 px", async ({
    page,
    viewport,
    colorScheme,
  }) => {
    const svg = new RegExp(`-${colorScheme === "dark" ? "dark" : "light"}\\.svg$`);
    /** Every diagram image on the page: the theme's SVG, inside a `width` px screen, at most 900 px, filling its column. */
    const checkFigures = async (path: string, width: number) => {
      const images = page.locator("figure.diagram img");
      expect(await images.count(), `${path || "/"} has diagrams to check`).toBeGreaterThan(0);
      for (const img of await images.all()) {
        await img.scrollIntoViewIfNeeded();
        // Vector: the image is the SVG itself, in the theme's variant, so it stays crisp at any zoom.
        await expect.poll(() => img.evaluate((i: HTMLImageElement) => i.currentSrc)).toMatch(svg);
        const box = (await img.boundingBox())!;
        expect(box.x, `${path} diagram starts on the screen at ${width} px`).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width, `${path} diagram ends on the screen at ${width} px`).toBeLessThanOrEqual(width);
        expect(box.width, `${path} diagram is at most 900 px`).toBeLessThanOrEqual(900);
        // Fills the reading column: never narrower than the text it sits in (the hero's column on the homepage).
        const column = await img.evaluate(
          (i) => (i.closest(".prose, .hero-art") as HTMLElement).getBoundingClientRect().width,
        );
        expect(box.width + 1, `${path} diagram fills its column at ${width} px`).toBeGreaterThanOrEqual(
          Math.min(column, 900),
        );
      }
    };
    for (const path of ["", "book/computer-architecture/"]) {
      await page.goto(path);
      await checkFigures(path, viewport!.width);
      // 200% zoom on a 1280 px screen lays the page out at 640 CSS px: every diagram still fits and is still the SVG.
      if (viewport!.width === 1280) {
        await page.setViewportSize({ width: 640, height: 800 });
        await checkFigures(path, 640);
        await expectNoHorizontalScroll(page);
        await page.setViewportSize(viewport!);
      }
      await test.info().attach(`${path || "home"}-${colorScheme}-${viewport!.width}.png`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: "image/png",
      });
    }
  });
});
