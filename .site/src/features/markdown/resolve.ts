/**
 * Obsidian's file lookup for `![[name]]` (REQ-CNT-006): a name matches every vault file with that file name (or
 * that path ending, for `![[diagram/01-light.svg]]`), and the match closest to the embedding note wins: the one
 * sharing the most folders with it, then the shortest path, then the first in alphabetical order. Exact case is
 * preferred; a different case still matches when nothing else does (Windows and macOS ignore case).
 * `![[note]]` without an extension also finds `note.md`.
 */

/** A resolver over the vault's files (vault-relative, `/`-separated). Never touches the disk. */
export function createFileResolver(paths: readonly string[]): (name: string, fromPath: string) => string | undefined {
  return (name, fromPath) => {
    const wanted = name.trim().replace(/^\.?\//, "");
    if (!wanted) return undefined;
    const tries = /\.[^/.]+$/.test(wanted) ? [wanted] : [wanted, `${wanted}.md`];
    for (const exactCase of [true, false]) {
      for (const t of tries) {
        const found = paths.filter((p) => endsWithPath(p, t, exactCase));
        if (found.length) return closest(found, fromPath);
      }
    }
    return undefined;
  };
}

function endsWithPath(path: string, name: string, exactCase: boolean): boolean {
  const [p, n] = exactCase ? [path, name] : [path.toLowerCase(), name.toLowerCase()];
  return p === n || p.endsWith(`/${n}`);
}

function closest(candidates: string[], fromPath: string): string {
  const from = fromPath.split("/").slice(0, -1);
  const shared = (p: string) => {
    const dirs = p.split("/").slice(0, -1);
    let n = 0;
    while (n < dirs.length && n < from.length && dirs[n] === from[n]) n++;
    return n;
  };
  return [...candidates].sort((a, b) => shared(b) - shared(a) || a.split("/").length - b.split("/").length || a.localeCompare(b))[0]!;
}
