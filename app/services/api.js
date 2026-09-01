import { secureGet, secureSet, secureRemove, secureClearEduNex } from "./secureStorage";

export const BASE_URL = "https://edunex-backend-rmvx.onrender.com/api/v1";
const TIMEOUT_MS = 12000;

// High-speed In-Memory Cache & In-Flight Request Deduplication
let inMemoryToken = null;
let inMemoryApiKey = null;
let isTokenLoaded = false;
const responseCache = new Map(); // key -> { data, timestamp, ttl }
const inFlightRequests = new Map(); // key -> Promise

const DEFAULT_CACHE_TTL_MS = 4000; // 4 seconds fast TTL for live data
const STATIC_CACHE_TTL_MS = 15000; // 15 seconds for catalogs (subjects, rosters, departments)

// Listeners for unauthorized (401) logout events
const authListeners = new Set();

export function onUnauthorized(callback) {
  authListeners.add(callback);
  return () => authListeners.delete(callback);
}

function notifyUnauthorized() {
  authListeners.forEach((cb) => {
    try {
      cb();
    } catch (e) {
      console.warn("Error in auth listener:", e);
    }
  });
}

/**
 * Get the stored auth token with 0ms in-memory cache
 */
export async function getAuthToken() {
  if (isTokenLoaded && inMemoryToken !== undefined) {
    return inMemoryToken;
  }
  try {
    inMemoryToken = await secureGet("authToken");
    isTokenLoaded = true;
    return inMemoryToken;
  } catch (err) {
    console.warn("getAuthToken error:", err);
    return null;
  }
}

/**
 * Set the authentication session
 */
export async function setAuthSession(token, user) {
  try {
    inMemoryToken = token || null;
    isTokenLoaded = true;
    responseCache.clear();

    if (token) {
      await secureSet("authToken", token);
    }
    if (user) {
      await secureSet("userData", user);
      const rawRole = (user?.role || user?.data?.role || user?.user?.role || "student").toString();
      const role = rawRole.toLowerCase();
      const mappedRole =
        role === "stud" ? "student" : ["admin", "staff", "parent", "student"].includes(role) ? role : "student";
      await secureSet("userRole", mappedRole);
      await secureSet("loggedInUser", user?.username || user?.name || "");
    }
    return true;
  } catch (err) {
    console.warn("setAuthSession error:", err);
    return false;
  }
}

/**
 * Clear the authentication session
 */
export async function clearAuthSession() {
  try {
    inMemoryToken = null;
    inMemoryApiKey = null;
    isTokenLoaded = false;
    responseCache.clear();
    inFlightRequests.clear();

    await secureRemove("authToken");
    await secureRemove("userData");
    await secureRemove("userRole");
    await secureRemove("loggedInUser");
    await secureClearEduNex();
    notifyUnauthorized();
  } catch (err) {
    console.warn("clearAuthSession error:", err);
  }
}

/**
 * Invalidate cache for a specific resource path or everything
 */
export function invalidateCache(resourcePrefix) {
  if (!resourcePrefix) {
    responseCache.clear();
    return;
  }
  const prefix = String(resourcePrefix).toLowerCase();
  for (const key of responseCache.keys()) {
    if (key.toLowerCase().includes(prefix)) {
      responseCache.delete(key);
    }
  }
}

/**
 * Core HTTP request handler with Turbo Cache & Deduplication
 */
async function request(endpoint, options = {}) {
  const { method = "GET", body, params, headers: customHeaders = {}, noCache = false, ttl } = options;

  // Build query string
  let url = endpoint.startsWith("http") ? endpoint : `${BASE_URL}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
  if (params && Object.keys(params).length > 0) {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== "") {
        queryParams.append(key, String(val));
      }
    });
    const qs = queryParams.toString();
    if (qs) {
      url += (url.includes("?") ? "&" : "?") + qs;
    }
  }

  const cacheKey = `${method}:${url}`;

  // Check fast in-memory SWR cache for GET requests
  if (method === "GET" && !noCache) {
    const cached = responseCache.get(cacheKey);
    const now = Date.now();
    const activeTtl =
      ttl ||
      (endpoint.includes("department") || endpoint.includes("subject") || endpoint.includes("institution")
        ? STATIC_CACHE_TTL_MS
        : DEFAULT_CACHE_TTL_MS);

    if (cached && now - cached.timestamp < activeTtl) {
      return cached.data; // Return in 0ms!
    }
  }

  // Deduplicate in-flight GET requests
  if (method === "GET" && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const fetchPromise = (async () => {
    // Build headers
    const token = await getAuthToken();
    if (!inMemoryApiKey) {
      inMemoryApiKey = (await secureGet("xApiKey")) || null;
    }

    const headers = {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...customHeaders,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    if (inMemoryApiKey) {
      headers["x-api-key"] = inMemoryApiKey;
    }

    // Setup abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    const fetchOptions = {
      method,
      headers,
      signal: controller.signal,
    };

    if (body && (method === "POST" || method === "PUT" || method === "PATCH" || method === "DELETE")) {
      fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
    }

    try {
      const response = await fetch(url, fetchOptions);
      clearTimeout(timeoutId);

      let json;
      try {
        json = await response.json();
      } catch {
        json = { success: response.ok, status: response.status };
      }

      // Handle 401 Unauthorized for token-protected endpoints (exclude login/register)
      const isAuthEndpoint =
        endpoint.includes("/auth/login") || endpoint.includes("/auth/register");

      if (response.status === 401 && !isAuthEndpoint) {
        await clearAuthSession();
        const errorMsg =
          json?.error || json?.message || "Session expired. Please log in again.";
        const err = new Error(errorMsg);
        err.status = 401;
        err.data = json;
        throw err;
      }

      if (!response.ok || (json && json.success === false)) {
        const errorMsg =
          json?.error || json?.message || `Request failed with status ${response.status}`;
        const err = new Error(errorMsg);
        err.status = response.status;
        err.data = json;
        throw err;
      }

      // Cache successful GET responses
      if (method === "GET") {
        responseCache.set(cacheKey, { data: json, timestamp: Date.now() });
      } else {
        // Automatically invalidate cache for modified resource
        const resourceName = endpoint.replace(/^\//, "").split("/")[0];
        if (resourceName) {
          invalidateCache(resourceName);
        }
      }

      return json;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        const timeoutErr = new Error("Request timed out. Please check your connection.");
        timeoutErr.isTimeout = true;
        throw timeoutErr;
      }
      throw error;
    } finally {
      inFlightRequests.delete(cacheKey);
    }
  })();

  if (method === "GET") {
    inFlightRequests.set(cacheKey, fetchPromise);
  }

  return fetchPromise;
}

export const api = {
  get: (path, params, headers, options = {}) =>
    request(path, { method: "GET", params, headers, ...options }),
  post: (path, body, headers, options = {}) =>
    request(path, { method: "POST", body, headers, ...options }),
  put: (path, body, headers, options = {}) =>
    request(path, { method: "PUT", body, headers, ...options }),
  patch: (path, body, headers, options = {}) =>
    request(path, { method: "PATCH", body, headers, ...options }),
  del: (path, params, headers, options = {}) =>
    request(path, { method: "DELETE", params, headers, ...options }),
  delete: (path, body, headers, options = {}) =>
    request(path, { method: "DELETE", body, headers, ...options }),
  invalidateCache,
  clearCache: () => responseCache.clear(),
};

export default api;
