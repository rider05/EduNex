import { secureGet, secureSet } from "./secureStorage";
import { showToast } from "../utils/toastService";

/**
 * ==============================================================================
 * 🔄 EDUNEX HARDENED OFFLINE MUTATION ENGINE & BACKGROUND CLOUD SYNC MANAGER
 * ==============================================================================
 * Security Features:
 *  - Persistent queue encrypted at rest via hardware-backed AES-256 storage engine.
 *  - Authorization header freshness check before replaying queued mutations.
 *  - Immediate drop of queue items if token is expired, revoked, or if identity
 *    switched, preventing stale/unauthorized mutations from being applied.
 *  - Network connectivity heartbeat probe.
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
    const currentUsername = (await secureGet("loggedInUser")) || "guest";
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
      ownerUser: currentUsername,
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
  } catch {
    setNetworkStatus(false);
    return false;
  }
}

/**
 * Process and replay all queued mutations against the backend with identity/token verification
 */
export async function processOfflineQueue(apiClient) {
  if (isSyncing) return;
  const queue = await getOfflineQueue();
  if (queue.length === 0) return;

  isSyncing = true;
  notifySyncListeners({ isOnline, isSyncing: true, pendingCount: queue.length });

  // 1. Check current logged-in identity and token freshness
  const currentToken = await secureGet("authToken");
  const currentUser = (await secureGet("loggedInUser")) || "guest";

  const remainingQueue = [];
  let successCount = 0;
  let droppedCount = 0;

  for (const item of queue) {
    // Drop mutations if owner identity has changed
    if (item.ownerUser && item.ownerUser !== currentUser) {
      console.warn(`[OfflineSync] Dropping queued mutation [${item.id}]: user changed from ${item.ownerUser} to ${currentUser}`);
      droppedCount++;
      continue;
    }

    // If mutation is token-protected but no token exists, drop to prevent unauthorized replay
    const isPublicEndpoint = item.endpoint.includes("/auth/login") || item.endpoint.includes("/auth/register");
    if (!isPublicEndpoint && !currentToken) {
      console.warn(`[OfflineSync] Dropping queued mutation [${item.id}]: no active auth token found`);
      droppedCount++;
      continue;
    }

    try {
      if (apiClient && typeof apiClient.requestDirect === "function") {
        const response = await apiClient.requestDirect(item.endpoint, {
          method: item.method,
          body: item.body,
          params: item.params,
          headers: item.headers,
        });

        // If 401 Unauthorized, drop the mutation immediately
        if (response?.status === 401) {
          console.warn(`[OfflineSync] Token expired during replay of [${item.id}]. Dropping queue.`);
          droppedCount++;
          continue;
        }
      } else {
        const { BASE_URL } = require("./api");
        const url = item.endpoint.startsWith("http")
          ? item.endpoint
          : `${BASE_URL}${item.endpoint.startsWith("/") ? "" : "/"}${item.endpoint}`;

        const headers = {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(item.headers || {}),
        };
        if (currentToken) {
          headers["Authorization"] = `Bearer ${currentToken}`;
        }

        const res = await fetch(url, {
          method: item.method,
          headers,
          body: item.body ? (typeof item.body === "string" ? item.body : JSON.stringify(item.body)) : undefined,
        });

        // If 401 Unauthorized, drop immediately (stale identity/token)
        if (res.status === 401) {
          console.warn(`[OfflineSync] 401 Unauthorized received for [${item.id}]. Dropping item.`);
          droppedCount++;
          continue;
        }

        if (!res.ok && res.status >= 500) {
          throw new Error(`Server error ${res.status}`);
        }
      }

      successCount++;
    } catch (err) {
      console.warn(`Failed to replay mutation [${item.id}]:`, err?.message || err);
      item.retryCount = (item.retryCount || 0) + 1;
      // Drop after 3 retries to prevent clogging
      if (item.retryCount < 3) {
        remainingQueue.push(item);
      } else {
        droppedCount++;
      }
    }
  }

  await saveOfflineQueue(remainingQueue);
  isSyncing = false;
  notifySyncListeners({ isOnline, isSyncing: false, pendingCount: remainingQueue.length });

  if (successCount > 0) {
    showToast(`☁️ Synced ${successCount} offline change${successCount > 1 ? "s" : ""} with cloud!`, "success");
  } else if (droppedCount > 0 && remainingQueue.length === 0) {
    showToast("⚠️ Discarded expired offline actions due to session timeout.", "warning");
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
