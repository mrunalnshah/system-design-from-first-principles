/**
 * `readVault`: the vault as data, before rendering. It reads book.md and scans the parts, chapters, articles and
 * the About page, returning what it found plus every problem as a `BuildIssue` (never an exception).
 */
import { readBookSettings, type BookSettings } from "./book-settings.ts";
import { scanVault, type VaultScan } from "./scan.ts";

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
