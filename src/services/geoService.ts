import { Request } from 'express';

export interface GeoLocationResult {
  country_code: string;
  currency_code: string;
  country_name: string;
  city?: string;
  ip: string;
  is_detected: boolean;
}

// Default fallback (Rwanda / RWF)
const DEFAULT_GEO: GeoLocationResult = {
  country_code: 'RW',
  currency_code: 'RWF',
  country_name: 'Rwanda',
  ip: '127.0.0.1',
  is_detected: false
};

// Known ISO country to currency mapping
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

/**
 * Extract public client IP from Express request
 */
export function extractClientIp(req: Request): string {
  // Check headers commonly provided by reverse proxies (Cloud Run, Nginx, Cloudflare)
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
 * Detect Country and Currency from Request IP
 */
export async function detectCountryFromRequest(req: Request): Promise<GeoLocationResult> {
  // 1. Check if client explicitly sent custom country header
  const customCountryHeader = req.headers['x-client-country'] as string;
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

  // If local / private IP, return default Rwanda (RWF)
  if (isPrivateOrLocalIp(ip)) {
    return {
      ...DEFAULT_GEO,
      ip
    };
  }

  // 2. Query free IP Geolocation API (ip-api.com) with timeout
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,currency,city`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.status === 'success' && data.countryCode) {
        const countryCode = String(data.countryCode).toUpperCase();
        const mapping = COUNTRY_TO_CURRENCY[countryCode];
        const currencyCode = mapping?.currency || data.currency || (countryCode === 'RW' ? 'RWF' : 'USD');
        const countryName = mapping?.name || data.country || countryCode;

        console.log(`[GEO-IP] Successfully resolved ${ip} -> ${countryName} (${countryCode}, ${currencyCode})`);

        return {
          country_code: countryCode,
          currency_code: currencyCode,
          country_name: countryName,
          city: data.city,
          ip,
          is_detected: true
        };
      }
    }
  } catch (err: any) {
    console.warn(`[GEO-IP] Primary lookup for ${ip} failed:`, err?.message || err);
  }

  // 3. Fallback to ipapi.co
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.country_code) {
        const countryCode = String(data.country_code).toUpperCase();
        const mapping = COUNTRY_TO_CURRENCY[countryCode];
        const currencyCode = mapping?.currency || data.currency || (countryCode === 'RW' ? 'RWF' : 'USD');
        const countryName = mapping?.name || data.country_name || countryCode;

        return {
          country_code: countryCode,
          currency_code: currencyCode,
          country_name: countryName,
          city: data.city,
          ip,
          is_detected: true
        };
      }
    }
  } catch (err: any) {
    console.warn(`[GEO-IP] Secondary lookup for ${ip} failed:`, err?.message || err);
  }

  // Fallback to Rwanda (RWF)
  return {
    ...DEFAULT_GEO,
    ip
  };
}

/**
 * Currency resolver for given country code
 */
export function getCurrencyForCountryCode(countryCode?: string): string {
  if (!countryCode) return 'RWF';
  const clean = countryCode.trim().toUpperCase();
  return COUNTRY_TO_CURRENCY[clean]?.currency || 'RWF';
}

/**
 * Country name and currency resolver
 */
export function getCountryDefaults(countryCode?: string): { country_code: string; currency_code: string; country_name: string } {
  if (!countryCode) return { country_code: 'RW', currency_code: 'RWF', country_name: 'Rwanda' };
  const clean = countryCode.trim().toUpperCase();
  const found = COUNTRY_TO_CURRENCY[clean];
  if (found) {
    return { country_code: clean, currency_code: found.currency, country_name: found.name };
  }
  return { country_code: clean, currency_code: 'USD', country_name: clean };
}

/**
 * Direct IP resolution function
 */
export async function detectCountryFromIp(ip: string): Promise<GeoLocationResult> {
  if (isPrivateOrLocalIp(ip)) {
    return {
      ...DEFAULT_GEO,
      ip
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(`http://ip-api.com/json/${ip}?fields=status,message,country,countryCode,currency,city`, {
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
          currency_code: mapping?.currency || data.currency || (countryCode === 'RW' ? 'RWF' : 'USD'),
          country_name: mapping?.name || data.country || countryCode,
          city: data.city,
          ip,
          is_detected: true
        };
      }
    }
  } catch {
    // Ignore and fallback
  }

  return {
    ...DEFAULT_GEO,
    ip
  };
}

