/**
 * The full-screen diagram view (REQ-DIAG-003, ADR-0005, design/components.md DiagramViewer). Without JavaScript a
 * figure is a link to its SVG, which opens on its own in the same tab (AC3). This script makes each
 * `figure[data-diagram]` a button instead (the same picture, moved, so nothing downloads again) that opens one shared
 * `<dialog>` (DiagramViewer.astro): the diagram on the theme's diagram background, filling the screen, in the variant
 * the page already shows (`currentSrc`). It zooms from 100% to 400% (MAX_SCALE) by pinch, the wheel, the + and − buttons and keys, and
 * 0 resets; it pans by dragging. Escape, the close button or a tap beside the diagram closes it, and focus returns
 * to the diagram that opened it (AC2). The modal dialog keeps focus inside while open.
 * Zooming is @panzoom/panzoom's, loaded only on pages with figures (DiagramViewer.astro). Readers who ask for less
 * motion get no animated zoom. While the view is open the page's own keys (T-02.04) should ignore keys: the
 * dialog is `dialog.diagram-viewer[open]`.
 */
import Panzoom, { type PanzoomObject } from "@panzoom/panzoom";

/** The largest zoom: 400% (REQ-DIAG-003.AC1). */
export const MAX_SCALE = 4;

/**
 * Zoom steps. A pinch adds `spread × step / 80` to the scale, so step 1 reaches 400% within a 240 px spread, which a
 * phone's width allows; a button or key press multiplies the scale by e^step, so 0.5 (×1.65) for those.
 */
const PINCH_STEP = 1;
const BUTTON_STEP = 0.5;
/** A wheel event multiplies the scale by e^(step/3) whatever its size: panzoom's own 0.3 (×1.1), so trackpads glide. */
const WHEEL_STEP = 0.3;

/** What a key does in the open view, if anything: zoom in, zoom out or back to 100%. Escape is the dialog's own. */
export type KeyAction = "in" | "out" | "reset";

/** The view's keys: + (or =, the same key unshifted) zooms in, - (or _) out, 0 resets. */
export function keyAction(event: Pick<KeyboardEvent, "key" | "ctrlKey" | "metaKey" | "altKey">): KeyAction | undefined {
  // With a modifier it's the browser's own shortcut (page zoom and the like), not ours.
  if (event.ctrlKey || event.metaKey || event.altKey) return undefined;
  switch (event.key) {
    case "+":
    case "=":
      return "in";
    case "-":
    case "_":
      return "out";
    case "0":
      return "reset";
    default:
      return undefined;
  }
}

/**
 * Makes every figure in `doc` open the view in `dialog[data-diagram-viewer]` (DiagramViewer.astro). Returns a
 * function that undoes it, or undefined when the page has no figures or no viewer.
 */
export function bindDiagramViewer(doc: Document = document): (() => void) | undefined {
  const dialog = doc.querySelector<HTMLDialogElement>("dialog[data-diagram-viewer]");
  const figures = [...doc.querySelectorAll<HTMLElement>("figure[data-diagram]")].filter((f) =>
    f.querySelector("a.diagram-link img"),
  );
  if (!dialog || !figures.length) return undefined;
  const viewer = bindViewer(dialog, doc);
  const undo = figures.map((figure) => {
    const link = figure.querySelector<HTMLAnchorElement>("a.diagram-link")!;
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "diagram-link diagram-open";
    button.setAttribute("aria-haspopup", "dialog");
    button.append(...link.childNodes);
    link.replaceWith(button);
    const open = () => viewer.open(button);
    button.addEventListener("click", open);
    return () => {
      button.removeEventListener("click", open);
      link.append(...button.childNodes);
      button.replaceWith(link);
    };
  });
  return () => {
    undo.forEach((u) => u());
    viewer.unbind();
  };
}

/** The one dialog every figure on the page opens. */
function bindViewer(dialog: HTMLDialogElement, doc: Document): { open(from: HTMLButtonElement): void; unbind(): void } {
  const stage = dialog.querySelector<HTMLElement>(".diagram-viewer-stage")!;
  const image = dialog.querySelector<HTMLImageElement>(".diagram-viewer-image")!;
  const view = doc.defaultView!;
  const calm = () => view.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let panzoom: PanzoomObject | undefined;
  let opener: HTMLButtonElement | undefined;
  let downOnStage = false;

  const zoom = (action: KeyAction) => {
    if (!panzoom) return;
    const animate = !calm();
    if (action === "in") panzoom.zoomIn({ animate, step: BUTTON_STEP });
    else if (action === "out") panzoom.zoomOut({ animate, step: BUTTON_STEP });
    else panzoom.reset({ animate });
  };
  const onKey = (event: KeyboardEvent) => {
    const action = keyAction(event);
    if (!action) return;
    event.preventDefault();
    zoom(action);
  };
  const onClick = (event: MouseEvent) => {
    const target = event.target as Element;
    const button = target.closest<HTMLButtonElement>("button[data-zoom], button[data-close]");
    if (button?.dataset.zoom) zoom(button.dataset.zoom as KeyAction);
    else if (button) dialog.close();
    // A tap beside the diagram closes the view; a drag that only ends there doesn't.
    else if (target === stage && downOnStage) dialog.close();
  };
  const onDown = (event: PointerEvent) => void (downOnStage = event.target === stage);
  const onWheel = (event: WheelEvent) => panzoom?.zoomWithWheel(event, { step: WHEEL_STEP });
  const onClose = () => {
    panzoom?.destroy();
    panzoom = undefined;
    image.removeAttribute("src");
    opener?.focus();
    opener = undefined;
  };

  dialog.addEventListener("keydown", onKey);
  dialog.addEventListener("click", onClick);
  dialog.addEventListener("close", onClose);
  stage.addEventListener("pointerdown", onDown);
  stage.addEventListener("wheel", onWheel, { passive: false });

  return {
    open(from) {
      const shown = from.querySelector("img")!;
      opener = from;
      image.src = shown.currentSrc || shown.src;
      image.alt = shown.alt;
      const width = Number(shown.getAttribute("width")) || shown.naturalWidth;
      const height = Number(shown.getAttribute("height")) || shown.naturalHeight;
      image.style.setProperty("--ratio", width && height ? String(width / height) : "1");
      dialog.setAttribute("aria-label", shown.alt ? `Diagram: ${shown.alt}` : "Diagram");
      dialog.showModal();
      panzoom = Panzoom(image, { minScale: 1, maxScale: MAX_SCALE, step: PINCH_STEP, animate: false, cursor: "grab" });
    },
    unbind() {
      if (dialog.open) dialog.close();
      dialog.removeEventListener("keydown", onKey);
      dialog.removeEventListener("click", onClick);
      dialog.removeEventListener("close", onClose);
      stage.removeEventListener("pointerdown", onDown);
      stage.removeEventListener("wheel", onWheel);
    },
  };
}
