import { Request } from 'express';

export interface GeoLocationResult {
  country_code: string | null;
  currency_code: string | null;
  country_name: string | null;
  city?: string;
  ip: string;
  is_detected: boolean;
}

const COUNTRY_TO_CURRENCY: Record<string, { currency: string; name: string }> = {
  RW: { currency: 'RWF', name: 'Rwanda' },
  KE: { currency: 'KES', name: 'Kenya' },
  TZ: { currency: 'TZS', name: 'Tanzania' },
  UG: { currency: 'UGX', name: 'Uganda' },
  CD: { currency: 'USD', name: 'DR Congo' },
  BI: { currency: 'BIF', name: 'Burundi' },
  SS: { currency: 'USD', name: 'South Sudan' },
  NG: { currency: 'NGN', name: 'Nigeria' },
  GH: { currency: 'GHS', name: 'Ghana' },
  ZA: { currency: 'ZAR', name: 'South Africa' },
  US: { currency: 'USD', name: 'United States' },
  GB: { currency: 'GBP', name: 'United Kingdom' },
  CA: { currency: 'CAD', name: 'Canada' },
  FR: { currency: 'EUR', name: 'France' },
  DE: { currency: 'EUR', name: 'Germany' },
  BE: { currency: 'EUR', name: 'Belgium' },
  NL: { currency: 'EUR', name: 'Netherlands' },
  IN: { currency: 'INR', name: 'India' },
  AE: { currency: 'AED', name: 'United Arab Emirates' },
  CN: { currency: 'CNY', name: 'China' },
  JP: { currency: 'JPY', name: 'Japan' },
  AU: { currency: 'AUD', name: 'Australia' }
};

function cleanIp(ip: string): string {
  let cleaned = ip.trim();
  if (cleaned.startsWith('::ffff:')) {
    cleaned = cleaned.substring(7);
  }
  return cleaned;
}

function isPrivateOrLocalIp(ip: string): boolean {
  if (!ip) return true;
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  if (ip.startsWith('10.') || ip.startsWith('192.168.')) return true;
  if (/^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip)) return true;
  if (ip.startsWith('fc00:') || ip.startsWith('fe80:')) return true;
  return false;
}

/**
 * Extract public client IP from Express request
 */
export function extractClientIp(req: Request): string {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    const firstIp = forwardedFor.split(',')[0].trim();
    if (firstIp) return cleanIp(firstIp);
  } else if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    const firstIp = forwardedFor[0].split(',')[0].trim();
    if (firstIp) return cleanIp(firstIp);
  }

  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return cleanIp(realIp.trim());
  }

  const cfIp = req.headers['cf-connecting-ip'];
  if (typeof cfIp === 'string' && cfIp.trim()) {
    return cleanIp(cfIp.trim());
  }

  const clientIp = req.headers['x-client-ip'];
  if (typeof clientIp === 'string' && clientIp.trim()) {
    return cleanIp(clientIp.trim());
  }

  const socketIp = req.socket?.remoteAddress;
  if (socketIp) {
    return cleanIp(socketIp);
  }

  return '127.0.0.1';
}

/**
 * Detect Country and Currency from Request IP or proxy headers without fabricating location on local/unknown IPs
 */
export async function detectCountryFromRequest(req: Request): Promise<GeoLocationResult> {
  const customCountryHeader =
    (req.headers['x-client-country'] as string) ||
    (req.headers['cf-ipcountry'] as string);

  if (customCountryHeader && typeof customCountryHeader === 'string') {
    const cleanCode = customCountryHeader.trim().toUpperCase();
    if (COUNTRY_TO_CURRENCY[cleanCode]) {
      return {
        country_code: cleanCode,
        currency_code: COUNTRY_TO_CURRENCY[cleanCode].currency,
        country_name: COUNTRY_TO_CURRENCY[cleanCode].name,
        ip: extractClientIp(req),
        is_detected: true
      };
    }
  }

  const ip = extractClientIp(req);
  if (isPrivateOrLocalIp(ip)) {
    return {
      country_code: null,
      currency_code: null,
      country_name: null,
      ip,
      is_detected: false
    };
  }

  return detectCountryFromIp(ip);
}

export function getCurrencyForCountryCode(countryCode?: string): string | null {
  if (!countryCode) return null;
  const clean = countryCode.trim().toUpperCase();
  return COUNTRY_TO_CURRENCY[clean]?.currency || null;
}

export function getCountryDefaults(countryCode?: string): {
  country_code: string;
  currency_code: string;
  country_name: string;
} | null {
  if (!countryCode) return null;
  const clean = countryCode.trim().toUpperCase();
  const found = COUNTRY_TO_CURRENCY[clean];
  if (found) {
    return { country_code: clean, currency_code: found.currency, country_name: found.name };
  }
  return { country_code: clean, currency_code: 'USD', country_name: clean };
}

/**
 * Direct IP resolution function using live IP geolocation lookups
 */
export async function detectCountryFromIp(ip: string): Promise<GeoLocationResult> {
  if (isPrivateOrLocalIp(ip)) {
    return {
      country_code: null,
      currency_code: null,
      country_name: null,
      ip,
      is_detected: false
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.country_code && !data.error) {
        const countryCode = String(data.country_code).toUpperCase();
        const mapping = COUNTRY_TO_CURRENCY[countryCode];
        return {
          country_code: countryCode,
          currency_code: mapping?.currency || data.currency || null,
          country_name: mapping?.name || data.country_name || countryCode,
          city: data.city,
          ip,
          is_detected: true
        };
      }
    }
  } catch {
    // Fall through to secondary lookup
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,countryCode,currency,city`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && data.countryCode) {
        const countryCode = String(data.countryCode).toUpperCase();
        const mapping = COUNTRY_TO_CURRENCY[countryCode];
        return {
          country_code: countryCode,
          currency_code: mapping?.currency || data.currency || null,
          country_name: mapping?.name || data.country || countryCode,
          city: data.city,
          ip,
          is_detected: true
        };
      }
    }
  } catch {
    // Unreachable
  }

  return {
    country_code: null,
    currency_code: null,
    country_name: null,
    ip,
    is_detected: false
  };
}
