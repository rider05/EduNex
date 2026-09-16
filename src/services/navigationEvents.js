/**
 * Navigation Event Bus
 * Dispatches active route changes and programmatic tab switching across the app.
 */

const routeListeners = new Set();
const tabListeners = new Set();

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

export function emitTabNavigation(tabName) {
  tabListeners.forEach((callback) => {
    try {
      callback(tabName);
    } catch {
      // Safe fallback
    }
  });
}

export function onTabNavigation(callback) {
  if (typeof callback !== "function") return () => {};
  tabListeners.add(callback);
  return () => {
    tabListeners.delete(callback);
  };
}
