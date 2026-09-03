/**
 * Navigation Event Bus
 * Dispatches active route changes so floating/expandable UI (like Header quick drawers)
 * can automatically collapse and hide when the user switches tabs or screens.
 */

const routeListeners = new Set();

export function emitRouteChange(routeName) {
  routeListeners.forEach((callback) => {
    try {
      callback(routeName);
    } catch {
      // Safe fallback
    }
  });
}

export function onRouteChange(callback) {
  if (typeof callback !== "function") return () => {};
  routeListeners.add(callback);
  return () => {
    routeListeners.delete(callback);
  };
}
