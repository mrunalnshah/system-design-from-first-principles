/**
 * Diagram images at `diagrams/<hash8>-<safe-name>.svg` (routes.md, REQ-DIAG-001): every image a figure shows, served
 * as written. In a figure it's an <img>, where an SVG can't run scripts; opened on its own (the figure links to it)
 * it's a document, so the index refuses any SVG with script or event handlers (E-DIAGRAM-UNSAFE, security.md B4).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { APIRoute, GetStaticPaths } from "astro";
import { diagramAssetPaths, getDiagramIndex } from "../../features/diagrams/index.ts";
import { vaultRoot } from "../../features/site/index.ts";

export const getStaticPaths: GetStaticPaths = async () => diagramAssetPaths(await getDiagramIndex(vaultRoot()));

export const GET: APIRoute = async ({ props }) =>
  new Response(await readFile(join(vaultRoot(), (props as { sourcePath: string }).sourcePath)), { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
