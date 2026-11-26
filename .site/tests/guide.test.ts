import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Keeps WRITING-GUIDE.md and templates/ in step with the contracts they explain (REQ-AUTH-003):
 * when a frontmatter key or a build message is added, this fails until the guide covers it.
 */
const root = join(import.meta.dirname, "../..");
const read = (rel: string) => readFileSync(join(root, rel), "utf8").replace(/\r\n/g, "\n");
const guide = () => read("WRITING-GUIDE.md");
const templates = () => readdirSync(join(root, "templates")).filter((f) => f.endsWith(".md")).map((f) => read(`templates/${f}`));

/** Every property name in the frontmatter JSON Schema, across all its definitions. */
function frontmatterKeys(): string[] {
  const schema = JSON.parse(read("specs/contracts/frontmatter.schema.json")) as { $defs: Record<string, { properties?: Record<string, unknown> }> };
  return [...new Set(Object.values(schema.$defs).flatMap((d) => Object.keys(d.properties ?? {})))].sort();
}

describe("writing guide and templates", () => {
  // @req REQ-AUTH-003.AC1
  it("explains every frontmatter key, and every key appears in at least one template", () => {
    const keys = frontmatterKeys();
    expect(keys.length).toBeGreaterThan(8);
    const text = guide();
    const all = templates().join("\n");
    for (const key of keys) {
      expect(text, `guide explains ${key}`).toMatch(new RegExp(`\`${key}(:|\`)`));
      expect(all, `a template has ${key}`).toMatch(new RegExp(`^#? ?${key}:`, "m"));
    }
  });

  // @req REQ-AUTH-003.AC2
  it("explains every build message code in its 'When sync or the build stops' section", () => {
    const codes = [...read("specs/contracts/build-messages.md").matchAll(/^\| ([EW]-[A-Z-]+) \|/gm)].map((m) => m[1]!);
    expect(codes.length).toBeGreaterThan(10);
    const section = /## When sync or the build stops\n([\s\S]*?)(?=\n## |$)/.exec(guide())?.[1] ?? "";
    expect(section.length).toBeGreaterThan(0);
    for (const code of codes) expect(section, `guide explains ${code}`).toContain(code);
  });

  // @req REQ-AUTH-003.AC3
  it("keeps templates/ out of what gets published (outside part-*/ and articles/)", () => {
    expect(existsSync(join(root, "templates"))).toBe(true);
    // REQ-CNT-003 publishes only part-<n>_<slug>/ chapters, articles/ and about.md at the root (book.md holds settings).
    expect("templates").not.toMatch(/^part-\d+_/);
    expect("templates").not.toBe("articles");
    for (const f of readdirSync(join(root, "templates"))) expect(join("templates", f)).not.toMatch(/^(about|book)\.md$/);
  });

  it("gives every template valid frontmatter delimiters", () => {
    for (const t of templates()) expect(t).toMatch(/^---\n[\s\S]*?\n---\n/);
  });
});
