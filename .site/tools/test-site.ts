/**
 * A built site made up for a tool test: files written into a fresh temporary folder, removed by `cleanUp`.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const made: string[] = [];

/** A temporary folder holding `files` (path inside it → contents). */
export function fakeSite(files: Record<string, string | Buffer>, prefix = "sdfp-site-"): string {
  const dist = mkdtempSync(join(tmpdir(), prefix));
  made.push(dist);
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(dist, path)), { recursive: true });
    writeFileSync(join(dist, path), text);
  }
  return dist;
}

/** An empty temporary folder, removed with the others. */
export function tempFolder(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  made.push(dir);
  return dir;
}

/** Removes every folder made here (call it in `afterAll`). */
export function cleanUp(): void {
  made.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
}
