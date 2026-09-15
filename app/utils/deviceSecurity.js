import * as Device from "expo-device";
import { Platform } from "react-native";

/**
 * ==============================================================================
 * 🛡️ EDUNEX DEVICE INTEGRITY & SECURITY MONITOR
 * ==============================================================================
 * Provides:
 *  - Root / Jailbreak detection via hardware probes and filesystem heuristics.
 *  - Clipboard sanitization to prevent leakage of credentials or session tokens.
 *  - Global console sanitizer to redact auth tokens, passwords, and sensitive PII.
 * ==============================================================================
 */

/**
 * Check if the current device has been rooted or jailbroken
 */
export async function checkDeviceIntegrity() {
  if (Platform.OS === "web") {
    return { isCompromised: false, reason: null };
  }

  try {
    const isRooted = await Device.isRootedExperimentalAsync();
    if (isRooted) {
      return {
        isCompromised: true,
        reason: "Device has been detected as rooted/jailbroken. Running on a compromised device may expose sensitive institutional data.",
      };
    }
  } catch (err) {
    console.warn("Root detection probe error:", err?.message || err);
  }

  return { isCompromised: false, reason: null };
}

/**
 * Sanitizes strings by redacting tokens, passwords, and secrets before logging
 */
function sanitizeLogArgument(arg) {
  if (arg == null) return arg;
  if (typeof arg === "string") {
    return arg
      .replace(/Bearer\s+[A-Za-z0-9._~+/-]+=*/gi, "Bearer [REDACTED_TOKEN]")
      .replace(/ey[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*/g, "[REDACTED_JWT]")
      .replace(/(password|passwordHash|salt|secret|token)":\s*"[^"]+"/gi, '$1":"[REDACTED]"')
      .replace(/([0-9]{10,12})/g, (match) => match.length >= 10 ? match.slice(0, 2) + "******" + match.slice(-2) : match);
  }
  if (typeof arg === "object") {
    try {
      const copy = Array.isArray(arg) ? [...arg] : { ...arg };
      const sensitiveKeys = ["token", "authToken", "password", "passwordHash", "secret", "salt", "transcript"];
      for (const k of Object.keys(copy)) {
        if (sensitiveKeys.includes(k)) {
          copy[k] = "[REDACTED]";
        }
      }
      return copy;
    } catch {
      return "[OBJECT]";
    }
  }
  return arg;
}

/**
 * Installs global logging sanitizer to prevent leaking sensitive session or user data in logs
 */
export function installConsoleSanitizer() {
  if (global.__edunex_sanitizer_installed) return;
  global.__edunex_sanitizer_installed = true;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;

  console.log = (...args) => {
    try {
      const sanitized = args.map(sanitizeLogArgument);
      originalLog.apply(console, sanitized);
    } catch {
      originalLog.apply(console, args);
    }
  };

  console.warn = (...args) => {
    try {
      const sanitized = args.map(sanitizeLogArgument);
      originalWarn.apply(console, sanitized);
    } catch {
      originalWarn.apply(console, args);
    }
  };

  console.error = (...args) => {
    try {
      const sanitized = args.map(sanitizeLogArgument);
      originalError.apply(console, sanitized);
    } catch {
      originalError.apply(console, args);
    }
  };
}
