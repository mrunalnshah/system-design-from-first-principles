/**
 * TOOL-16 Fixture vault generator (plan/tools.md, NFR-006): `<tools> gen-vault <dir> --chapters N --articles M`.
 * Writes a realistic vault for timing the build at full size: `book.md` and `about.md`, parts of 10 chapters, each
 * chapter about 3,000 words with numbered headings, footnotes, inline and display math, a table, a code block, a
 * callout, links between chapters and two diagrams (a drawing embed and a light/dark SVG pair, copied from the
 * fixture vault); and articles a week apart, newest first, some with math and a diagram.
 * The text is made from a fixed word list with a seeded generator, so the same arguments always write the same vault.
 * Writes only into an empty or new folder, so it can never overwrite a real vault.
 * Runs on Node's built-in TypeScript support (CR-0001): erasable syntax only.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/** How big a vault to write. */
export type VaultSize = { chapters: number; articles: number };

/** What was written: the counts asked for, and how many files in all. */
export type GeneratedVault = VaultSize & { parts: number; files: number };

/** Chapters per part, as in a long technical book. */
const PER_PART = 10;

/** The diagrams copied into the first part's `diagram/` folder; every entry embeds them by name, as Obsidian allows. */
const DIAGRAMS = join(import.meta.dirname, "../tests/fixtures/vault/part-1_foundations/diagram");
const DIAGRAM_FILES = [
  "01_computer-architecture-light.svg",
  "01_computer-architecture-dark.svg",
  "02_moores-law-light.svg",
  "02_moores-law-dark.svg",
];

const PARTS = [
  "foundations",
  "networks",
  "storage",
  "replication",
  "consensus",
  "scaling",
  "queues",
  "caching",
  "observability",
  "operations",
];
const TOPICS = [
  "computer-architecture",
  "memory-hierarchy",
  "processes",
  "threads",
  "file-systems",
  "virtual-memory",
  "interrupts",
  "scheduling",
  "io-models",
  "benchmarks",
  "packets",
  "tcp",
  "udp",
  "dns",
  "http",
  "tls",
  "load-balancers",
  "proxies",
  "cdns",
  "latency",
  "b-trees",
  "lsm-trees",
  "indexes",
  "transactions",
  "isolation",
  "write-ahead-logs",
  "compaction",
  "column-stores",
  "blob-storage",
  "backups",
  "leaders",
  "followers",
  "quorums",
  "conflicts",
  "clocks",
  "vector-clocks",
  "anti-entropy",
  "hinted-handoff",
  "read-repair",
  "geo-replication",
  "failure-detectors",
  "paxos",
  "raft",
  "leases",
  "fencing",
  "membership",
  "two-phase-commit",
  "sagas",
  "idempotency",
  "exactly-once",
  "sharding",
  "consistent-hashing",
  "rebalancing",
  "hot-keys",
  "rate-limiting",
  "backpressure",
  "autoscaling",
  "capacity",
  "cost",
  "multi-tenancy",
];
const WORDS = (
  "the a system request server client node disk memory cache network packet queue log replica leader write read latency throughput " +
  "failure retry timeout clock order commit state message batch index key value page block buffer copy load shard partition " +
  "consistent available durable fast slow small large every each one two many often rarely first then because so but and or " +
  "when while until before after must can will may waits sends stores reads writes fails recovers grows shrinks measures costs"
).split(" ");

