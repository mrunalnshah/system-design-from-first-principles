// TOOL-06 Boundary rules (plan/tools.md, specs/standards.md#structure, specs/modules.md).
// Run with `npm --prefix .site run lint:boundaries` (CI and every task's Verify).
//
// 1. Outside a module, only its public `index.ts` may be imported.
// 2. Modules depend only in the directions specs/modules.md allows (no cycles).
// Limitation: dependency-cruiser doesn't parse `.astro` files, so imports inside Astro pages and
// components aren't checked here; pages are kept thin and import only `index.ts` (reviewed by hand).
const fs = require("node:fs");

/** Which modules each feature folder may import (from specs/modules.md). */
const ALLOWED = {
  content: ["markdown", "diagrams", "site"], // MOD-vault
  markdown: ["site"], // MOD-obsidian-markdown: general-purpose, no book knowledge
  diagrams: ["site"],
  book: ["content", "site"],
  reader: ["content", "book", "diagrams", "site"],
  home: ["content", "book", "diagrams", "articles", "site"],
  articles: ["content", "reader", "site"],
  site: [],
};

module.exports = {
  forbidden: [
    {
      name: "no-circular",
      severity: "error",
      comment: "Modules and tools must not import each other in a cycle.",
      from: {},
      to: { circular: true },
    },
    {
      name: "only-through-index",
      severity: "error",
      comment: "Import another module only through its index.ts (specs/standards.md#structure).",
      from: { path: "^src/features/([^/]+)/" },
      to: { path: "^src/features/[^/]+/", pathNot: ["^src/features/$1/", "^src/features/[^/]+/index\\.ts$"] },
    },
    {
      name: "pages-only-through-index",
      severity: "error",
      comment: "Code outside src/features (pages, tests) imports a module only through its index.ts.",
      from: { path: "^src/", pathNot: "^src/features/" },
      to: { path: "^src/features/[^/]+/", pathNot: "^src/features/[^/]+/index\\.ts$" },
    },
    ...Object.entries(ALLOWED).map(([module, deps]) => ({
      name: `direction-${module}`,
      severity: "error",
      comment: `${module} may depend only on: ${deps.join(", ") || "nothing"} (specs/modules.md).`,
      from: { path: `^src/features/${module}/` },
      to: { path: "^src/features/[^/]+/", pathNot: `^src/features/(${[module, ...deps].join("|")})/` },
    })),
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    exclude: { path: "(^|/)(node_modules|dist|\\.astro|tests/fixtures)/" },
    tsPreCompilationDeps: true,
    ...(fs.existsSync("tsconfig.json") ? { tsConfig: { fileName: "tsconfig.json" } } : {}),
    enhancedResolveOptions: { extensions: [".ts", ".js", ".mjs", ".astro"] },
  },
};
