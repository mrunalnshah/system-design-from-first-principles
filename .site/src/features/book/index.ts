/**
 * MOD-book public interface (specs/modules.md#mod-book, specs/contracts/interfaces.md): moving through the book in
 * order. Other modules and pages import only from here (TOOL-06).
 */
export {
  contentsOf,
  firstChapter,
  romanNumeral,
  type ContentsChapter,
  type ContentsPart,
  type ContentsSection,
} from "./contents.ts";
export { neighbours } from "./neighbours.ts";
export { default as Contents } from "./Contents.astro";
export { default as PrevNext } from "./PrevNext.astro";
