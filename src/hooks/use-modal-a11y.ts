"use client";

import { useEffect, useRef } from "react";

/** Things a keyboard can land on, minus anything explicitly removed from the order. */
const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

/**
 * Focus behaviour for a modal dialog: move focus in on open, keep Tab inside
 * while it's up, close on Escape, and put focus back where it came from.
 *
 * Both modals were missing all four. Opening the play-by-play left focus on
 * the trigger behind the overlay, tabbing walked straight out into the page
 * underneath — ten of twelve presses landed outside — and Escape did nothing,
 * so a keyboard user had no way back out.
 *
 * Attach the returned ref to the dialog element, and give it `tabIndex={-1}`
 * so it can hold focus itself when it contains nothing focusable.
 */
export function useModalA11y<T extends HTMLElement>(onClose: () => void) {
  const ref = useRef<T>(null);

  // Held in a ref so the effect below can run once. Callers pass an inline
  // arrow, which would otherwise change identity every render and re-run the
  // effect — stealing focus back to the top of the dialog on each keystroke.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const node = ref.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    const focusable = () =>
      node
        ? Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
            (el) => el.offsetParent !== null || el === document.activeElement
          )
        : [];

    (focusable()[0] ?? node)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;

      const items = focusable();
      if (items.length === 0) {
        e.preventDefault();
        node.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;

      if (!node.contains(active)) {
        // Focus is already outside — the dialog is portalled to the end of the
        // body, so the browser's natural order can walk into the page behind.
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && (active === first || active === node)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    // Capture phase: the dialog's own handlers shouldn't be able to swallow
    // Escape or Tab before the trap sees them.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, []);

  return ref;
}
