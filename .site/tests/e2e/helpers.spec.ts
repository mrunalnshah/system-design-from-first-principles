import { expect, type Page } from "@playwright/test";
import { expectNoA11yViolations, expectNoCookies, expectNoHorizontalScroll, expectOnlySameOriginRequests, test } from "./helpers.ts";

/**
 * The harness's own checks (TOOL-09), on pages served from a made-up origin by request routing,
 * so nothing leaves the machine. Runs once, in the "harness" project (320 px).
 */
const ORIGIN = "http://harness.test";

/** Serves `html` at ORIGIN/ and a blank reply for every other URL. Never touches the network. */
async function serve(page: Page, html: string) {
  await page.route("**/*", (route) => {
    const u = route.request().url();
    if (u === `${ORIGIN}/`) return route.fulfill({ contentType: "text/html", body: html });
    return route.fulfill({ contentType: "image/png", body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64") });
  });
  await page.goto(`${ORIGIN}/`);
  await page.waitForLoadState("load");
}

const page = (body: string) => `<!doctype html><html lang="en"><head><title>Harness</title><meta name="viewport" content="width=device-width"></head><body><main><h1>Harness</h1>${body}</main></body></html>`;

test.describe("screen test harness", () => {
  // @req TOOL-09.AC1
  test("the axe check fails on an image without alt text, naming the rule", async ({ page: p }) => {
    await serve(p, page('<img src="/a.png" width="10" height="10">'));
    await expect(expectNoA11yViolations(p)).rejects.toThrow(/image-alt/);
  });

  // @req TOOL-09.AC2
  test("the sideways-scroll check fails at 320 px on a page that's wider", async ({ page: p }) => {
    await serve(p, page('<div style="width: 400px">Too wide</div>'));
    await expect(expectNoHorizontalScroll(p)).rejects.toThrow(/4\d\d px wide on a 320 px screen/);
  });

  // @req TOOL-09.AC3
  test("the same-origin check fails on a page that loads a third-party URL, naming it", async ({ page: p }) => {
    await serve(p, page('<img src="https://tracker.example/pixel.png" alt="">'));
    await expect(expectOnlySameOriginRequests(p)).rejects.toThrow(/https:\/\/tracker\.example\/pixel\.png/);
  });

  test("the same-origin check also catches a lazy image below the fold and a blocked request", async ({ page: p }) => {
    await serve(p, page('<div style="height: 5000px"></div><img src="https://cdn.example/late.png" alt="" loading="lazy">'));
    await expect(expectOnlySameOriginRequests(p)).rejects.toThrow(/https:\/\/cdn\.example\/late\.png/);
    await p.route("https://fonts.example/**", (r) => r.abort());
    await p.evaluate(() => fetch("https://fonts.example/f.woff2").catch(() => undefined));
    await expect(expectOnlySameOriginRequests(p)).rejects.toThrow(/https:\/\/fonts\.example\/f\.woff2/);
  });

  test("every check passes on a clean page, and the cookie check fails once a cookie is set", async ({ page: p, context }) => {
    await serve(p, page('<p>Plain.</p><img src="/a.png" alt="A dot" width="10" height="10">'));
    await expectNoA11yViolations(p);
    await expectNoHorizontalScroll(p);
    await expectOnlySameOriginRequests(p);
    await expectNoCookies(context);
    await context.addCookies([{ name: "track", value: "1", url: `${ORIGIN}/` }]);
    await expect(expectNoCookies(context)).rejects.toThrow(/track/);
  });
});
