import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { getDiagramIndex, indexOf } from "./index-svg.ts";

const svg = (box: string, texts: string[] = []) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${box}" class="excalidraw-svg">${texts.map((t) => `<text x="0" y="1">${t}</text>`).join("")}</svg>`;

const root = mkdtempSync(join(tmpdir(), "sdfp-diagrams-"));
afterAll(() => rmSync(root, { recursive: true, force: true }));
for (const [path, text] of Object.entries({
  "part-1_foundations/diagram/01-light.svg": svg("0 0 490.6843233701196 399.69485996703463", ["Cache", "CPU", "RAM", "Disk", "CPU"]),
  "part-1_foundations/diagram/01-dark.svg": svg("0 0 490.68 399.69"),
  "articles/images/flow.svg": svg("0 0 916 300"),
  "design/preview/logo.svg": svg("0 0 10 10"),
  "part-1_foundations/.hidden/x.svg": svg("0 0 1 1"),
  "part-1_foundations/excalidraw/01_computer-architecture.excalidraw.md": "drawing",
})) {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
}

describe("diagram index", () => {
  it("indexes every SVG in the part folders and articles/, and nothing else", async () => {
    const index = await getDiagramIndex(root);
    expect([...index.files.keys()].sort()).toEqual(["articles/images/flow.svg", "part-1_foundations/diagram/01-dark.svg", "part-1_foundations/diagram/01-light.svg"]);
    expect(await getDiagramIndex(root)).toBe(index); // read once per build
  });

  it("reads the size from the viewBox, the words from <text>, and a content hash", async () => {
    const file = (await getDiagramIndex(root)).files.get("part-1_foundations/diagram/01-light.svg")!;
    expect([file.width, file.height]).toEqual([491, 400]);
    expect(file.words).toEqual(["Cache", "CPU", "RAM", "Disk"]);
    expect(file.hash).toMatch(/^[0-9a-f]{8}$/);
    expect(file.unsafe).toBe(false);
  });

  it("decodes entities and nested markup in text, and falls back to width/height without a viewBox", () => {
    const f = indexOf({ "a/x.svg": '<svg width="120" height="80"><text>Read &amp; write <tspan>1&#x2013;2</tspan></text><text> </text></svg>' }).files.get("a/x.svg")!;
    expect(f.words).toEqual(["Read & write 1–2"]);
    expect([f.width, f.height]).toEqual([120, 80]);
    expect(indexOf({ "a/y.svg": "<svg></svg>" }).files.get("a/y.svg")!.width).toBe(0);
  });

  it("survives odd text: out-of-range entities, &nbsp;, CDATA; ignores widths with units; falls back from a zero viewBox", () => {
    const f = indexOf({ "a/x.svg": '<svg viewBox="0 0 0 0" width="300" height="200"><text>a&#x110000;b&#0;c&nbsp;d&copy;</text><text><![CDATA[a < b]]></text></svg>' }).files.get("a/x.svg")!;
    expect(f.words).toEqual(["a�b�c d&copy;", "a < b"]);
    expect([f.width, f.height]).toEqual([300, 200]);
    expect(indexOf({ "a/p.svg": '<svg width="100%" height="10em"></svg>' }).files.get("a/p.svg")!.width).toBe(0);
  });

  it("flags SVGs with active content (scripts, handlers, javascript: links), but not words that mention them", () => {
    const unsafe = (s: string) => indexOf({ "a/x.svg": `<svg viewBox="0 0 1 1">${s}</svg>` }).files.get("a/x.svg")!.unsafe;
    expect(unsafe("<script>alert(1)</script>")).toBe(true);
    expect(unsafe('<rect onclick="x()"/>')).toBe(true);
    expect(unsafe('<a xlink:href="javascript:x()"><text>x</text></a>')).toBe(true);
    expect(unsafe("<foreignObject><div/></foreignObject>")).toBe(true);
    expect(unsafe("<text>javascript: and onload = are words here</text>")).toBe(false);
  });
});
