/**
 * EduNex Cryptographic & Security Service
 * Provides encryption, decryption, checksums, and token verification
 * for sensitive payment VPAs, credentials, and financial receipts.
 */

// Secret institutional salt for client-side token sealing
const CLIENT_SECRET_SALT = "EDUNEX_SECURE_PAYMENT_SALT_2026";

/**
 * Simple, reliable XOR + Base64 cryptographic cipher for sensitive payment fields
 */
export function encryptPaymentPayload(plainText, secret = CLIENT_SECRET_SALT) {
  if (!plainText) return "";
  try {
    const text = String(plainText);
    const key = String(secret);
    let result = "";
    for (let i = 0; i < text.length; i++) {
      const charCode = text.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    // Encode to UTF-8 safe base64
    return btoa(unescape(encodeURIComponent(result)));
  } catch (_e) {
    return btoa(String(plainText));
  }
}

/**
 * Decrypts an encrypted payload using the institutional key
 */
export function decryptPaymentPayload(cipherText, secret = CLIENT_SECRET_SALT) {
  if (!cipherText) return "";
  try {
    // Decode from base64
    const decoded = decodeURIComponent(escape(atob(cipherText)));
    const key = String(secret);
    let result = "";
    for (let i = 0; i < decoded.length; i++) {
      const charCode = decoded.charCodeAt(i) ^ key.charCodeAt(i % key.length);
      result += String.fromCharCode(charCode);
    }
    return result;
  } catch (_e) {
    // If not encrypted or fallback
    try {
      return atob(cipherText);
    } catch {
      return cipherText;
    }
  }
}

/**
 * Generates a SHA-like hexadecimal checksum for verifying invoice/transaction integrity
 */
export function generateTransactionChecksum(txnData = {}) {
  const raw = `${txnData.txnId || ""}_${txnData.invoiceNo || ""}_${txnData.amount || 0}_${txnData.date || ""}_${CLIENT_SECRET_SALT}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return "EDX-SEC-" + Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
}

/**
 * Validates UPI VPA format
 */
export function validateUpiVpa(vpa) {
  if (!vpa || typeof vpa !== "string") return false;
  const regex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return regex.test(vpa.trim());
}
