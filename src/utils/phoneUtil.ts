import * as libphone from 'libphonenumber-js';
import * as core from 'libphonenumber-js/core';
import rawMetadata from 'libphonenumber-js/metadata.min.json';

// Ensure metadata is unwrapped from any { default } module wrapper
const metadata: any = (rawMetadata as any)?.default || rawMetadata;

export type PhoneResult = {
  valid: boolean;
  e164?: string;
  countryCode?: string;
  dialCode?: string;
  error?: string;
};

/**
 * Safely parse a phone number. Handles ESM/CJS interop issues and unwraps metadata.
 */
export function parsePhone(phone: string): PhoneResult {
  if (!phone || typeof phone !== 'string') {
    return { valid: false, error: 'Phone number is required' };
  }

  const trimmed = phone.trim();

  // Must start with + for country code
  if (!trimmed.startsWith('+')) {
    return { valid: false, error: 'Phone number must start with + and country code (e.g., +250...)' };
  }

  try {
    let parsed: any = null;

    // 1. Try standard libphonenumber-js export
    try {
      const fn =
        (libphone as any).parsePhoneNumberFromString ||
        (libphone as any).default?.parsePhoneNumberFromString;
      if (typeof fn === 'function') {
        parsed = fn(trimmed);
      }
    } catch (importErr: any) {
      if (importErr?.message && !importErr.message.includes('metadata')) {
        return { valid: false, error: 'Phone validation error: ' + importErr.message };
      }
    }

    // 2. If standard export failed or hit metadata shape issue, use core with unwrapped metadata
    if (!parsed) {
      try {
        const coreFn =
          (core as any).parsePhoneNumberFromString ||
          (core as any).default?.parsePhoneNumberFromString ||
          (core as any).parsePhoneNumber;
        if (typeof coreFn === 'function') {
          parsed = coreFn(trimmed, metadata);
        }
      } catch (coreErr: any) {
        // Fallback: try node dynamic require if available
        try {
          const fallbackCore = require('libphonenumber-js/core');
          const fn2 = fallbackCore.parsePhoneNumberFromString || fallbackCore.default?.parsePhoneNumberFromString;
          if (typeof fn2 === 'function') {
            parsed = fn2(trimmed, metadata);
          }
        } catch {
          // ignore
        }
      }
    }

    if (!parsed || !parsed.isValid || !parsed.isValid()) {
      return { valid: false, error: 'Invalid phone number for this country' };
    }

    return {
      valid: true,
      e164: parsed.number,
      countryCode: parsed.country,
      dialCode: '+' + parsed.countryCallingCode,
    };
  } catch (err: any) {
    return { valid: false, error: 'Phone validation error: ' + err.message };
  }
}

/**
 * Safe parsePhoneNumber helper for compatibility with callers expecting a PhoneNumber object
 */
export function parsePhoneNumber(text: string, defaultCountry?: any): any {
  try {
    const fn = (libphone as any).parsePhoneNumber || (libphone as any).default?.parsePhoneNumber;
    if (typeof fn === 'function') {
      return fn(text, defaultCountry);
    }
  } catch (err: any) {
    // If metadata error, fallback to core with unwrapped metadata
  }
  const coreFn = (core as any).parsePhoneNumber || (core as any).default?.parsePhoneNumber;
  return coreFn(text, defaultCountry || metadata, metadata);
}

/**
 * Safe isValidPhoneNumber helper for callers checking validity
 */
export function isValidPhoneNumber(text: string, defaultCountry?: any): boolean {
  try {
    const fn = (libphone as any).isValidPhoneNumber || (libphone as any).default?.isValidPhoneNumber;
    if (typeof fn === 'function') {
      return fn(text, defaultCountry);
    }
  } catch (err: any) {
    // Fallback to core
  }
  const coreFn = (core as any).isValidPhoneNumber || (core as any).default?.isValidPhoneNumber;
  return coreFn(text, defaultCountry || metadata, metadata);
}

/**
 * Safe parsePhoneNumberFromString helper
 */
export function parsePhoneNumberFromString(text: string, defaultCountry?: any): any {
  try {
    const fn = (libphone as any).parsePhoneNumberFromString || (libphone as any).default?.parsePhoneNumberFromString;
    if (typeof fn === 'function') {
      return fn(text, defaultCountry);
    }
  } catch (err: any) {
    // Fallback to core
  }
  const coreFn = (core as any).parsePhoneNumberFromString || (core as any).default?.parsePhoneNumberFromString;
  return coreFn(text, defaultCountry || metadata, metadata);
}

export default parsePhone;
