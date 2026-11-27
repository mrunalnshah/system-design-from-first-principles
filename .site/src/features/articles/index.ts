/**
 * MOD-articles public interface (specs/modules.md#mod-articles, specs/contracts/interfaces.md): the article pages
 * and lists. The row the homepage and the archive share (T-02.06), the article's end links and the shared date
 * format (T-03.01); the archive joins them in T-03.02. Other modules and pages import only from here (TOOL-06).
 */
export { default as ArticleRow } from "./ArticleRow.astro";
export { default as ArticleEnd } from "./ArticleEnd.astro";
export { formatDate } from "./date.ts";
