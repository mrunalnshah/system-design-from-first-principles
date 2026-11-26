/**
 * MOD-vault public interface (specs/modules.md#mod-vault, specs/contracts/interfaces.md).
 * Other modules, pages and tests import only from here (TOOL-06).
 *
 * `readVault` is the pure core the Astro loader (`vaultLoader`, T-01.14) will run: it reads the vault and
 * returns what it found plus every problem as a `BuildIssue`. The loader adds those to the build report.
 */
import { scanVault, type VaultScan } from "./scan.ts";

export type { ScannedArticle, ScannedChapter, ScannedPage, ScannedPart } from "./scan.ts";
export type Vault = VaultScan;

/** Reads the vault at `root` (the folder holding `book.md`). Never throws for content problems. */
export function readVault(root: string): Vault {
  return scanVault(root);
}