/** A small seeded generator (mulberry32), so a vault is the same on every run. */
function random(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Writes the vault into `dir` (created if missing; it must be empty) and returns what it wrote. */
export function generateVault(dir: string, size: VaultSize): GeneratedVault {
  for (const [name, n] of Object.entries(size))
    if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} needs a whole number, e.g. --${name} 60`);
  if (existsSync(dir) && readdirSync(dir).length)
    throw new Error(
      `${dir} isn't empty: gen-vault writes only into an empty or new folder, so it never overwrites a vault.`,
    );
  let files = 0;
  const write = (path: string, text: string) => {
    mkdirSync(join(dir, path, ".."), { recursive: true });
    writeFileSync(join(dir, path), text);
    files++;
  };

  write(
    "book.md",
    [
      "---",
      'title: "System Design from First Principles"',
      'subtitle: "How large systems work, from the hardware up."',
      'author: "Mrunal Nirajkumar Shah"',
      'author_url: "https://mrunalnshah.github.io/"',
      'hero_image: "01_computer-architecture-light.svg"',
      "---",
      "A generated vault for timing the build (TOOL-16).",
      "",
    ].join("\n"),
  );
  write("about.md", ["---", 'title: "About"', "---", paragraph(random(1), 80), ""].join("\n"));

  const parts = Math.ceil(size.chapters / PER_PART);
  const names: string[] = [];
  for (let n = 1; n <= size.chapters; n++) {
    const part = Math.ceil(n / PER_PART);
    const folder = `part-${part}_${PARTS[(part - 1) % PARTS.length]}${part > PARTS.length ? `-${part}` : ""}`;
    const topic = TOPICS[(n - 1) % TOPICS.length]! + (n > TOPICS.length ? `-${n}` : "");
    const name = `chapter-${n}_${topic}`;
    write(`${folder}/${name}.md`, chapter(n, names.at(-1)));
    names.push(name);
  }
  if (size.chapters) {
    mkdirSync(join(dir, "part-1_foundations/diagram"), { recursive: true });
    for (const f of DIAGRAM_FILES) {
      copyFileSync(join(DIAGRAMS, f), join(dir, "part-1_foundations/diagram", f));
      files++;
    }
  }

  const newest = Date.UTC(2026, 10, 1);
  for (let n = 1; n <= size.articles; n++) {
    const date = new Date(newest - (n - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
    write(
      `articles/${TOPICS[(n * 7) % TOPICS.length]}-note-${n}.md`,
      article(n, date, size.chapters > 0, names[n % Math.max(names.length, 1)]),
    );
  }
  return { ...size, parts, files };
}

/** A paragraph of about `words` words, ending with a full stop. */
function paragraph(next: () => number, words: number): string {
  const out: string[] = [];
  for (let i = 0; i < words; i++) out.push(WORDS[Math.floor(next() * WORDS.length)]!);
  out[0] = out[0]![0]!.toUpperCase() + out[0]!.slice(1);
  return `${out.join(" ")}.`;
}

/** Chapter `n`: four sections of three subsections, with every kind of content the reader renders. */
function chapter(n: number, previous: string | undefined): string {
  const next = random(n * 7919);
  const lines = [
    "---",
    `description: "Chapter ${n} of the generated book."`,
    ...(n % 3 === 0 ? ['epigraph: "Everything is a trade-off."', 'epigraph_source: "Anonymous"'] : []),
    "---",
  ];
  lines.push(
    paragraph(next, 60),
    "",
    `![[01_computer-architecture.excalidraw|How a computer is put together, chapter ${n}]]`,
    "",
  );
  let note = 0;
  for (let s = 1; s <= 4; s++) {
    lines.push(`# Section ${s}`, "", paragraph(next, 90), "");
    for (let t = 1; t <= 3; t++) {
      note++;
      lines.push(
        `## Part ${s}.${t}`,
        "",
        `${paragraph(next, 110)} A read costs about $\\frac{1}{10^${s + t}}$ s.[^${note}]`,
        "",
        paragraph(next, 100),
        "",
      );
      if (t === 2) lines.push("- " + paragraph(next, 12), "- " + paragraph(next, 10), "\t- " + paragraph(next, 8), "");
    }
    if (s === 1) lines.push("$$", `T = \\sum_{i=1}^{${n}} \\frac{w_i}{\\mu - \\lambda_i}`, "$$", "");
    if (s === 2)
      lines.push(
        "| Layer | Latency | Size |",
        "|---|---|---|",
        "| Cache | 1 ns | MB |",
        "| RAM | 100 ns | GB |",
        "| Disk | 1 ms | TB |",
        "",
      );
    if (s === 3)
      lines.push(
        "```ts",
        `function retry(attempt: number): number {`,
        `  return Math.min(1000 * 2 ** attempt, ${n * 1000});`,
        "}",
        "```",
        "",
        "> [!note] Why it matters",
        `> ${paragraph(next, 30)}`,
        "",
      );
    if (s === 4)
      lines.push(
        `![[02_moores-law-light.svg|Moore's law, chapter ${n}]]`,
        "",
        previous ? `See [[${previous}]] for what came before.` : "This is where the book starts.",
        "",
      );
  }
  for (let i = 1; i <= note; i++) lines.push(`[^${i}]: ${paragraph(next, 14)}`);
  return `${lines.join("\n")}\n`;
}

/** Article `n`: dated, about 900 words, with math and a diagram in every fifth one. */
function article(n: number, date: string, diagram: boolean, chapterName: string | undefined): string {
  const next = random(n * 104729);
  const lines = [
    "---",
    `date: ${date}`,
    `description: "Article ${n} of the generated vault."`,
    "---",
    paragraph(next, 50),
    "",
  ];
  for (let s = 1; s <= 3; s++) lines.push(`# Point ${s}`, "", paragraph(next, 140), "", paragraph(next, 110), "");
  if (n % 5 === 0)
    lines.push(
      "Little's law: $L = \\lambda W$.",
      "",
      ...(diagram ? ["![[02_moores-law.excalidraw|Moore's law]]", ""] : []),
    );
  if (chapterName) lines.push(`More in [[${chapterName}]].`, "");
  return lines.join("\n");
}
