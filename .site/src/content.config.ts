/**
 * The content collections (ADR-0003): all four come from the vault one folder above .site/, through MOD-vault's
 * loader. Figures are drawn by MOD-diagrams; this file hands that renderer to the loader, so the two modules never
 * depend on each other (specs/modules.md).
 */
import { defineCollection } from "astro:content";
import { vaultLoader, type Collection } from "./features/content/index.ts";
import { createFigureRenderer, getDiagramIndex } from "./features/diagrams/index.ts";
import { vaultRoot } from "./features/site/index.ts";

const root = vaultRoot();
const figures = async () => createFigureRenderer(await getDiagramIndex(root));
const collection = (name: Collection) => defineCollection({ loader: vaultLoader({ vaultRoot: root, figures, collection: name }) });

export const collections = {
  chapters: collection("chapters"),
  articles: collection("articles"),
  pages: collection("pages"),
  book: collection("book"),
};
