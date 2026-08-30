import { useEffect, useRef } from "react";
import { AppState } from "react-native";

// Global tracker for background timestamps across the app
let globalLastBackgroundTime = 0;

AppState.addEventListener("change", (nextState) => {
  if (nextState !== "active") {
    globalLastBackgroundTime = Date.now();
  }
});

/**
 * Re-runs the given loader ONLY when the app returns from a meaningful background session
 * (e.g. at least 30s in background), preventing accidental / jarring re-fetches when
 * opening/closing native pickers, camera, permission dialogues, share sheets, or quick alt-tabs.
 *
 * @param {Function} onRefresh - Callback to run on resume
 * @param {number} [minBackgroundDurationMs=30000] - Minimum background time required to trigger refresh (default 30s)
 * @param {number} [cooldownMs=30000] - Minimum interval between consecutive foreground refreshes (default 30s)
 */
export default function useRefreshOnForeground(onRefresh, minBackgroundDurationMs = 30000, cooldownMs = 30000) {
  const handlerRef = useRef(onRefresh);
  handlerRef.current = onRefresh;

  const lastRefreshTimeRef = useRef(Date.now());

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      if (nextState === "active") {
        const now = Date.now();
        const backgroundDuration = globalLastBackgroundTime > 0 ? now - globalLastBackgroundTime : 0;
        const timeSinceLastRefresh = now - lastRefreshTimeRef.current;

        // Only trigger if app was actually backgrounded for long enough and cooled down
        if (backgroundDuration >= minBackgroundDurationMs && timeSinceLastRefresh >= cooldownMs) {
          lastRefreshTimeRef.current = now;
          try {
            if (typeof handlerRef.current === "function") {
              handlerRef.current();
            }
          } catch (err) {
            console.warn("useRefreshOnForeground execution error:", err);
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [minBackgroundDurationMs, cooldownMs]);
}
