# ADR-0008: Typeset math at build time with our own KaTeX 0.19.1 step
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
REQ-READ-008 needs build-time math without JS, and errors that name file and line (REQ-CNT-007). CNF-001: KaTeX 0.19.1 doesn't define `\micro`; the author writes `\mu`. rehype-katex 7.0.1 depends on katex `^0.16` (npm registry, 2026-11-26).

## Options
1. **remark-math for parsing + our rehype step calling katex 0.19.1 (`throwOnError: true`, `output: "htmlAndMathml"`):** Our step catches KaTeX errors and turns them into `E-MATH` issues at the node's position. Pros: Latest KaTeX; exact error positions; MathML for screen readers. Cons: About 40 lines of code to own.
2. **rehype-katex with an npm `overrides` entry forcing katex 0.19.1:** Use the community plugin and override its dependency. Pros: Less code. Cons: Overrides can break silently on upgrade; rehype-katex renders errors in the page rather than failing the build, so we'd still need a separate check.

## Decision
Option 1.

## Consequences
KaTeX CSS and fonts are self-hosted from the katex package; style attributes in KaTeX output need `style-src 'unsafe-inline'` in the CSP (security.md).
