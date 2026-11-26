/**
 * Diagram images at `diagrams/<hash8>-<file-name>.svg` (routes.md, REQ-DIAG-001). Each SVG is served as written;
 * shown through <img>, it can never run scripts (ADR-0005). The hash changes with the image, so a new version
 * never shows a stale cached one.
 */
import { resolve } from "node:path";
import type { APIRoute, GetStaticPaths } from "astro";
import { diagramAssetPaths, getDiagramIndex } from "../../features/diagrams/index.ts";

export const getStaticPaths: GetStaticPaths = async () => diagramAssetPaths(await getDiagramIndex(resolve(process.cwd(), "..")));

export const GET: APIRoute = ({ props }) => new Response((props as { svg: string }).svg, { headers: { "Content-Type": "image/svg+xml; charset=utf-8" } });
