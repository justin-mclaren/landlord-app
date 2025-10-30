/**
 * Hash utilities for content-addressed caching
 */
import { createHash } from "crypto";

/**
 * Generate SHA-256 hash of a string
 */
export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

/**
 * Generate address hash from normalized address
 */
export function addrHash(address: string): string {
  const normalized = address.toLowerCase().trim();
  return sha256(normalized);
}

/**
 * Generate preferences hash from preferences object
 */
export function prefsHash(prefs: Record<string, unknown>): string {
  // Sort keys for deterministic hashing
  const sorted = Object.keys(prefs)
    .sort()
    .reduce((acc, key) => {
      acc[key] = prefs[key];
      return acc;
    }, {} as Record<string, unknown>);
  
  return sha256(JSON.stringify(sorted));
}

/**
 * Generate report hash from address hash, prefs hash, and decoder config version
 */
export function reportHash(
  addrHash: string,
  prefsHash: string,
  configVersion: string = "v1"
): string {
  return sha256(`${addrHash}:${prefsHash}:${configVersion}`);
}

/**
 * Generate URL hash for scraping cache keys
 */
export function urlHash(url: string): string {
  const normalized = url.toLowerCase().trim();
  return sha256(normalized);
}

