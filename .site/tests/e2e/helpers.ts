/**
 * Shared checks for every screen test (TOOL-09, NFR-003 accessibility, NFR-008 privacy, NFR-011 no sideways
 * scroll). Each one fails with a message that names what's wrong: the axe rule, the page width, the foreign URL.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";

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
 * Fails if the page loaded anything from another origin (NFR-008: no third parties, no tracking), naming each URL.
 * Reads the browser's own record of every resource the page fetched, so it needs no setup before the page loads.
 */
export async function expectOnlySameOriginRequests(page: Page): Promise<void> {
  const origin = new URL(page.url()).origin;
  const urls = await page.evaluate(() => performance.getEntriesByType("resource").map((e) => e.name));
  const foreign = urls.filter((u) => !/^(data|blob):/.test(u) && new URL(u).origin !== origin);
  expect(foreign, `Requests to other hosts:\n${foreign.join("\n")}`).toEqual([]);
}

/** Fails if the site set any cookie (NFR-008), naming them. */
export async function expectNoCookies(context: BrowserContext): Promise<void> {
  const names = (await context.cookies()).map((c) => `${c.name} (${c.domain})`);
  expect(names, `Cookies set: ${names.join(", ")}`).toEqual([]);
}
