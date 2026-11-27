/**
 * Keyboard previous/next (REQ-BOOK-005, ADR-0006): on a chapter, ← opens the previous chapter and → the next, from
 * the page's own `<link rel="prev">` / `<link rel="next">` (the chapter page writes them; the first and last chapter
 * have only one). Keys are left alone while the reader is typing, holds a modifier (Alt+← is the browser's Back),
 * has a dialog open (the full-screen diagram view, whose keys zoom, or the sections sheet), or has focus on a box
 * that scrolls sideways (a wide formula or table, where the arrows scroll it). Without JavaScript nothing changes:
 * the previous/next links at the end of the chapter still work.
 */

/** The parts of a key press the decision needs. */
export type KeyPress = Pick<
  KeyboardEvent,
  "key" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing" | "defaultPrevented"
>;

/** Where the key press happens: is the reader typing, is a dialog open, does the focused box scroll sideways. */
export type KeyPlace = { typing: boolean; dialogOpen: boolean; scrollsSideways: boolean };

/** Which way a key press goes: to the previous or the next chapter, or nowhere. */
export function directionOf(press: KeyPress, place: KeyPlace): "prev" | "next" | undefined {
  if (press.defaultPrevented || press.isComposing) return undefined;
  if (press.altKey || press.ctrlKey || press.metaKey || press.shiftKey) return undefined;
  if (place.typing || place.dialogOpen || place.scrollsSideways) return undefined;
  if (press.key === "ArrowLeft") return "prev";
  if (press.key === "ArrowRight") return "next";
  return undefined;
}

/** Binds the arrow keys in `doc`. Returns a function that unbinds them, or undefined on a page with no rel=prev/next. */
export function bindKeyboardNav(doc: Document = document): (() => void) | undefined {
  const target = (rel: "prev" | "next") => doc.querySelector<HTMLLinkElement>(`link[rel="${rel}"][href]`)?.href;
  if (!target("prev") && !target("next")) return undefined;
  const view = doc.defaultView!;
  const onKey = (event: KeyboardEvent) => {
    const direction = directionOf(event, placeOf(doc, view));
    const href = direction && target(direction);
    if (!href) return;
    event.preventDefault();
    view.location.assign(href);
  };
  doc.addEventListener("keydown", onKey);
  return () => doc.removeEventListener("keydown", onKey);
}

/** What's focused, and whether a dialog is open, for `directionOf`. */
function placeOf(doc: Document, view: Window): KeyPlace {
  const focused = doc.activeElement instanceof HTMLElement ? doc.activeElement : null;
  const typing = !!focused && (focused.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(focused.tagName));
  // The focused element or a box around it (a link in a wide table) that scrolls sideways keeps its arrow keys.
  let scrollsSideways = false;
  for (let el: HTMLElement | null = focused; el && el !== doc.body; el = el.parentElement) {
    if (/auto|scroll/.test(view.getComputedStyle(el).overflowX) && el.scrollWidth > el.clientWidth) {
      scrollsSideways = true;
      break;
    }
  }
  return { typing, dialogOpen: !!doc.querySelector("dialog[open]"), scrollsSideways };
}
