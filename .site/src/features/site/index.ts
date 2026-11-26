/**
 * MOD-site public interface (specs/modules.md#mod-site, specs/contracts/interfaces.md).
 * Other modules and pages import only from here, never from this folder's other files (TOOL-06).
 */
export { absoluteUrl, url, type Route } from "./url.ts";
export { default as BaseLayout } from "./BaseLayout.astro";
