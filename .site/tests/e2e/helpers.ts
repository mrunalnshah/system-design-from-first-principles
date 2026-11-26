/**
 * Shared checks for every screen test (TOOL-09, NFR-003 accessibility, NFR-008 privacy, NFR-011 no sideways
 * scroll). Each one fails with a message that names what's wrong: the axe rule, the page width, the foreign URL.
 * Screen specs import `test` from here, so every page records its requests from the start.
 */
import AxeBuilder from "@axe-core/playwright";
import { test as base, expect, type BrowserContext, type Page } from "@playwright/test";

/** Every URL each page asked for, from before it navigated, including requests that failed or were blocked. */
const requested = new WeakMap<Page, string[]>();

/** Playwright's `test`, with a page that records its requests. */
export const test = base.extend({
  page: async ({ page }, use) => {
    const urls: string[] = [];
    requested.set(page, urls);
    page.on("request", (r) => void urls.push(r.url()));
    await use(page);
  },
});

/** WCAG 2.2 A and AA, the level the site promises (NFR-003). */
const WCAG = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

/** Fails if axe finds any WCAG A/AA violation on the page, naming each rule and how many elements break it. */
export async function expectNoA11yViolations(page: Page): Promise<void> {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze();
  const report = violations.map((v) => `${v.id}: ${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")})`);
  expect(report, `Accessibility violations:\n${report.join("\n")}`).toEqual([]);
}

/** Fails if the page is wider than the screen, so it would scroll sideways (NFR-011). */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const { content, screen } = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, screen: document.documentElement.clientWidth }));
  expect(content, `The page is ${content} px wide on a ${screen} px screen, so it scrolls sideways`).toBeLessThanOrEqual(screen);
}

/**
 * Fails if the page uses anything from another origin (NFR-008: no third parties, no tracking), naming each URL.
 * Looks at every request the page made (failed and blocked ones too, for a page from this file's `test`), the
 * browser's own resource record, and resource addresses in the page that haven't loaded yet (lazy images below
 * the fold). Ordinary links to other sites are fine: only what the page would load counts.
 */
export async function expectOnlySameOriginRequests(page: Page): Promise<void> {
  const origin = new URL(page.url()).origin;
  const inPage = await page.evaluate(() => {
    const loaded = performance.getEntriesByType("resource").map((e) => e.name);
    const selector = "img[src], source[src], script[src], iframe[src], video[src], audio[src], embed[src], object[data], link[href]:not([rel~='alternate']):not([rel~='canonical'])";
    const wanted = [...document.querySelectorAll(selector)].map((el) => (el as HTMLImageElement).src || (el as HTMLLinkElement).href || (el as HTMLObjectElement).data);
    const sets = [...document.querySelectorAll("[srcset]")].flatMap((el) =>
      (el.getAttribute("srcset") ?? "").split(",").map((c) => new URL(c.trim().split(/\s+/)[0] ?? "", document.baseURI).href),
    );
    return [...loaded, ...wanted, ...sets];
  });
  const urls = [...(requested.get(page) ?? []), ...inPage];
  const foreign = [...new Set(urls.filter((u) => /^https?:/.test(u) && new URL(u).origin !== origin))];
  expect(foreign, `Requests to other hosts:\n${foreign.join("\n")}`).toEqual([]);
}

/** Fails if the site set any cookie (NFR-008), naming them. */
export async function expectNoCookies(context: BrowserContext): Promise<void> {
  const names = (await context.cookies()).map((c) => `${c.name} (${c.domain})`);
  expect(names, `Cookies set: ${names.join(", ")}`).toEqual([]);
}
