// Builds design/preview/index.html: one self-contained file (fonts, SVGs, tokens, MathML inlined).
const fs = require("fs"), path = require("path");
const katex = require("katex");
const [vault, pkg, out] = process.argv.slice(2);
const here = __dirname;
const read = (p, enc) => fs.readFileSync(p, enc);

// tokens → CSS custom properties
const tokens = JSON.parse(read(path.join(pkg, "design/tokens.json"), "utf8"));
const get = (p) => p.split(".").reduce((o, k) => o[k], tokens);
const val = (t) => { let v = t.$value; if (typeof v === "string" && v.startsWith("{")) return val(get(v.slice(1, -1))); if (v && v.hex) return v.hex; return v; };
let css = "";
for (const theme of ["light", "dark"]) {
  css += `.theme-${theme}{` + Object.entries(tokens["theme-" + theme]).map(([k, t]) => `--${k}:${val(t)};`).join("") ;
  css += `--font-serif:${tokens.font.family.serif.$value.map(f => f.includes(" ") ? `"${f}"` : f).join(",")};`;
  css += `--font-sans:${tokens.font.family.sans.$value.map(f => f.includes(" ") ? `"${f}"` : f).join(",")};`;
  css += `--font-mono:${tokens.font.family.mono.$value.map(f => f.includes(" ") ? `"${f}"` : f).join(",")};}\n`;
}

// fonts
const fdir = (n) => path.join(here, "node_modules/@fontsource-variable", n, "files");
const face = (family, file, style) => `@font-face{font-family:"${family}";font-style:${style};font-weight:200 900;font-display:swap;src:url(data:font/woff2;base64,${read(file).toString("base64")}) format("woff2");}\n`;
let fonts = face("Source Serif 4", path.join(fdir("source-serif-4"), "source-serif-4-latin-wght-normal.woff2"), "normal")
  + face("Source Serif 4", path.join(fdir("source-serif-4"), "source-serif-4-latin-wght-italic.woff2"), "italic")
  + face("Inter", path.join(fdir("inter"), "inter-latin-wght-normal.woff2"), "normal")
  + face("JetBrains Mono", path.join(fdir("jetbrains-mono"), "jetbrains-mono-latin-wght-normal.woff2"), "normal");

// diagrams
const ddir = path.join(vault, "part-1_foundations/diagram");
const svg = {}, size = {}, alt = {};
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
for (const k of ["01", "02"]) {
  for (const [t, suf] of [["l", "light"], ["d", "dark"]]) {
    const raw = read(path.join(ddir, `${k}-${suf}.svg`));
    svg[k + t] = "data:image/svg+xml;base64," + raw.toString("base64");
    if (t === "l") {
      const s = raw.toString("utf8");
      const vb = s.match(/viewBox="([\d.\s-]+)"/)[1].split(/\s+/).map(Number);
      size[k] = [vb[2], vb[3]];
      const words = [...s.matchAll(/<text[^>]*>([^<]*)<\/text>/g)].map(m => decode(m[1]).trim()).filter(Boolean);
      alt[k] = [...new Set(words)].join(", ") || "diagram";
    }
  }
}

// math (MathML, like the real site's accessible output)
const mm = (tex) => katex.renderToString(tex, { output: "mathml", throwOnError: true });
const math = { frac3: mm(String.raw`\frac{1}{10^3}`), mus: mm(String.raw`\mu s`), approx6: mm(String.raw`\approx \frac{1}{10^6}`) };

// chapter 1 facts
const chPath = path.join(vault, "part-1_foundations/chapter-1_computer-architecture.md");
const ch = read(chPath, "utf8");
const lines = ch.split(/\r?\n/);
const lineOf = (needle) => lines.findIndex(l => l.includes(needle)) + 1;
const words = ch.replace(/!\[\[[^\]]+\]\]/g, " ").replace(/\$[^$]*\$/g, " x ").split(/\s+/).filter(w => /\w/.test(w)).length;
const first = lines.find(l => l.trim() && !l.startsWith("!") && !l.startsWith("#")).trim();
const summary = first.length > 200 ? first.slice(0, first.lastIndexOf(" ", 199)) + "…" : first;
const sections = [
  { id: "components", num: "1.1", text: "Components", d: 2 }, { id: "disk", num: "1.1.1", text: "Disk", d: 3 },
  { id: "ram", num: "1.1.2", text: "RAM (Random Access Memory)", d: 3 }, { id: "cpu", num: "1.1.3", text: "CPU (Central Processing Unit)", d: 3 },
  { id: "cache", num: "1.1.4", text: "Cache", d: 3 }, { id: "limitations", num: "1.2", text: "Limitations", d: 2 },
  { id: "moores-law", num: "1.3", text: "Moore's Law", d: 2 }];
const A = { svg, size, alt, math, ch1: { summary, rt: Math.max(1, Math.ceil(words / 230)), words, sections },
  lines: { micro: lineOf("\\micro"), d01: lineOf("01-light.svg"), d02: lineOf("02-light.svg") } };

let html = read(path.join(here, "template.html"), "utf8");
html = html.replace("/*@@FONTS@@*/", () => fonts).replace("/*@@TOKENS_CSS@@*/", () => css).replace('"@@ASSETS@@"', () => JSON.stringify(A));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, html);
console.log("wrote", out, (html.length / 1024).toFixed(0) + " KB", "| words", words, "| rt", A.ch1.rt, "| lines", JSON.stringify(A.lines), "| alt01:", alt["01"], "| alt02:", alt["02"]);
