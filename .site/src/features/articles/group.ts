/**
 * The archive's year groups (REQ-ART-002, design/screens/articles.md): every article in a group for its year, the
 * newest year first, newest article first inside each; articles with no date in a final "Undated" group. Featured
 * articles get no special place here (that's the homepage's order): the archive is a timeline.
 */
import type { ArticleData } from "../content/index.ts";

/** One year's articles. `label` is the year ("2026") or "Undated"; never empty: groups only exist for articles. */
export type YearGroup = { label: string; articles: ArticleData[] };

export const UNDATED = "Undated";

/** The articles, in any order, grouped by year. Ties on a date are broken by slug, so the order never depends on the file system. */
export function groupByYear(articles: readonly ArticleData[]): YearGroup[] {
  // ISO dates sort as text; undated ones ("" here) end up last, and form their own group.
  // Slugs compare by code point, not by the build machine's locale.
  const sorted = [...articles].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const groups: YearGroup[] = [];
  for (const article of sorted) {
    const label = article.date ? article.date.slice(0, 4) : UNDATED;
    const last = groups.at(-1);
    if (last?.label === label) last.articles.push(article);
    else groups.push({ label, articles: [article] });
  }
  return groups;
}
