"use client";

import { createPortal } from "react-dom";

/**
 * Render children into `document.body`.
 *
 * Overlays have to escape the page's view-transition wrapper. An ancestor
 * with a `transform`, `perspective`, or `filter` becomes the containing block
 * for `position: fixed` descendants, so `inset-0` resolves against that
 * element's full page height rather than the viewport — which parks a
 * centred modal halfway down the document, off-screen on any page taller
 * than the window. Portalling to the body removes that whole class of bug
 * regardless of what styling the tree above happens to pick up later.
 *
 * SSR-safe: renders nothing on the server. Modals only mount in response to
 * a user interaction, so they are never part of the hydrated tree.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  if (typeof document === "undefined") return null;
  return createPortal(children, document.body);
}
