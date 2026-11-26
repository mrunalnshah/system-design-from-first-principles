# ADR-0011: Use local preview plus a CI build artifact as staging; GitHub Pages is production
Status: accepted · Date: 2026-11-26 · Supersedes: none

## Context
BLUEPRINT 7.6 asks for development, staging and production environments. GitHub Pages serves one site per repository, there are no preview deploys for pull requests, and the budget is $0 (NFR-007).

## Options
1. **Development = `astro dev`; staging = `astro preview` of the exact CI build under the real base path, plus the Pages artifact attached to every CI run; production = GitHub Pages:** Phase demos run against `astro preview` of the main-branch artifact, then the live site. Pros: $0; no extra repositories; the same bytes are previewed and deployed. Cons: No shared public staging URL.
2. **A second public repository whose Pages site acts as staging:** CI deploys pull-request builds to a staging repo. Pros: A real hosted staging URL. Cons: Two repositories, a deploy token (a secret) and more setup for a light coder.

## Decision
Option 1. Phase-end demos (G6) run on the live site after deploy, because a static site carries little environment risk.

## Consequences
Operations runbooks describe how to preview a build locally (`npm --prefix .site run preview`).
