/**
 * How an article's date reads on the site: "1 November 2026" (REQ-READ-009.AC1, design/components.md ArticleMeta).
 * One place, so the archive's rows, the homepage's rows and the article's own header always agree.
 * `iso` is a calendar day, `YYYY-MM-DD` (the frontmatter's `date`, already checked by the loader). It's read and
 * shown in UTC, so the build machine's time zone can never move it a day.
 */
const FORMAT = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function formatDate(iso: string): string {
  return FORMAT.format(new Date(`${iso}T00:00:00Z`));
}
