import { expect, type Page } from "@playwright/test";
import { expectNoA11yViolations, test } from "./helpers.ts";

/**
 * T-04.04: accessibility on every screen and state (NFR-003, WCAG 2.2 AA; design/screens/*.md), in every project
 * (light and dark, JavaScript on and off, 320, 768 and 1280 px). Axe checks each screen as it loads, then each state a
 * reader can open: the header menu, the Sections sheet, the full-screen diagram, a margin note. Then every screen's
 * first Tab stops each show a 2 px focus ring. Working the enhancements by keyboard is in chapter-menu.spec.ts,
 * diagram-viewer.spec.ts and keyboard.spec.ts; the token colour pairs are checked by `tools contrast`.
 */
const SCREENS: [string, string][] = [
  ["home", ""],
  ["contents", "book/"],
  ["chapter (first, with diagrams and math)", "book/computer-architecture/"],
  ["chapter (last, with an epigraph and notes)", "book/tcp/"],
  ["all articles", "articles/"],
  ["article", "articles/why-caches/"],
  ["about", "about/"],
  ["not found", "book/does-not-exist/"],
  // The redirect page isn't here: it refreshes to its new address at once, so a reader sees it only in a browser that
  // doesn't follow the refresh (redirects.spec.ts checks its HTML: heading, link and noindex).
];

/** Axe on the page as it is now, naming the screen and state in any failure. */
async function axe(page: Page, where: string): Promise<void> {
  await expectNoA11yViolations(page).catch((e: Error) => {
    throw new Error(`${where}: ${e.message}`);
  });
}

test.describe("accessibility", () => {
  // One test per screen, so each stays well inside the time limit (axe with JavaScript off opens its own context).
  for (const [name, path] of SCREENS) {
    // @req NFR-003
    test(`has no WCAG 2.2 AA violation: ${name}`, async ({ page }) => {
      await page.goto(path);
      await axe(page, name);
    });
  }

  // @req NFR-003
  test("has none in the states a reader opens: header menu, Sections sheet, diagram viewer", async ({
    page,
    javaScriptEnabled,
    viewport,
  }) => {
    // Axe can't check an opened state with JavaScript off: the helper reloads the address in a copy of the context,
    // which closes it again. The header menu is a <details> and opens the same either way, so it's checked here.
    test.skip(!javaScriptEnabled, "opened states are checked with JavaScript on");
    const width = viewport!.width;
    await page.goto("book/computer-architecture/");
    if (width < 768) {
      await page.locator(".nav-menu summary").click();
      await expect(page.locator(".nav-menu nav")).toBeVisible();
      await axe(page, "header menu open");
      await page.locator(".nav-menu summary").click();
    }
    if (width < 1100) {
      await page.getByRole("button", { name: "Sections", exact: true }).click();
      await expect(page.getByRole("dialog", { name: /1 · Computer Architecture/ })).toBeVisible();
      await axe(page, "Sections sheet open");
      await page.getByRole("button", { name: "Close sections" }).click();
    }
    await page.locator("figure[data-diagram]").first().getByRole("button").click();
    await expect(page.getByRole("dialog", { name: /^Diagram/ })).toBeVisible();
    await axe(page, "diagram viewer open");
  });

  // @req NFR-003
  test("has none with a margin note open by a tap on a phone", async ({
    browser,
    javaScriptEnabled,
    viewport,
    colorScheme,
    baseURL,
  }) => {
    test.skip(!javaScriptEnabled || viewport!.width !== 320, "a touch phone of its own; once per theme");
    // Margin notes open by a tap on a touch phone (REQ-READ-006), so this makes one.
    const context = await browser.newContext({
      viewport: { width: 375, height: 700 },
      hasTouch: true,
      isMobile: true,
      colorScheme: colorScheme ?? "light",
    });
    try {
      const phone = await context.newPage();
      await phone.goto(new URL("book/tcp/", baseURL).href);
      await phone.getByRole("button", { name: "Note 1", exact: true }).tap();
      await expect(phone.locator("#sn-1")).toBeVisible();
      await axe(phone, "margin note open");
    } finally {
      await context.close();
    }
  });

  for (const [name, path] of SCREENS) {
    // @req NFR-003
    test(`shows a 2 px focus ring on every early Tab stop: ${name}`, async ({ page }) => {
      await page.goto(path);
      // The first stops: skip link, header, then the page's own links and buttons.
      const seen = new Set<string>();
      for (let i = 0; i < 12; i++) {
        await page.keyboard.press("Tab");
        const focus = await page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return undefined;
          const ringed = (e: Element) =>
            getComputedStyle(e).outlineStyle !== "none" && parseFloat(getComputedStyle(e).outlineWidth) >= 2;
          // The ring is on the element, or on the card or row that rings itself while its link has focus
          // (ChapterCard, ArticleRow: `:has(a:focus-visible)`), never on a wrapper that always has an outline.
          const around = [el.parentElement, el.parentElement?.parentElement].filter(
            (e): e is HTMLElement => !!e && e.matches(":has(:focus-visible)"),
          );
          const box = el.getBoundingClientRect();
          return {
            id: `${el.tagName.toLowerCase()} ${el.textContent?.trim().slice(0, 40)}`,
            outline: ringed(el) || around.some(ringed),
            sized: box.width > 0 && box.height > 0,
          };
        });
        if (!focus) break;
        expect(focus.outline, `${name}: focus on "${focus.id}" has a visible ring`).toBe(true);
        expect(focus.sized, `${name}: focus on "${focus.id}" is on something on screen`).toBe(true);
        seen.add(focus.id);
      }
      expect(seen.size, `${name}: Tab reaches the page's links`).toBeGreaterThan(2);
    });
  }
});
