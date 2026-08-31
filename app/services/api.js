import { secureGet, secureSet, secureRemove, secureClearEduNex } from "./secureStorage";

export const BASE_URL = "https://edunex-backend-rmvx.onrender.com/api/v1";
const TIMEOUT_MS = 15000;

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
 * Get the stored auth token
 */
export async function getAuthToken() {
  try {
    return await secureGet("authToken");
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
 * Core HTTP request handler
 */
async function request(endpoint, options = {}) {
  const { method = "GET", body, params, headers: customHeaders = {} } = options;

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

  // Build headers
  const token = await getAuthToken();
  const apiKey = await secureGet("xApiKey");

  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
    ...customHeaders,
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (apiKey) {
    headers["x-api-key"] = apiKey;
  }

  // Setup abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  const fetchOptions = {
    method,
    headers,
    signal: controller.signal,
  };

  if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
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

    return json;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      const timeoutErr = new Error("Request timed out. Please check your internet connection.");
      timeoutErr.isTimeout = true;
      throw timeoutErr;
    }
    throw error;
  }
}

export const api = {
  get: (path, params, headers) => request(path, { method: "GET", params, headers }),
  post: (path, body, headers) => request(path, { method: "POST", body, headers }),
  put: (path, body, headers) => request(path, { method: "PUT", body, headers }),
  patch: (path, body, headers) => request(path, { method: "PATCH", body, headers }),
  del: (path, params, headers) => request(path, { method: "DELETE", params, headers }),
  delete: (path, body, headers) => request(path, { method: "DELETE", body, headers }),
};

export default api;
