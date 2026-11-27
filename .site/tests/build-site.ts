/**
 * Builds the site from the fixture vault into a folder of its own, for unit tests that check the built output
 * (url.test.ts, tools/size.test.ts). Astro keeps its prerender files in `.site/.astro/.prerender/` whatever the
 * output or cache folder, so two builds of this project at once break each other: Vitest runs test files in
 * parallel, so builds here take turns through a lock folder that only one process can create at a time.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const siteRoot = join(import.meta.dirname, "..");
const LOCK = join(tmpdir(), "sdfp-fixture-build.lock");
/** A lock older than this was left by a build that died; it's taken over. */
const STALE_MS = 5 * 60_000;

/**
 * Builds the fixture vault's site into `outDir` (with `base` if given, else the configured one). `vault` builds
 * another vault instead (a copy of the fixture with more or less content, as in the archive's 200-article check).
 * Returns what the build printed (the build report's warnings, for one).
 */
export function buildFixtureSite(outDir: string, base?: string, vault?: string): string {
  const script = `import("astro").then((a) => a.build({ root: process.argv[1], outDir: process.argv[2], ${base ? "base: process.argv[3], " : ""}logLevel: "error" }))`;
  // Leave out what the test process set for itself: Vite's own variables (BASE_URL="/", MODE, DEV, PROD, SSR),
  // NODE_ENV=test, and what loading the Astro config set (SITE, ASSETS_PREFIX, and SDFP_VAULT_ROOT, the real vault,
  // which would send the diagrams to another vault than the text). A child build that inherits them goes wrong.
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([k]) => !/^(BASE_URL|MODE|DEV|PROD|SSR|NODE_ENV|SITE|ASSETS_PREFIX|SDFP_VAULT_ROOT|VITEST.*|TEST)$/.test(k),
    ),
  );
  // The fixture vault, so these checks don't depend on the author's content being free of errors.
  env.SDFP_VAULT = vault ?? join(siteRoot, "tests/fixtures/vault");
  return withLock(() =>
    execFileSync(process.execPath, ["--input-type=module", "-e", script, siteRoot, outDir, ...(base ? [base] : [])], {
      // Astro is found from the site's folder, whatever folder the tests were started from.
      cwd: siteRoot,
      stdio: "pipe",
      env,
      encoding: "utf8",
    }),
  );
}

function withLock<T>(run: () => T): T {
  const wait = new Int32Array(new SharedArrayBuffer(4));
  for (;;) {
    try {
      mkdirSync(LOCK);
      break;
    } catch {
      try {
        if (Date.now() - statSync(LOCK).mtimeMs > STALE_MS) rmSync(LOCK, { recursive: true, force: true });
      } catch {
        // Released between the two calls: try again.
      }
      Atomics.wait(wait, 0, 0, 200);
    }
  }
  try {
    return run();
  } finally {
    rmSync(LOCK, { recursive: true, force: true });
  }
}
