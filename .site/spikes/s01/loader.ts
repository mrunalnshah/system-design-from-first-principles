/**
 * SPIKE S-01 (T-00.07, CNF-004): throwaway. Deleted in T-00.08 once the findings are in
 * specs/conflicts.md. Question: can an Astro 7 custom content loader, running from the `.site/`
 * dot folder, read a chapter from the vault one folder up, store HTML rendered by OUR pipeline
 * (with a per-entry option such as the chapter number), and have `render()` show it?
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Loader } from "astro/loaders";

const chapterPath = fileURLToPath(new URL("../../../part-1_foundations/chapter-1_computer-architecture.md", import.meta.url));

/** Stands in for renderObsidian(): proves our own HTML and a per-entry option reach the page. */
function ourRender(markdown: string, opts: { chapterNumber: number }): string {
  const firstLine = markdown.split(/\r?\n/).find((l) => l.trim()) ?? "";
  return `<p data-spike="own-pipeline" data-chapter="${opts.chapterNumber}">${firstLine.replace(/</g, "&lt;")}</p>`;
}

export function spikeLoader(): Loader {
  return {
    name: "s01-spike",
    load: async ({ store, logger, parseData }) => {
      const markdown = readFileSync(chapterPath, "utf8");
      store.clear();
      const data = await parseData({ id: "computer-architecture", data: { chapterNumber: 1 } });
      store.set({
        id: "computer-architecture",
        data,
        body: markdown,
        filePath: "../part-1_foundations/chapter-1_computer-architecture.md",
        rendered: { html: ourRender(markdown, { chapterNumber: 1 }), metadata: { headings: [] } },
      });
      logger.info(`S-01: read ${markdown.length} chars from ${chapterPath}`);
    },
  };
}
