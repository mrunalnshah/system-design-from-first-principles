import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, type Page } from "@playwright/test";
import { expectNoCookies, expectNoCspViolations, expectOnlySameOriginRequests, test } from "./helpers.ts";

/**
 * T-04.01 security review (specs/security.md, NFR-008), on every page the fixture site builds: each page found in
 * dist-e2e, so a page added later is checked automatically (the list in the first test only guards that the walk
 * finds them; add the new page there). For each page it lists every request and
 * cookie (attached to the test report), and checks that every request stays on the site's own origin, that nothing
 * is kept in the browser's storage, and that the page carries the CSP meta tag with no inline script to weaken it.
 */
const DIST = join(import.meta.dirname, "../../dist-e2e");
const CSP =
  "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; base-uri 'self'; form-action 'none'";

/** Every HTML page in the fixture build, as an address under the base path ("" is the homepage). */
function pages(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith(".html") ? [join(dir, e.name)] : [],
    );
  return walk(DIST)
    .map((f) =>
      relative(DIST, f)
        .replace(/\\/g, "/")
        .replace(/(^|\/)index\.html$/, "$1"),
    )
    .sort();
}

/** Nothing kept in the browser: no localStorage or sessionStorage keys and no cookie the page can see. */
async function expectNothingStored(page: Page, where: string): Promise<void> {
  const stored = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
    cookie: document.cookie,
  }));
  expect(stored, `${where} keeps nothing in the browser`).toEqual({ local: [], session: [], cookie: "" });
}

/** Opens `path` and makes the page load everything it would for a reader who reads to the end: lazy images too. */
async function readToTheEnd(page: Page, path: string): Promise<string[]> {
  const urls: string[] = [];
  const record = (r: { url(): string }) => void urls.push(r.url());
  page.on("request", record);
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForLoadState("networkidle");
  page.off("request", record);
  return urls;
}

test.describe("security review (T-04.01)", () => {
  const all = pages();

  test("finds every page of the fixture site", () => {
    // Home, contents, two chapters, the archive, an article, About, 404 and the two redirect pages.
    expect(all).toEqual([
      "",
      "404.html",
      "about/",
      "articles/",
      "articles/caches/",
      "articles/why-caches/",
      "book/",
      "book/computer-architecture/",
      "book/tcp/",
      "book/transmission-control/",
    ]);
  });

  // @req NFR-008
  test("asks only the site's own origin for anything, sets no cookie and stores nothing in the browser, on every page", async ({
    page,
    context,
  }) => {
    const listing: string[] = [];
    for (const path of all) {
      const urls = await readToTheEnd(page, path);
      const cookies = (await context.cookies()).map((c) => `${c.name}=${c.domain}`);
      listing.push(
        `${path || "/"}: ${urls.length} requests, ${cookies.length} cookies`,
        ...urls.map((u) => `  ${u}`),
        ...cookies.map((c) => `  cookie ${c}`),
      );
      await expectOnlySameOriginRequests(page);
      await expectNoCookies(context);
      await expectNothingStored(page, path || "/");
    }
    await test.info().attach("requests and cookies per page", { body: listing.join("\n"), contentType: "text/plain" });
  });

  test("carries the CSP meta tag before anything in <head> that loads, with no inline script or event handler, on every page", async ({
    page,
  }) => {
    test.skip(test.info().project.name !== "light-js-1280", "reads the built files; the same in every project");
    const base = new URL(test.info().project.use.baseURL!).pathname;
    for (const path of all) {
      const html = readFileSync(join(DIST, path.endsWith(".html") ? path : `${path}index.html`), "utf8");
      const found = await page.evaluate(
        ([source, base]) => {
          const doc = new DOMParser().parseFromString(source, "text/html");
          const metas = [...doc.querySelectorAll('meta[http-equiv="Content-Security-Policy"]')];
          const beforeMeta = [...doc.head.children]
            .slice(0, [...doc.head.children].indexOf(metas[0]!))
            .filter((el) => el.matches("script, link, style, base")); // the policy covers only what comes after it
          return {
            policies: metas.map((m) => m.getAttribute("content")),
            beforePolicy: beforeMeta.map((el) => el.outerHTML),
            inlineScripts: [...doc.querySelectorAll("script:not([src])")].map((s) => s.outerHTML.slice(0, 80)),
            foreignScripts: [...doc.querySelectorAll("script[src]")]
              .map((s) => s.getAttribute("src")!)
              .filter((src) => !src.startsWith(base)),
            handlers: [...doc.querySelectorAll("*")].flatMap((el) =>
              el
                .getAttributeNames()
                .filter((a) => a.startsWith("on"))
                .map((a) => `${el.tagName.toLowerCase()} ${a}`),
            ),
            scriptLinks: [...doc.querySelectorAll("[href^='javascript:' i], [src^='javascript:' i]")].map((el) =>
              el.outerHTML.slice(0, 80),
            ),
          };
        },
        [html, base] as const,
      );
      expect(found, path || "/").toEqual({
        policies: [CSP],
        beforePolicy: [],
        inlineScripts: [],
        foreignScripts: [],
        handlers: [],
        scriptLinks: [],
      });
    }
  });

  test("runs the workflow only for pushes and same-repository pull requests, never with a fork's code (security.md B2)", () => {
    test.skip(test.info().project.name !== "light-js-1280", "reads a file; once is enough");
    const workflow = readFileSync(join(import.meta.dirname, "../../../.github/workflows/publish.yml"), "utf8").replace(
      /\r\n/g,
      "\n",
    );
    expect(workflow).not.toMatch(/pull_request_target|workflow_run/);
    const sameRepo =
      "    if: github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository\n";
    const job = (name: string) => new RegExp(`^  ${name}:\\n((?:    .*\\n|\\n)*)`, "m").exec(workflow)?.[1] ?? "";
    for (const name of ["checks", "secrets", "e2e"])
      expect(job(name), `${name} skips fork pull requests`).toContain(sameRepo);
    expect(workflow).toMatch(/^  build:\n(?:    .*\n)*    needs: \[checks, secrets, e2e\]/m);
    const checkouts = [...workflow.matchAll(/uses: actions\/checkout@\S+.*\n(?:\s+with:\n(?:\s{10}.*\n)*)?/g)].map(
      (m) => m[0],
    );
    expect(checkouts.length).toBe([...workflow.matchAll(/uses: actions\/checkout@/g)].length);
    for (const c of checkouts)
      expect(c, "the checkout keeps no token for later steps").toContain("persist-credentials: false");
  });

  test("triggers no CSP violation while a reader uses every enhancement (menu, diagram viewer, margin notes)", async ({
    page,
    javaScriptEnabled,
    viewport,
  }) => {
    for (const path of all) await readToTheEnd(page, path);
    if (javaScriptEnabled) {
      await page.goto("book/computer-architecture/");
      if (viewport!.width < 1100) {
        await page.getByRole("button", { name: "Sections", exact: true }).click();
        await page.getByRole("button", { name: "Close sections" }).click();
      }
      await page.locator("figure[data-diagram]").first().getByRole("button").click();
      await page
        .getByRole("dialog", { name: /^Diagram/ })
        .getByRole("button", { name: "Zoom in" })
        .click();
      await page.keyboard.press("Escape");
      await page.goto("book/tcp/");
      const marker = page.getByRole("button", { name: "Note 1" });
      if (await marker.isVisible()) await marker.click(); // a tap-to-open marker only on narrow touch screens
      await page.waitForLoadState("networkidle");
      await expectOnlySameOriginRequests(page);
      await expectNothingStored(page, "after using the enhancements");
    }
    await expectNoCspViolations(page);
  });
});
