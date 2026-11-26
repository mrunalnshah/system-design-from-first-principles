import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { makeUrlBuilder } from "./url.ts";

const siteRoot = join(import.meta.dirname, "../../..");
const tempDirs: string[] = [];
afterAll(() => tempDirs.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("url()", () => {
  const { url, absoluteUrl } = makeUrlBuilder("/system-design/", "https://example.test");

  // @req REQ-SITE-013.AC1
  it("prefixes every route with the base path", () => {
    expect(url({ kind: "chapter", slug: "computer-architecture" })).toBe("/system-design/book/computer-architecture/");
    expect(url({ kind: "home" })).toBe("/system-design/");
    expect(url({ kind: "contents" })).toBe("/system-design/book/");
    expect(url({ kind: "articles" })).toBe("/system-design/articles/");
    expect(url({ kind: "article", slug: "why-caches" })).toBe("/system-design/articles/why-caches/");
    expect(url({ kind: "about" })).toBe("/system-design/about/");
    expect(url({ kind: "asset", path: "diagrams/1a2b3c4d-01-light.svg" })).toBe("/system-design/diagrams/1a2b3c4d-01-light.svg");
  });

  it("builds absolute addresses for canonical links", () => {
    expect(absoluteUrl({ kind: "chapter", slug: "computer-architecture" })).toBe("https://example.test/system-design/book/computer-architecture/");
  });

  it("accepts a base with or without its slashes, and the root base of a custom domain", () => {
    expect(makeUrlBuilder("system-design", "https://example.test").url({ kind: "contents" })).toBe("/system-design/book/");
    expect(makeUrlBuilder("/", "https://example.test/").url({ kind: "chapter", slug: "tcp" })).toBe("/book/tcp/");
    expect(makeUrlBuilder("/", "https://example.test/").absoluteUrl({ kind: "home" })).toBe("https://example.test/");
  });

  it("refuses slugs and asset paths that would make a broken or unsafe address", () => {
    expect(() => url({ kind: "chapter", slug: "Computer Architecture" })).toThrow(/slug/);
    expect(() => url({ kind: "article", slug: "../etc" })).toThrow(/slug/);
    expect(() => url({ kind: "asset", path: "/diagrams/x.svg" })).toThrow(/asset path/);
    expect(() => url({ kind: "asset", path: "../x.svg" })).toThrow(/asset path/);
  });
});

/** Every href/src/action in the built HTML that starts with `/`. */
function internalAddresses(dir: string): { file: string; address: string }[] {
  const found: { file: string; address: string }[] = [];
  const walk = (d: string) => {
    for (const name of readdirSync(d)) {
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".html"))
        for (const m of readFileSync(p, "utf8").matchAll(/\s(?:href|src|action|content)="((?:https:\/\/mrunalnshah\.github\.io)?\/[^"]*)"/g))
          found.push({ file: p.slice(dir.length), address: m[1]!.replace("https://mrunalnshah.github.io", "") });
    }
  };
  walk(dir);
  return found;
}

describe("the built site", () => {
  // @req REQ-SITE-013.AC1
  it("has no internal link or asset without the base path (built with base /system-design/)", () => {
    const outDir = mkdtempSync(join(tmpdir(), "sdfp-base-"));
    tempDirs.push(outDir);
    const script = `import("astro").then((a) => a.build({ root: process.argv[1], outDir: process.argv[2], base: "/system-design/", logLevel: "error" }))`;
    // Vitest puts Vite's own variables (BASE_URL="/", MODE, DEV, PROD, SSR) into process.env; a child
    // build that inherits them would ignore the base path under test, so they're removed.
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^(BASE_URL|MODE|DEV|PROD|SSR|VITEST.*|TEST)$/.test(k)));
    // The fixture vault, so the check doesn't depend on the author's content being free of errors.
    env.SDFP_VAULT = join(siteRoot, "tests/fixtures/vault");
    execFileSync(process.execPath, ["--input-type=module", "-e", script, siteRoot, outDir], { stdio: "pipe", env });
    const addresses = internalAddresses(outDir);
    expect(addresses.length).toBeGreaterThan(0);
    // The author's portfolio (author_url in book.md) shares the host but is another site, so it isn't ours to prefix.
    const portfolio = /^author_url:\s*"?https:\/\/mrunalnshah\.github\.io(\/[^"\s]*)"?/m.exec(readFileSync(join(siteRoot, "tests/fixtures/vault/book.md"), "utf8"))![1];
    expect(addresses.filter((a) => !a.address.startsWith("/system-design/") && a.address !== portfolio)).toEqual([]);
  }, 120_000);
});
