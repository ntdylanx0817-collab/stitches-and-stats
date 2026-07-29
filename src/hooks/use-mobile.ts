import * as React from "react"

const MOBILE_BREAKPOINT = 768
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`

function subscribe(onStoreChange: () => void) {
  const mql = window.matchMedia(MOBILE_QUERY)
  mql.addEventListener("change", onStoreChange)
  return () => mql.removeEventListener("change", onStoreChange)
}

function getSnapshot() {
  return window.matchMedia(MOBILE_QUERY).matches
}

// There is no viewport on the server. Render the desktop layout and let the
// client correct it on hydration.
function getServerSnapshot() {
  return false
}

/**
 * Tracks whether the viewport is below the mobile breakpoint.
 *
 * Uses `useSyncExternalStore` rather than `useState` + `useEffect`: the
 * previous version seeded state with a synchronous `setState` inside an
 * effect, which forces a second render pass on every mount.
 */
export function useIsMobile() {
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
