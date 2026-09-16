import CryptoJS from "crypto-js";

/**
 * EduNex Cryptographic & Security Service
 * Provides checksums, token verification, and input validation
 * for financial transactions, receipts, and payment parameters.
 */

/**
 * Validates UPI VPA format (e.g. name@okaxis, institution@sbi)
 */
export function validateUpiVpa(vpa) {
  if (!vpa || typeof vpa !== "string") return false;
  const regex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  return regex.test(vpa.trim());
}

/**
 * Generates a SHA-256 hexadecimal checksum for verifying invoice/transaction integrity.
 * Avoids client-side embedded secret salts; combines transaction invariant identifiers.
 */
export function generateTransactionChecksum(txnData = {}) {
  const raw = `${txnData.txnId || ""}_${txnData.invoiceNo || ""}_${txnData.amount || 0}_${txnData.date || ""}`;
  const hash = CryptoJS.SHA256(raw).toString(CryptoJS.enc.Hex).toUpperCase().slice(0, 16);
  return `EDX-SEC-${hash}`;
}

/**
 * Backward-compatible transparent pass-throughs
 * (Payment data must NOT be client-side encrypted with hardcoded keys).
 */
export function encryptPaymentPayload(plainText) {
  return String(plainText || "");
}

export function decryptPaymentPayload(cipherText) {
  return String(cipherText || "");
}
