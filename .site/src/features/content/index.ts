/**
 * MOD-vault public interface (specs/modules.md#mod-vault, specs/contracts/interfaces.md).
 * Other modules, pages and tests import only from here (TOOL-06).
 *
 * `readVault` is the pure core the Astro loader (`vaultLoader`, T-01.14) will run: it reads the vault and
 * returns what it found plus every problem as a `BuildIssue`. The loader adds those to the build report.
 */
import { readBookSettings, type BookSettings } from "./book-settings.ts";
import { scanVault, type VaultScan } from "./scan.ts";

export type { BookSettings } from "./book-settings.ts";
export type { ScannedArticle, ScannedChapter, ScannedPage, ScannedPart } from "./scan.ts";

/** Everything published in the vault: drafts are never included. `book` is undefined when book.md is missing or wrong. */
export type Vault = VaultScan & { book?: BookSettings };

/** Reads the vault at `root` (the folder holding `book.md`). Never throws for content problems. */
export function readVault(root: string): Vault {
  const book = readBookSettings(root);
  const scan = scanVault(root);
  const vault: Vault = { ...scan, issues: [...book.issues, ...scan.issues] };
  if (book.settings) vault.book = book.settings;
  return vault;
}
