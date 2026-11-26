import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { readBookSettings } from "./book-settings.ts";

const fixture = join(import.meta.dirname, "../../../tests/fixtures/vault");
const made: string[] = [];
function vaultWithBook(text?: string): string {
  const root = mkdtempSync(join(tmpdir(), "sdfp-book-"));
  made.push(root);
  if (text !== undefined) writeFileSync(join(root, "book.md"), text);
  return root;
}
afterEach(() => made.splice(0).forEach((r) => rmSync(r, { recursive: true, force: true })));

describe("book.md settings", () => {
  // @req REQ-CNT-011.AC1
  it("reads title, author and author_url (and subtitle, hero image, pitch) from book.md", () => {
    // The header, hero and footer read these settings; they're rendered with the site shell (T-01.14, T-01.15).
    expect(readBookSettings(fixture)).toEqual({
      settings: {
        title: "System Design from First Principles",
        subtitle: "How large systems work, from the hardware up.",
        author: "Mrunal Nirajkumar Shah",
        authorUrl: "https://mrunalnshah.github.io/",
        heroImage: "01-light.svg",
        pitchMarkdown: "A book that starts from the computer itself.",
      },
      issues: [],
    });
  });

  // @req REQ-CNT-011.AC2
  it("stops when book.md is missing, saying so and giving an example", () => {
    const { settings, issues } = readBookSettings(vaultWithBook());
    expect(settings).toBeUndefined();
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ severity: "error", code: "E-BOOK-MISSING", file: "book.md", message: "book.md is missing at the vault root. Create it with at least a title and an author." });
    expect(issues[0]!.fix).toMatch(/^Create book\.md with at least a title, an author and author_url\. Example:\n---\ntitle: .+\nauthor: .+\nauthor_url: https:\/\/.+\n---/);
  });

  // @req REQ-CNT-011.AC3
  it("stops with an error naming author_url when it isn't an https address", () => {
    const { settings, issues } = readBookSettings(vaultWithBook('---\ntitle: "T"\nauthor: "A"\nauthor_url: "http://example.com/"\n---\n'));
    expect(settings).toBeUndefined();
    expect(issues).toEqual([
      {
        severity: "error",
        code: "E-FRONTMATTER-FIELD",
        file: "book.md",
        line: 4,
        message: "author_url must be an https:// address.",
        fix: "Change author_url to an https:// address, e.g. author_url: https://example.com/",
      },
    ]);
  });

  it("names each missing required field", () => {
    const { issues } = readBookSettings(vaultWithBook('---\ntitle: "T"\n---\n'));
    expect(issues.map((i) => i.message)).toEqual([
      "author is missing; it must be your name as readers should see it.",
      "author_url is missing; it must be an https:// address.",
    ]);
  });
});
