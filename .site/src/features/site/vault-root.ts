/**
 * Where the author's vault is: the folder that holds `.site/` (ADR-0002). Fixed by astro.config.ts from its own
 * location, so it's right whatever folder the build runs from (`npm --prefix .site`, or `astro --root .site`).
 */
import { resolve } from "node:path";

/** The vault's absolute path. */
export function vaultRoot(): string {
  // Set by astro.config.ts (vite.define); the fallback serves plain-Node callers, which run from .site/.
  return import.meta.env.SDFP_VAULT_ROOT ?? resolve(process.cwd(), "..");
}
