/**
 * The chapter menu's behaviour (REQ-READ-007, ADR-0006). The markup works without it: ChapterMenu.astro renders the
 * sticky panel (1100 px and wider), the "Sections" bar and its sheet (narrower), and a plain list under the title
 * that CSS shows instead when scripting is off. This script adds two things:
 * - the scrollspy: the section the reader is in gets `aria-current="location"` in the panel and the sheet;
 * - the phone sheet: the `data-sections-button` opens the `<dialog>` as a modal (focus moves into it and stays
 *   there), and Escape, the close button or a tap outside it close it, focus back on the button; choosing a section
 *   closes it too, with focus on that section's heading.
 * It binds to `[data-chapter-menu]` and does nothing when that markup is absent. Nothing moves: the sheet has no
 * animation for readers who ask for less motion (the CSS's job), and the script never scrolls the page itself.
 */

/**
 * The section the reader is in: the last heading whose top has reached the reading line (`line` px from the top
 * of the screen), or -1 above the first heading. `tops` are the headings' tops on screen, in document order.
 */
export function currentIndex(tops: readonly number[], line: number): number {
  let current = -1;
  tops.forEach((top, i) => {
    if (top <= line) current = i;
  });
  return current;
}

/**
 * Where the reading line sits: a little below the scroll padding, the point a section link brings its heading to
 * (under the sticky header and bar). `scrollPadding` in px.
 */
export function readingLine(scrollPadding: number): number {
  return scrollPadding + LINE_OFFSET;
}

/** How far below the scroll padding a heading counts as reached, in px. */
const LINE_OFFSET = 24;

/**
 * Binds the menu found in `doc`: the scrollspy and the sheet. Returns a function that unbinds both, or undefined
 * when the page has no chapter menu.
 */
export function bindChapterMenu(doc: Document = document): (() => void) | undefined {
  const menu = doc.querySelector<HTMLElement>("[data-chapter-menu]");
  if (!menu) return undefined;
  const view = doc.defaultView!;
  const stops = [bindScrollspy(menu, doc, view), bindSheet(menu, view)];
  return () => stops.forEach((stop) => stop());
}

/** Marks the current section's links in the panel and the sheet; recomputed when a heading crosses the line. */
function bindScrollspy(menu: HTMLElement, doc: Document, view: Window): () => void {
  const links = [...menu.querySelectorAll<HTMLAnchorElement>("a[data-section]")];
  const ids = [...new Set(links.map((a) => a.dataset.section!))];
  const headings = ids.map((id) => doc.getElementById(id)).filter((h): h is HTMLElement => h !== null);
  if (!headings.length) return () => {};

  const line = () => readingLine(parseFloat(view.getComputedStyle(doc.documentElement).scrollPaddingBlockStart) || 0);
  const panel = menu.querySelector<HTMLElement>(".chapter-panel");
  let shown: string | undefined;
  const update = () => {
    const i = currentIndex(
      headings.map((h) => h.getBoundingClientRect().top),
      line(),
    );
    const id = i >= 0 ? headings[i]!.id : undefined;
    if (id === shown) return;
    shown = id;
    for (const a of links) {
      if (a.dataset.section === id) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    }
    keepInView(
      panel,
      links.find((a) => a.dataset.section === id && panel?.contains(a)),
    );
  };

  // A heading entering or leaving the part of the screen below the reading line is exactly when the section changes.
  // A throttled scroll check catches a jump that moves no heading across that part (from one long section's middle
  // to another's); `scrollend` would do, but not every supported browser has it.
  let observer: IntersectionObserver | undefined;
  const observe = () => {
    observer?.disconnect();
    observer = new IntersectionObserver(update, { rootMargin: `-${Math.round(line())}px 0px 0px 0px` });
    headings.forEach((h) => observer!.observe(h));
  };
  let frame = 0;
  const onScroll = () => {
    if (!frame) frame = view.requestAnimationFrame(() => ((frame = 0), update()));
  };
  // The reading line moves only when the bar comes or goes (crossing 1100 px), not on every resize: mobile browsers
  // resize the window as their address bar slides in and out.
  const wide = view.matchMedia("(min-width: 1100px)");
  observe();
  update();
  view.addEventListener("scroll", onScroll, { passive: true });
  wide.addEventListener("change", observe);
  return () => {
    observer?.disconnect();
    if (frame) view.cancelAnimationFrame(frame);
    view.removeEventListener("scroll", onScroll);
    wide.removeEventListener("change", observe);
  };
}

/** Scrolls the panel itself (never the page), with no animation, so its highlighted link stays visible. */
function keepInView(panel: HTMLElement | null, link: HTMLElement | undefined): void {
  if (!panel || !link || panel.scrollHeight <= panel.clientHeight) return;
  const p = panel.getBoundingClientRect();
  const l = link.getBoundingClientRect();
  if (l.top < p.top) panel.scrollTop -= p.top - l.top;
  else if (l.bottom > p.bottom) panel.scrollTop += l.bottom - p.bottom;
}

/** The phone sheet: a modal `<dialog>` opened by the Sections button. */
function bindSheet(menu: HTMLElement, view: Window): () => void {
  const button = menu.querySelector<HTMLButtonElement>("[data-sections-button]");
  const sheet = menu.querySelector<HTMLDialogElement>("dialog[data-sections-sheet]");
  if (!button || !sheet) return () => {};

  /** The section chosen in the sheet, if that's what closed it. */
  let chosen: HTMLElement | null = null;
  const open = () => {
    chosen = null;
    sheet.showModal();
    button.setAttribute("aria-expanded", "true");
  };
  const onClose = () => {
    button.setAttribute("aria-expanded", "false");
    if (chosen) {
      // Reading on from the chosen section: focus goes to its heading (already scrolled to), so Tab continues there.
      if (!chosen.hasAttribute("tabindex")) chosen.setAttribute("tabindex", "-1");
      chosen.focus({ preventScroll: true });
      chosen = null;
    } else button.focus();
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element;
    const link = target.closest<HTMLAnchorElement>("a[data-section]");
    // The dialog itself is hit only outside its content (the backdrop); a section link closes it and then navigates.
    if (link) chosen = menu.ownerDocument.getElementById(link.dataset.section!);
    if (link || target === sheet || target.closest("[data-sheet-close]")) sheet.close();
  };
  // Grown wide while open: the panel shows the sections, so the sheet goes.
  const wide = view.matchMedia("(min-width: 1100px)");
  const onWide = () => wide.matches && sheet.open && sheet.close();

  button.addEventListener("click", open);
  sheet.addEventListener("close", onClose);
  sheet.addEventListener("click", onClick);
  wide.addEventListener("change", onWide);
  return () => {
    button.removeEventListener("click", open);
    sheet.removeEventListener("close", onClose);
    sheet.removeEventListener("click", onClick);
    wide.removeEventListener("change", onWide);
  };
}
