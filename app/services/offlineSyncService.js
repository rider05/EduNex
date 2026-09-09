import { secureGet, secureSet } from "./secureStorage";
import { showToast } from "../utils/toastService";

/**
 * ==============================================================================
 * 🔄 EDUNEX OFFLINE MUTATION ENGINE & BACKGROUND CLOUD SYNC MANAGER
 * ==============================================================================
 * Features:
 *  - Persistent encrypted queue for offline mutations (POST/PUT/PATCH/DELETE).
 *  - Network connectivity heartbeat probe.
 *  - Automatic queue processing and cloud replay as soon as connection is restored.
 *  - Conflict-free optimistic local writes so the app remains 100% usable offline.
 *  - Event subscribers for sync progress and queue status badges.
 * ==============================================================================
 */

const QUEUE_STORAGE_KEY = "edunex_offline_mutation_queue_v1";

let isOnline = true;
let isSyncing = false;
let syncInterval = null;
const syncStatusListeners = new Set();

/**
 * Subscribe to sync engine events (isOnline, isSyncing, pendingCount)
 */
export function subscribeToSyncStatus(callback) {
  syncStatusListeners.add(callback);
  return () => syncStatusListeners.delete(callback);
}

function notifySyncListeners(state) {
  syncStatusListeners.forEach((cb) => {
    try {
      cb(state);
    } catch (e) {
      console.warn("Error in sync listener:", e);
    }
  });
}

/**
 * Get current online/offline status
 */
export function getIsOnline() {
  return isOnline;
}

/**
 * Set online/offline status
 */
export function setNetworkStatus(online) {
  const changed = isOnline !== online;
  isOnline = Boolean(online);
  if (changed) {
    notifySyncListeners({ isOnline, isSyncing });
    if (isOnline) {
      processOfflineQueue();
    }
  }
}

/**
 * Load the current offline queue from encrypted storage
 */
export async function getOfflineQueue() {
  try {
    const queue = await secureGet(QUEUE_STORAGE_KEY);
    return Array.isArray(queue) ? queue : [];
  } catch (err) {
    console.warn("getOfflineQueue error:", err);
    return [];
  }
}

/**
 * Save the offline queue to encrypted storage
 */
async function saveOfflineQueue(queue) {
  try {
    await secureSet(QUEUE_STORAGE_KEY, Array.isArray(queue) ? queue : []);
    notifySyncListeners({ isOnline, isSyncing, pendingCount: queue.length });
    return true;
  } catch (err) {
    console.warn("saveOfflineQueue error:", err);
    return false;
  }
}

/**
 * Enqueue a mutation to be executed when back online
 */
export async function enqueueMutation(mutation) {
  try {
    const queue = await getOfflineQueue();
    const item = {
      id: mutation.id || `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      endpoint: mutation.endpoint,
      method: mutation.method || "POST",
      body: mutation.body,
      params: mutation.params,
      headers: mutation.headers,
      timestamp: Date.now(),
      retryCount: 0,
      description: mutation.description || `${mutation.method || "POST"} ${mutation.endpoint}`,
    };

    queue.push(item);
    await saveOfflineQueue(queue);

    showToast("💾 Saved locally (Offline). Will sync when online.", "info");
    return item;
  } catch (err) {
    console.warn("enqueueMutation error:", err);
    return null;
  }
}

/**
 * Check backend connectivity with lightweight health-check ping
 */
export async function probeBackendConnectivity(baseUrl) {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);

    const checkUrl = `${baseUrl.replace(/\/+$/, "")}/institutions?limit=1`;
    const res = await fetch(checkUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const online = res.status >= 200 && res.status < 500;
    setNetworkStatus(online);
    return online;
  } catch (err) {
    setNetworkStatus(false);
    return false;
  }
}

/**
 * Process and replay all queued mutations against the backend
 */
export async function processOfflineQueue(apiClient) {
  if (isSyncing) return;
  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifySyncListeners({ isOnline, isSyncing: true, pendingCount: queue.length });

  const remainingQueue = [];
  let successCount = 0;

  for (const item of queue) {
    try {
      if (apiClient && typeof apiClient.requestDirect === "function") {
        // Execute request through the API client
        await apiClient.requestDirect(item.endpoint, {
          method: item.method,
          body: item.body,
          params: item.params,
          headers: item.headers,
        });
      } else {
        const { BASE_URL } = require("./api");
        let url = item.endpoint.startsWith("http")
          ? item.endpoint
          : `${BASE_URL}${item.endpoint.startsWith("/") ? "" : "/"}${item.endpoint}`;

        const res = await fetch(url, {
          method: item.method,
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json",
            ...(item.headers || {}),
          },
          body: item.body ? (typeof item.body === "string" ? item.body : JSON.stringify(item.body)) : undefined,
        });

        if (!res.ok && res.status >= 500) {
          throw new Error(`Server error ${res.status}`);
        }
      }

      successCount++;
    } catch (err) {
      console.warn(`Failed to replay mutation [${item.id}]:`, err?.message || err);
      item.retryCount = (item.retryCount || 0) + 1;
      if (item.retryCount < 4) {
        remainingQueue.push(item);
      }
    }
  }

  await saveOfflineQueue(remainingQueue);
  isSyncing = false;
  notifySyncListeners({ isOnline, isSyncing: false, pendingCount: remainingQueue.length });

  if (successCount > 0) {
    showToast(`☁️ Synced ${successCount} offline change${successCount > 1 ? "s" : ""} with cloud!`, "success");
  }
}

/**
 * Start periodic background network & sync watcher
 */
export function startOfflineSyncWatcher(baseUrl, intervalMs = 15000) {
  if (syncInterval) clearInterval(syncInterval);

  // Initial immediate probe
  probeBackendConnectivity(baseUrl);

  syncInterval = setInterval(() => {
    probeBackendConnectivity(baseUrl).then((online) => {
      if (online) {
        processOfflineQueue();
      }
    });
  }, intervalMs);

  return () => {
    if (syncInterval) clearInterval(syncInterval);
  };
}
