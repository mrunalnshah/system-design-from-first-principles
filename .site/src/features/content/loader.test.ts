import { cpSync, mkdtempSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { url } from "../site/index.ts";
import { buildVault, romanNumeral } from "./loader.ts";

const fixture = join(import.meta.dirname, "../../../tests/fixtures/vault");
/** A stand-in for MOD-diagrams' renderer (tests/vault-diagrams.test.ts runs the loader with the real one). */
const options = (vaultRoot: string) => ({ vaultRoot, figures: async () => ({ files }: { files: string[] }) => ({ html: `<figure class="diagram" data-files="${files.join(" ")}"></figure>`, issues: [] }) });

const made: string[] = [];
afterAll(() => made.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe("vault loader", () => {
  // @req REQ-BOOK-002.AC1
  it("publishes chapter-1_computer-architecture.md at book/computer-architecture/", async () => {
    const vault = await buildVault(options(fixture));
    expect(vault.chapters.map((c) => c.slug)).toEqual(["computer-architecture", "tcp"]);
    expect(url({ kind: "chapter", slug: vault.chapters[0]!.slug })).toMatch(/\/book\/computer-architecture\/$/);
  });

  // @req REQ-BOOK-002.AC3
  it("keeps a chapter's address when it's renumbered from 1 to 2", async () => {
    const copy = mkdtempSync(join(tmpdir(), "sdfp-renumber-"));
    made.push(copy);
    cpSync(fixture, copy, { recursive: true });
    renameSync(join(copy, "part-2_networks/chapter-2_tcp.md"), join(copy, "part-2_networks/chapter-3_tcp.md"));
    renameSync(join(copy, "part-1_foundations/chapter-1_computer-architecture.md"), join(copy, "part-1_foundations/chapter-2_computer-architecture.md"));
    const renumbered = await buildVault(options(copy));
    const chapter = renumbered.chapters.find((c) => c.slug === "computer-architecture")!;
    expect(chapter.number).toBe(2);
    expect(url({ kind: "chapter", slug: chapter.slug })).toMatch(/\/book\/computer-architecture\/$/);
  });

  it("renders the fixture's Chapter 1 (its text, with captioned drawing embeds): figures, math, numbered sections, no issues", async () => {
    const vault = await buildVault(options(fixture));
    const [chapter] = vault.chapters;
    expect(vault.issues).toEqual([]);
    expect(chapter!.html.match(/<figure class="diagram"/g)).toHaveLength(2);
    expect(chapter!.html).toContain('<annotation encoding="application/x-tex">\\mu s</annotation>');
    expect(chapter!.sections.map((s) => `${s.number} ${s.text}`).slice(0, 2)).toEqual(["1.1 Components", "1.1.1 Disk"]);
    expect(chapter!.part).toEqual({ number: 1, romanNumeral: "I", slug: "foundations", title: "Foundations" });
    expect(chapter!.summary).toMatch(/^Before we can learn how to design large-scale distributed system/);
    expect(chapter!.hasDiagrams).toBe(true);
  });

  it("links [[notes]] by file name or slug, renders book.md's pitch, and leaves drafts out", async () => {
    const vault = await buildVault(options(fixture));
    expect(vault.book).toMatchObject({ title: "System Design from First Principles", author: "Mrunal Nirajkumar Shah", pitchHtml: "<p>A book that starts from the computer itself.</p>" });
    expect(vault.chapters.map((c) => c.slug)).not.toContain("queues");
    const tcp = vault.chapters[1]!;
    expect(tcp.epigraph).toEqual({ text: "Everything is a trade-off.", source: "Anonymous" });
    expect(tcp.hasFootnotes).toBe(true);
    expect(vault.articles.map((a) => a.slug)).toEqual(["why-caches"]);
    expect(vault.pages.map((p) => p.slug)).toEqual(["about"]);
    expect(vault.book!.hasAbout).toBe(true);
  });

  // @req REQ-SITE-003.AC2
  it("tells the pages there's no About page when the vault has no about.md", async () => {
    const copy = mkdtempSync(join(tmpdir(), "sdfp-loader-no-about-"));
    made.push(copy);
    cpSync(fixture, copy, { recursive: true });
    rmSync(join(copy, "about.md"));
    const vault = await buildVault(options(copy));
    expect([vault.pages, vault.book!.hasAbout]).toEqual([[], false]);
    expect(vault.issues.map((i) => i.code)).toContain("W-ABOUT-MISSING");
  });

  it("writes part numbers as Roman numerals", () => {
    expect([1, 4, 9, 14, 40, 1999].map(romanNumeral)).toEqual(["I", "IV", "IX", "XIV", "XL", "MCMXCIX"]);
  });
});
