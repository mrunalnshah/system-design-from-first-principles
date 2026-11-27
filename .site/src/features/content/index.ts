/**
 * MOD-vault public interface (specs/modules.md#mod-vault, specs/contracts/interfaces.md).
 * Other modules, pages and tests import only from here (TOOL-06).
 * `readVault` (the vault as data) and `buildVault` (rendered) are the loader's pure core, for tests and the
 * build-message harness.
 */
export { readVault, type Vault } from "./vault.ts";
export { buildVault, vaultLoader, type ArticleData, type BookData, type ChapterData, type Collection, type LoaderOptions, type PageData, type RenderedVault } from "./loader.ts";
export { bookOf, getArticles, getBook, getPage, type Book, type Part } from "./queries.ts";
export type { BookSettings } from "./book-settings.ts";
export type { ScannedArticle, ScannedChapter, ScannedPage, ScannedPart } from "./scan.ts";
