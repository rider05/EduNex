import { useEffect } from "react";
import { AppState } from "react-native";

/**
 * Re-runs the given loader whenever the app returns to the foreground
 * (e.g., user backgrounds the app and reopens it), so live backend data
 * is refetched instead of showing stale state.
 */
export default function useRefreshOnForeground(onRefresh) {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        try {
          onRefresh();
        } catch {}
      }
    });
    return () => {
      subscription.remove();
    };
  }, [onRefresh]);
}
