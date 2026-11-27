/**
 * MOD-articles public interface (specs/modules.md#mod-articles, specs/contracts/interfaces.md): the article pages
 * and lists. So far the row the homepage and the archive share (T-02.06); the article page and the archive join it
 * in T-03.01 and T-03.02. Other modules and pages import only from here (TOOL-06).
 */
export { default as ArticleRow } from "./ArticleRow.astro";
