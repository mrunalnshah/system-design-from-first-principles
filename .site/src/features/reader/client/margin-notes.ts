/**
 * Margin notes on narrow screens (REQ-READ-006.AC2, ADR-0006). The Markdown renderer writes each footnote twice: a
 * marker `<a class="ref" data-note="n" href="#fn-n">` followed by the note itself, `<span class="sidenote">`, and
 * the usual list at the end. At 1100 px and wider reader.css floats the `.sidenote` into the margin, with no script.
 * Narrower, `.sidenote` stays hidden and the marker links to the end list, which is all a reader without JavaScript
 * gets (REQ-READ-006.AC3). This script turns each such marker, below 1100 px only, into a
 * `<button aria-expanded aria-controls>` that opens its note inline, below the line, and closes it again;
 * reader.css shows the note while its button says `aria-expanded="true"`. When the screen grows to 1100 px the links
 * come back (and the margin shows every note); when it shrinks, the buttons do, all closed.
 * It does nothing on a page without markers, and nothing animates.
 */

/** The width from which notes sit in the margin (design/tokens.json `size.breakpoint-wide`). */
const WIDE = "(min-width: 1100px)";

/** Binds every marker with an inline note in `doc`. Returns a function that undoes it, or undefined if there are none. */
export function bindMarginNotes(doc: Document = document): (() => void) | undefined {
  const pairs = [...doc.querySelectorAll<HTMLAnchorElement>("a.ref[data-note]")]
    .map((link) => ({ link, note: link.nextElementSibling }))
    .filter(
      (p): p is { link: HTMLAnchorElement; note: HTMLElement } =>
        p.note instanceof HTMLElement && p.note.id === `sn-${p.link.dataset.note}`,
    );
  if (!pairs.length) return undefined;

  const toggles = pairs.map(({ link, note }) => ({ link, button: toggleFor(link, note, doc) }));
  const wide = doc.defaultView!.matchMedia(WIDE);
  const apply = () => {
    for (const { link, button } of toggles) {
      if (wide.matches) restoreLink(link, button);
      else if (link.isConnected) {
        button.setAttribute("aria-expanded", "false");
        // The end list's "back" link points at the marker's id, so it moves with the marker.
        if (link.id) {
          button.id = link.id;
          link.removeAttribute("id");
        }
        link.replaceWith(button);
      }
    }
  };
  apply();
  wide.addEventListener("change", apply);
  return () => {
    wide.removeEventListener("change", apply);
    for (const { link, button } of toggles) restoreLink(link, button);
  };
}

/** Puts the original link back in place of its button, with the id the end list's back link points at. */
function restoreLink(link: HTMLAnchorElement, button: HTMLButtonElement): void {
  if (!button.isConnected) return;
  if (button.id) link.id = button.id;
  button.replaceWith(link);
}

/** The button that stands in for `link` on narrow screens: same number and label, and it opens or closes `note`. */
function toggleFor(link: HTMLAnchorElement, note: HTMLElement, doc: Document): HTMLButtonElement {
  const button = doc.createElement("button");
  button.type = "button";
  button.className = link.className;
  button.dataset.note = link.dataset.note!;
  button.setAttribute("aria-label", link.getAttribute("aria-label") ?? `Note ${link.dataset.note}`);
  button.setAttribute("aria-controls", note.id);
  button.setAttribute("aria-expanded", "false");
  button.append(...[...link.childNodes].map((n) => n.cloneNode(true)));
  button.addEventListener("click", () =>
    button.setAttribute("aria-expanded", String(button.getAttribute("aria-expanded") !== "true")),
  );
  return button;
}
