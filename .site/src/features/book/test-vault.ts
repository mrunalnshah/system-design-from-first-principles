/**
 * Test helpers for MOD-book: the published book of the fixture vault, or of a copy changed for one test, built the
 * way pages get it (MOD-vault's `buildVault` + `bookOf`), with figures drawn as placeholders.
 */
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bookOf, buildVault, type Book } from "../content/index.ts";

export const fixture = join(import.meta.dirname, "../../../tests/fixtures/vault");
const made: string[] = [];

/** The published book of the vault at `vaultRoot`; throws if the vault has errors. */
export async function bookFrom(vaultRoot: string): Promise<Book> {
  const vault = await buildVault({ vaultRoot, figures: async () => () => ({ html: "<figure></figure>", issues: [] }) });
  const errors = vault.issues.filter((i) => i.severity === "error");
  if (errors.length || !vault.book) throw new Error(`The test vault has errors: ${JSON.stringify(errors)}`);
  return bookOf(vault.book, vault.chapters);
}

/** A copy of the fixture vault in a temporary folder, changed by `edit(root)`; removed by `cleanUp`. */
export function vaultCopy(edit: (root: string) => void): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-book-"));
  made.push(root);
  cpSync(fixture, root, { recursive: true });
  edit(root);
  return root;
}

/** Sets or clears `draft:` in an entry's frontmatter. */
export function setDraft(file: string, draft: boolean): void {
  const text = readFileSync(file, "utf8").replace(/^draft: (true|false)\r?\n/m, "");
  writeFileSync(
    file,
    text.startsWith("---") ? text.replace(/^---\r?\n/, `---\ndraft: ${draft}\n`) : `---\ndraft: ${draft}\n---\n${text}`,
  );
}

/** Removes every copy made here (call it in `afterAll`). */
export function cleanUp(): void {
  made.splice(0).forEach((d) => rmSync(d, { recursive: true, force: true }));
}
