import { User, Session } from '@supabase/supabase-js';

// Absolute file paths are NOT used inside code.
// We maintain an in-memory database that persists to localStorage when browser is available and inside a memory variable on Node.
// To keep things synchronized across backend reboots/requests, we can write/read a file on Node, or use global state.
// Since server can have its state, we initialize from default dataset.

const DEFAULT_DB = {
  "profiles": [
    {
      "id": "master-admin-uuid-001",
      "email": "master@paytune.com",
      "full_name": "PAYTUNE Master Administrator",
      "username": "masteradmin",
      "phone": "1922331",
      "total_spent": 0,
      "avatar_url": "",
      "role": "MASTER_ADMIN",
      "created_at": "2026-01-01T00:00:00.000Z"
    },
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "email": "testartist@paytune.com",
      "full_name": "Test Artist",
      "username": "testartist",
      "phone": "0788000000",
      "total_spent": 0,
      "avatar_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
      "role": "ARTIST",
      "created_at": "2026-09-11T13:00:00.000Z"
    },
    {
      "id": "unverified-artist-001",
      "email": "unverified.artist@paytune.com",
      "full_name": "Unverified Test Artist",
      "username": "unverifiedartist",
      "phone": "+250788123456",
      "total_spent": 0,
      "avatar_url": "",
      "role": "ARTIST",
      "created_at": "2026-09-16T12:00:00.000Z"
    }
  ],
  "artists": [
    {
      "id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "user_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "full_name": "Test Artist",
      "username": "testartist",
      "email": "testartist@paytune.com",
      "phone": "+250788000000",
      "phone_verified": true,
      "phone_verification_code": null,
      "phone_verification_expires": null,
      "last_otp_sent_at": null,
      "country_code": "RW",
      "currency_code": "RWF",
      "is_approved": true,
      "is_blocked": false,
      "momo_code": "0788000000",
      "momo_provider": "MTN",
      "profile_image": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
      "banner_image": "",
      "bio": "Official test artist account for playback and sound verification.",
      "is_verified": true,
      "subscribers_count": 0,
      "created_at": "2026-09-11T13:00:00.000Z"
    },
    {
      "id": "unverified-artist-001",
      "user_id": "unverified-artist-001",
      "full_name": "Unverified Test Artist",
      "username": "unverifiedartist",
      "email": "unverified.artist@paytune.com",
      "phone": "+250788123456",
      "phone_verified": false,
      "phone_verification_code": "123456",
      "phone_verification_expires": "2026-12-31T23:59:59.000Z",
      "last_otp_sent_at": null,
      "country_code": "RW",
      "currency_code": "RWF",
      "is_approved": true,
      "is_blocked": false,
      "momo_code": "0788123456",
      "momo_provider": "MTN",
      "profile_image": "",
      "banner_image": "",
      "bio": "Test artist awaiting phone confirmation.",
      "is_verified": false,
      "subscribers_count": 0,
      "created_at": "2026-09-16T12:00:00.000Z"
    }
  ],
  "videos": [
    {
      "id": "e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c",
      "artist_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "artist_name": "Test Artist",
      "title": "Test Video – Playback & Sound Check",
      "description": "This is a test video used to verify that playback and sound work correctly on PAYTUNE. It will be removed once testing is complete.",
      "price_rwf": 0,
      "price_usd": 0,
      "is_free": true,
      "is_short": false,
      "video_url": "https://vjs.zencdn.net/v/oceans.mp4",
      "thumbnail_url": "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=800&q=80",
      "preview_url": "https://vjs.zencdn.net/v/oceans.mp4",
      "duration": 596,
      "category": "Test",
      "visibility": "public",
      "is_active": true,
      "views": 0,
      "likes": 0,
      "rating_avg": 5.0,
      "rating_count": 1,
      "uploaded_at": "2026-09-11T13:00:00.000Z",
      "upload_date": "2026-09-11T13:00:00.000Z",
      "created_at": "2026-09-11T13:00:00.000Z",
      "tags": ["Test", "Playback", "AudioCheck"]
    },
    {
      "id": "v-paid-premium-002",
      "artist_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "artist_name": "Test Artist",
      "title": "Kigali Nights – Official 4K Music Video",
      "description": "Exclusive premiere of Kigali Nights. Master quality audio and visual performance.",
      "price_rwf": 500,
      "price_usd": 0.5,
      "is_free": false,
      "is_short": false,
      "video_url": "https://media.w3.org/2010/05/sintel/trailer.mp4",
      "thumbnail_url": "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=800&q=80",
      "preview_url": "https://media.w3.org/2010/05/sintel/trailer.mp4",
      "duration": 653,
      "category": "Afrobeat",
      "visibility": "public",
      "is_active": true,
      "views": 420,
      "likes": 88,
      "rating_avg": 4.9,
      "rating_count": 32,
      "uploaded_at": "2026-09-12T10:00:00.000Z",
      "upload_date": "2026-09-12T10:00:00.000Z",
      "created_at": "2026-09-12T10:00:00.000Z",
      "tags": ["Afrobeat", "Kigali", "Exclusive"]
    },
    {
      "id": "v-short-reel-003",
      "artist_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "artist_name": "Test Artist",
      "title": "Studio Jam Session Snippet #Shorts",
      "description": "Quick behind-the-scenes loop in the Kigali studio.",
      "price_rwf": 0,
      "price_usd": 0,
      "is_free": true,
      "is_short": true,
      "video_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      "thumbnail_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
      "preview_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      "duration": 15,
      "category": "Shorts",
      "visibility": "public",
      "is_active": true,
      "views": 1520,
      "likes": 310,
      "rating_avg": 4.8,
      "rating_count": 45,
      "uploaded_at": "2026-09-13T15:00:00.000Z",
      "upload_date": "2026-09-13T15:00:00.000Z",
      "created_at": "2026-09-13T15:00:00.000Z",
      "tags": ["Shorts", "Studio", "BehindTheScenes"]
    }
  ],
  "purchases": [],
  "artist_wallets": [
    {
      "id": "wallet-test-001",
      "artist_id": "a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d",
      "balance_rwf": 0,
      "pending_clearance_rwf": 0,
      "total_withdrawn_rwf": 0,
      "currency": "RWF",
      "updated_at": "2026-09-11T13:00:00.000Z"
    }
  ],
  "platform_wallet": {
    "escrow_balance_rwf": 0,
    "revenue_balance_rwf": 0,
    "vat_collected_rwf": 0,
    "total_settled_rwf": 0,
    "currency": "RWF",
    "updated_at": "2026-01-01T00:00:00.000Z"
  },
  "withdrawals": [],
  "comments": [],
  "user_comments": [],
  "user_likes": [],
  "user_ratings": [],
  "live_streams": [],
  "live_chat": [],
  "live_chat_messages": [],
  "live_chat_blocked_users": [],
  "membership_tiers": [],
  "memberships": [],
  "membership_payments": [],
  "super_thanks": [],
  "member_benefits": [],
  "platform_settings": [
    {
      "id": "platform-config",
      "platform_name": "PAYTUNE",
      "vat_percentage": 5,
      "commission_percentage": 30,
      "min_withdrawal": 5000,
      "momo_number": "1922331",
      "trending_days": 7,
      "maintenance_mode": false,
      "welcome_template": "Welcome to PAYTUNE! Enjoy unlimited access to authentic music from creators.",
      "receipt_template": "Thank you for supporting creators. Your purchase is complete: {{video_title}}."
    }
  ],
  "playlists": [],
  "subscriptions": [],
  "playlist_videos": [],
  "watch_history": [],
  "wishlist": [],
  "payment_phones": [],
  "notifications": [],
  "notification_preferences": [],
  "gifts": [],
  "reports": [],
  "admin_logs": [],
  "ads": [
    {
      "id": "ad-mtn-momo-001",
      "title": "MTN MoMoPay – Pay Anyone, Anywhere in Rwanda",
      "description": "Experience instant zero-fee transfers and easy merchant payments across Kigali and beyond with MTN Rwanda MoMo.",
      "video_url": "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      "thumbnail_url": "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=800&q=80",
      "click_url": "https://www.mtn.co.rw",
      "duration_seconds": 15,
      "advertiser_name": "MTN Rwanda",
      "budget_rwf": 250000,
      "spent_rwf": 14500,
      "status": "active",
      "created_by": "master-admin-uuid-001",
      "created_at": "2026-09-01T10:00:00.000Z",
      "updated_at": "2026-09-17T12:00:00.000Z"
    },
    {
      "id": "ad-kigali-fest-002",
      "title": "Kigali Sounds Music Festival 2026 – Early Bird Passes",
      "description": "Join Africa's greatest afrobeat, amapiano, and hip-hop acts live at BK Arena Kigali. Get 20% off with PAYTUNE promo code.",
      "video_url": "https://www.w3schools.com/html/mov_bbb.mp4",
      "thumbnail_url": "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=800&q=80",
      "click_url": "https://kigalivibes.rw",
      "duration_seconds": 15,
      "advertiser_name": "Kigali Events Live",
      "budget_rwf": 180000,
      "spent_rwf": 8200,
      "status": "active",
      "created_by": "master-admin-uuid-001",
      "created_at": "2026-09-05T14:30:00.000Z",
      "updated_at": "2026-09-17T15:00:00.000Z"
    }
  ],
  "ad_assignments": [
    {
      "id": "assign-global-001",
      "ad_id": "ad-mtn-momo-001",
      "scope": "global",
      "video_id": null,
      "start_date": "2026-09-01T00:00:00.000Z",
      "end_date": null,
      "priority": 1,
      "status": "active",
      "created_at": "2026-09-01T10:00:00.000Z"
    },
    {
      "id": "assign-single-002",
      "ad_id": "ad-kigali-fest-002",
      "scope": "single",
      "video_id": "e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c",
      "start_date": "2026-09-05T00:00:00.000Z",
      "end_date": null,
      "priority": 10,
      "status": "active",
      "created_at": "2026-09-05T14:30:00.000Z"
    }
  ],
  "ad_impressions": [
    {
      "id": "imp-sample-001",
      "ad_id": "ad-mtn-momo-001",
      "video_id": "e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c",
      "user_id": null,
      "country": "Rwanda",
      "device": "desktop",
      "watched_seconds": 15,
      "clicked": true,
      "created_at": "2026-09-16T18:22:10.000Z"
    },
    {
      "id": "imp-sample-002",
      "ad_id": "ad-mtn-momo-001",
      "video_id": "e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c",
      "user_id": "master-admin-uuid-001",
      "country": "Rwanda",
      "device": "mobile",
      "watched_seconds": 7,
      "clicked": false,
      "created_at": "2026-09-17T09:15:30.000Z"
    },
    {
      "id": "imp-sample-003",
      "ad_id": "ad-kigali-fest-002",
      "video_id": "e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c",
      "user_id": null,
      "country": "Kenya",
      "device": "mobile",
      "watched_seconds": 15,
      "clicked": true,
      "created_at": "2026-09-17T14:02:44.000Z"
    }
  ],
  "countries": [
    {
      "id": "c-rw",
      "name": "Rwanda",
      "iso2": "RW",
      "iso3": "RWA",
      "currency_code": "RWF",
      "phone_code": "+250",
      "payment_gateway": "MTN MoMo",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-ke",
      "name": "Kenya",
      "iso2": "KE",
      "iso3": "KEN",
      "currency_code": "KES",
      "phone_code": "+254",
      "payment_gateway": "M-Pesa",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-tz",
      "name": "Tanzania",
      "iso2": "TZ",
      "iso3": "TZA",
      "currency_code": "TZS",
      "phone_code": "+255",
      "payment_gateway": "M-Pesa",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-ug",
      "name": "Uganda",
      "iso2": "UG",
      "iso3": "UGA",
      "currency_code": "UGX",
      "phone_code": "+256",
      "payment_gateway": "MTN MoMo",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-ng",
      "name": "Nigeria",
      "iso2": "NG",
      "iso3": "NGA",
      "currency_code": "NGN",
      "phone_code": "+234",
      "payment_gateway": "Paystack",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-za",
      "name": "South Africa",
      "iso2": "ZA",
      "iso3": "ZAF",
      "currency_code": "ZAR",
      "phone_code": "+27",
      "payment_gateway": "PayFast",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-in",
      "name": "India",
      "iso2": "IN",
      "iso3": "IND",
      "currency_code": "INR",
      "phone_code": "+91",
      "payment_gateway": "UPI",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-jp",
      "name": "Japan",
      "iso2": "JP",
      "iso3": "JPN",
      "currency_code": "JPY",
      "phone_code": "+81",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-gb",
      "name": "United Kingdom",
      "iso2": "GB",
      "iso3": "GBR",
      "currency_code": "GBP",
      "phone_code": "+44",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-eu",
      "name": "European Union",
      "iso2": "EU",
      "iso3": "EUR",
      "currency_code": "EUR",
      "phone_code": "+33",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-us",
      "name": "United States",
      "iso2": "US",
      "iso3": "USA",
      "currency_code": "USD",
      "phone_code": "+1",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-ca",
      "name": "Canada",
      "iso2": "CA",
      "iso3": "CAN",
      "currency_code": "CAD",
      "phone_code": "+1",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-au",
      "name": "Australia",
      "iso2": "AU",
      "iso3": "AUS",
      "currency_code": "AUD",
      "phone_code": "+61",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    },
    {
      "id": "c-gl",
      "name": "Global",
      "iso2": "XX",
      "iso3": "GLB",
      "currency_code": "USD",
      "phone_code": "+1",
      "payment_gateway": "Stripe",
      "is_active": true,
      "created_at": "2026-01-01T00:00:00Z"
    }
  ],
  "exchange_rates": [
    {
      "currency_code": "RWF",
      "rate_to_rwf": 1,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "USD",
      "rate_to_rwf": 1420,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "KES",
      "rate_to_rwf": 11,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "TZS",
      "rate_to_rwf": 0.54,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "UGX",
      "rate_to_rwf": 0.38,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "NGN",
      "rate_to_rwf": 0.95,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "ZAR",
      "rate_to_rwf": 79,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "INR",
      "rate_to_rwf": 16.8,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "JPY",
      "rate_to_rwf": 9.4,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "GBP",
      "rate_to_rwf": 1860,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "EUR",
      "rate_to_rwf": 1540,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "CAD",
      "rate_to_rwf": 1040,
      "updated_at": "2026-01-01T00:00:00Z"
    },
    {
      "currency_code": "AUD",
      "rate_to_rwf": 930,
      "updated_at": "2026-01-01T00:00:00Z"
    }
  ],
  "escrow_transactions": [],
  "copyright_claims": [],
  "dmca_requests": [],
  "copyright_disputes": [],
  "video_watermarks": [],
  "copyright_holders": [],
  "copyright_revenue": [],
  "infringement_strikes": []
};

let dbStore: any = null;

const isBrowser = typeof window !== 'undefined';

export function getDbStore(): any {
  return dbStore || getDb();
}

export function setDbStore(store: any) {
  dbStore = { ...DEFAULT_DB, ...store };
  // Ensure every collection from DEFAULT_DB exists
  for (const key of Object.keys(DEFAULT_DB)) {
    if (!dbStore[key]) {
      dbStore[key] = (DEFAULT_DB as any)[key];
    }
  }
  if (isBrowser) {
    localStorage.setItem('paytune_clean_db_v7', JSON.stringify(dbStore));
  }
}

function getDb(): any {
  if (dbStore) return dbStore;

  if (isBrowser) {
    const saved = localStorage.getItem('paytune_clean_db_v7') || localStorage.getItem('paytune_mock_db');
    if (saved) {
      try {
        dbStore = { ...DEFAULT_DB, ...JSON.parse(saved) };
        for (const key of Object.keys(DEFAULT_DB)) {
          if (!dbStore[key]) {
            dbStore[key] = (DEFAULT_DB as any)[key];
          }
        }
        // Ensure the test video is always present in videos list
        if (!dbStore.videos || dbStore.videos.length === 0) {
          dbStore.videos = JSON.parse(JSON.stringify(DEFAULT_DB.videos));
        } else if (!dbStore.videos.some((v: any) => v.video_url?.includes('BigBuckBunny') || v.id === 'e9a8b7c6-d5e4-4f3a-2b1c-0d9e8f7a6b5c')) {
          dbStore.videos.unshift(DEFAULT_DB.videos[0]);
        }
        return dbStore;
      } catch (e) {
        console.error("Failed to parse saved mock DB", e);
      }
    }
  }

  // fallback/initial
  dbStore = JSON.parse(JSON.stringify(DEFAULT_DB));
  saveDb(dbStore);
  return dbStore;
}

export let onMutationCallback: ((db: any) => void) | null = null;

export function registerMutationCallback(cb: (db: any) => void) {
  onMutationCallback = cb;
}

export function notifyMutation(db?: any) {
  saveDb(db || getDbStore());
}

function saveDb(db: any) {
  dbStore = db;
  if (isBrowser) {
    localStorage.setItem('paytune_clean_db_v7', JSON.stringify(db));
    // Non-blocking sync to server
    fetch('/api/mock-db', {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(db)
    }).catch(err => console.debug("Syncing mock DB to server failed (expected if server warming up)", err));
  } else {
    // Notify server-side listener if registered
    if (onMutationCallback) {
      try {
        onMutationCallback(db);
      } catch (e) {
        console.error("Error in onMutationCallback:", e);
      }
    }
  }
}

// Initial background sync for browser
if (isBrowser) {
  fetch('/api/mock-db')
    .then(r => r.json())
    .then(data => {
      if (data && typeof data === 'object' && !data.error) {
        if (!data.videos || data.videos.length === 0) {
          data.videos = JSON.parse(JSON.stringify(DEFAULT_DB.videos));
        }
        dbStore = data;
        localStorage.setItem('paytune_clean_db_v7', JSON.stringify(data));
        // dispatch auth state change event to trigger re-renders
        window.dispatchEvent(new Event('mock-auth-changed'));
      }
    })
    .catch(err => console.debug("Failed initial mock DB load:", err));
}

export function getTableData(table: string): any[] {
  const db = getDb();
  if (!db[table]) {
    db[table] = [];
  }
  return db[table];
}

export function saveTableData(table: string, data: any[]) {
  const db = getDb();
  db[table] = data;
  saveDb(db);
}

// Realtime subscription event dispatcher
export type RealtimePayload = {
  schema: string;
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new?: any;
  old?: any;
  commit_timestamp?: string;
  errors?: any[];
};

const realtimeListeners = new Set<(payload: RealtimePayload) => void>();

export function registerRealtimeListener(listener: (payload: RealtimePayload) => void) {
  realtimeListeners.add(listener);
  return () => {
    realtimeListeners.delete(listener);
  };
}

export function dispatchRealtimeEvent(
  table: string,
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  newRecord?: any,
  oldRecord?: any
) {
  const payload: RealtimePayload = {
    schema: 'public',
    table,
    eventType,
    new: newRecord,
    old: oldRecord,
    commit_timestamp: new Date().toISOString()
  };

  realtimeListeners.forEach((fn) => {
    try {
      fn(payload);
    } catch (e) {
      console.error('Realtime listener error:', e);
    }
  });

  if (isBrowser) {
    window.dispatchEvent(new CustomEvent('supabase-realtime-event', { detail: payload }));
    window.dispatchEvent(new CustomEvent(`supabase-realtime:${table}`, { detail: payload }));
  }
}

// Session persistence helper
function getMockSession(): Session | null {
  if (isBrowser) {
    const saved = localStorage.getItem('paytune_mock_session');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        return null;
      }
    }
  } else {
    // In Node runtime, we can check for an app-wide demo session if needed, but standard is null or jwt auth
    return (global as any)._mockSession || null;
  }
  return null;
}

function setMockSession(session: any | null) {
  if (isBrowser) {
    if (session) {
      localStorage.setItem('paytune_mock_session', JSON.stringify(session));
    } else {
      localStorage.removeItem('paytune_mock_session');
    }
    window.dispatchEvent(new Event('mock-auth-changed'));
  } else {
    (global as any)._mockSession = session;
  }
}

// Token helper: encodes user data inside the JWT-like pseudo token so the server gets authentic data
function createMockJwtToken(userId: string, email: string, fullName: string, role?: string): string {
  const resolvedRole = role || (email === 'master@paytune.com' ? 'MASTER_ADMIN' : 'user');
  const payload = { 
    id: userId, 
    email, 
    role: resolvedRole,
    user_metadata: { 
      full_name: fullName,
      role: resolvedRole
    } 
  };
  const encoded = isBrowser ? btoa(JSON.stringify(payload)) : Buffer.from(JSON.stringify(payload)).toString('base64');
  return `mock-jwt-token-header.${encoded}.mock-signature`;
}

// Mock Query Builder
export class MockQueryBuilder {
  private table: string;
  private filters: Array<(item: any) => boolean> = [];
  private orderCol: string | null = null;
  private orderAscending: boolean = true;
  private limitCount: number | null = null;
  private rangeFrom: number | null = null;
  private rangeTo: number | null = null;
  private selects: string = '*';

  constructor(table: string) {
    this.table = table;
  }

  select(fields: string = '*') {
    this.selects = fields;
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push((item) => {
      // Direct comparison of columns
      return item[col] === val;
    });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push((item) => item[col] !== val);
    return this;
  }

  gte(col: string, val: any) {
    this.filters.push((item) => {
      if (!item || item[col] === undefined || item[col] === null) return false;
      return new Date(item[col]).getTime() >= new Date(val).getTime() || item[col] >= val;
    });
    return this;
  }

  lte(col: string, val: any) {
    this.filters.push((item) => {
      if (!item || item[col] === undefined || item[col] === null) return false;
      return new Date(item[col]).getTime() <= new Date(val).getTime() || item[col] <= val;
    });
    return this;
  }

  gt(col: string, val: any) {
    this.filters.push((item) => item && item[col] > val);
    return this;
  }

  lt(col: string, val: any) {
    this.filters.push((item) => item && item[col] < val);
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push((item) => vals.includes(item[col]));
    return this;
  }

  order(col: string, options?: { ascending: boolean }) {
    this.orderCol = col;
    this.orderAscending = options?.ascending !== false;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  range(from: number, to: number) {
    this.rangeFrom = from;
    this.rangeTo = to;
    return this;
  }

  ilike(col: string, val: string) {
    this.filters.push((item) => {
      if (!item || !item[col]) return false;
      const cleanPattern = val.replace(/%/g, "").toLowerCase();
      return String(item[col]).toLowerCase().includes(cleanPattern);
    });
    return this;
  }

  or(filterString: string) {
    if (!filterString) return this;
    this.filters.push((item) => {
      if (!item) return false;
      const clauses = filterString.split(',').map(s => s.trim()).filter(Boolean);
      if (clauses.length === 0) return true;

      return clauses.some((clause) => {
        const parts = clause.split('.');
        if (parts.length < 3) return false;
        const col = parts[0];
        const op = parts[1];
        const rawVal = parts.slice(2).join('.');

        let val: any = rawVal;
        if (rawVal === 'true') val = true;
        else if (rawVal === 'false') val = false;
        else if (rawVal === 'null') val = null;
        else if (!isNaN(Number(rawVal)) && rawVal.trim() !== '') val = Number(rawVal);

        const itemVal = item[col];

        switch (op) {
          case 'eq':
            return itemVal === val || String(itemVal) === String(val);
          case 'neq':
            return itemVal !== val && String(itemVal) !== String(val);
          case 'gte':
            return itemVal >= val;
          case 'lte':
            return itemVal <= val;
          case 'gt':
            return itemVal > val;
          case 'lt':
            return itemVal < val;
          case 'ilike': {
            const clean = String(val).replace(/%/g, "").toLowerCase();
            return String(itemVal || '').toLowerCase().includes(clean);
          }
          case 'like': {
            const clean = String(val).replace(/%/g, "");
            return String(itemVal || '').includes(clean);
          }
          case 'is':
            return itemVal === val;
          default:
            return itemVal === val || String(itemVal) === String(val);
        }
      });
    });
    return this;
  }

  insert(rows: any | any[]) {
    const tableData = getTableData(this.table);
    const newRows = Array.isArray(rows) ? rows : [rows];
    const inserted: any[] = [];
    for (const r of newRows) {
      const newRow = {
        id: r.id || `mock-${this.table}-${Math.random().toString(36).substr(2, 9)}`,
        created_at: new Date().toISOString(),
        uploaded_at: new Date().toISOString(),
        purchased_at: new Date().toISOString(),
        ...r
      };
      tableData.push(newRow);
      inserted.push(newRow);
    }
    saveTableData(this.table, tableData);
    inserted.forEach(item => {
      dispatchRealtimeEvent(this.table, 'INSERT', item);
    });

    const b = new MockQueryBuilder(this.table);
    b.execute = async () => {
      const list = [...inserted];
      const result = list.map(item => {
        const itemCopy = { ...item };
        // Resolve artists relation if selected
        if (b.selects.includes('artists') || b.selects.includes('*')) {
          const artists = getTableData('artists');
          const artist = artists.find(a => a.id === item.artist_id) || artists[0];
          itemCopy.artists = artist;
        }
        // Resolve profiles relation if selected
        if (b.selects.includes('profiles')) {
          const profiles = getTableData('profiles');
          const profile = profiles.find(p => p.id === item.user_id) || profiles[0] || { full_name: "Jean Kamali", username: "jeankamali" };
          itemCopy.profiles = profile;
        }
        // Resolve videos relation if selected
        if (b.selects.includes('videos')) {
          const videos = getTableData('videos');
          const video = videos.find(v => v.id === item.video_id) || videos[0];
          itemCopy.videos = video;
        }
        // Resolve membership_tiers / tier relation if selected
        if (b.selects.includes('membership_tiers') || b.selects.includes('tiers') || b.selects.includes('*')) {
          const tiers = getTableData('membership_tiers');
          const tier = tiers.find(t => t.id === item.tier_id);
          if (tier) {
            itemCopy.membership_tiers = tier;
            itemCopy.tier = tier;
          }
        }
        return itemCopy;
      });
      return { data: Array.isArray(rows) ? result : result[0], error: null };
    };
    return b;
  }

  pendingUpdate: any = null;
  pendingDelete: boolean = false;

  update(fields: any) {
    this.pendingUpdate = fields;
    return this;
  }

  delete() {
    this.pendingDelete = true;
    return this;
  }

  async execute() {
    if (this.pendingUpdate) {
      const tableData = getTableData(this.table);
      const updated: any[] = [];
      const matched = tableData.map(item => {
        const isMatch = this.filters.length > 0 ? this.filters.every(f => f(item)) : true;
        if (isMatch) {
          const updatedItem = { ...item, ...this.pendingUpdate, updated_at: new Date().toISOString() };
          updated.push(updatedItem);
          return updatedItem;
        }
        return item;
      });
      saveTableData(this.table, matched);
      updated.forEach(item => {
        dispatchRealtimeEvent(this.table, 'UPDATE', item);
      });
      return { data: updated, error: null };
    }

    if (this.pendingDelete) {
      const tableData = getTableData(this.table);
      const deleted: any[] = [];
      const remaining = tableData.filter(item => {
        const isMatch = this.filters.length > 0 ? this.filters.every(f => f(item)) : false;
        if (isMatch) {
          deleted.push(item);
          return false;
        }
        return true;
      });
      saveTableData(this.table, remaining);
      deleted.forEach(item => {
        dispatchRealtimeEvent(this.table, 'DELETE', undefined, item);
      });
      return { data: deleted, error: null };
    }

    let list = [...getTableData(this.table)];

    // Apply filters
    for (const f of this.filters) {
      list = list.filter(f);
    }

    // Apply sorting
    if (this.orderCol) {
      const col = this.orderCol;
      const asc = this.orderAscending;
      list.sort((a, b) => {
        const valA = a[col];
        const valB = b[col];
        if (valA === valB) return 0;
        if (valA === undefined || valA === null) return 1;
        if (valB === undefined || valB === null) return -1;
        if (typeof valA === 'string') {
          return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return asc ? valA - valB : valB - valA;
      });
    }

    // Apply range pagination
    if (this.rangeFrom !== null) {
      const to = this.rangeTo !== null ? this.rangeTo + 1 : undefined;
      list = list.slice(this.rangeFrom, to);
    } else if (this.limitCount !== null) {
      list = list.slice(0, this.limitCount);
    }

    // Map selects (e.g., resolve foreign keys if requested)
    const result = list.map(item => {
      const itemCopy = { ...item };
      
      // Resolve artists relation if selected
      if (this.selects.includes('artists') || this.selects.includes('*')) {
        const artists = getTableData('artists');
        const artist = artists.find(a => a.id === item.artist_id) || artists[0];
        itemCopy.artists = artist;
      }
      // Resolve profiles relation if selected
      if (this.selects.includes('profiles')) {
        const profiles = getTableData('profiles');
        const profile = profiles.find(p => p.id === item.user_id) || profiles[0] || { full_name: "Jean Kamali", username: "jeankamali" };
        itemCopy.profiles = profile;
      }
      // Resolve videos relation if selected
      if (this.selects.includes('videos')) {
        const videos = getTableData('videos');
        const video = videos.find(v => v.id === item.video_id) || videos[0];
        itemCopy.videos = video;
      }
      // Resolve membership_tiers / tier relation if selected
      if (this.selects.includes('membership_tiers') || this.selects.includes('tiers') || this.selects.includes('*')) {
        const tiers = getTableData('membership_tiers');
        const tier = tiers.find(t => t.id === item.tier_id);
        if (tier) {
          itemCopy.membership_tiers = tier;
          itemCopy.tier = tier;
        }
      }
      return itemCopy;
    });

    return { data: result, error: null };
  }

  // Promise thenable implementation
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    return this.execute().then(onfulfilled, onrejected);
  }

  async single() {
    const { data, error } = await this.execute();
    if (error) return { data: null, error };
    if (!data) {
      return { data: null, error: { message: "Not found", code: "PGRST116" } };
    }
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { data: null, error: { message: "Not found", code: "PGRST116" } };
      }
      return { data: data[0], error: null };
    }
    return { data, error: null };
  }

  async maybeSingle() {
    const { data, error } = await this.execute();
    if (error) return { data: null, error };
    if (!data) {
      return { data: null, error: null };
    }
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return { data: null, error: null };
      }
      return { data: data[0], error: null };
    }
    return { data, error: null };
  }
}

// Mock Authenticator
const mockAuth = {
  signUp: async ({ email, password, options }: any) => {
    const profiles = getTableData('profiles');
    const existing = profiles.find((p: any) => p.email === email);
    if (existing) {
       return { data: { user: null }, error: { message: "User already exists" } };
    }
    const userId = `user-${Math.random().toString(36).substr(2, 9)}`;
    const fullName = options?.data?.full_name || email.split('@')[0];
    const newUser = {
      id: userId,
      email,
      user_metadata: options?.data || {},
      created_at: new Date().toISOString()
    };

    const newProfile = {
      id: userId,
      email,
      full_name: fullName,
      username: email.split('@')[0] + Math.floor(Math.random() * 1000),
      total_spent: 0,
      created_at: new Date().toISOString()
    };

    profiles.push(newProfile);
    saveTableData('profiles', profiles);

    // Save mock session with simulated JWT token containing info
    const session = {
      access_token: createMockJwtToken(userId, email, fullName),
      user: newUser
    };
    setMockSession(session);

    return { data: { user: newUser, session }, error: null };
  },

  signInWithPassword: async ({ email, password }: any) => {
    const cleanEmail = (email || '').trim().toLowerCase();
    const isMaster = cleanEmail === 'master@paytune.com';
    if (isMaster) {
      if (password && password !== 'Paytune2025!' && password !== 'MasterAdmin#2026!') {
        return { data: { user: null, session: null }, error: { message: "Invalid Master Admin credentials." } };
      }
    }

    const profiles = getTableData('profiles');
    let profile = profiles.find((p: any) => p.email?.toLowerCase() === cleanEmail);

    const artists = getTableData('artists');
    let artist = artists.find((a: any) => a.email?.toLowerCase() === cleanEmail);

    const userId = profile?.id || artist?.user_id || (isMaster ? 'master-admin-uuid-001' : `user-signedin-${Math.random().toString(36).substr(2, 9)}`);
    const fullName = profile?.full_name || artist?.full_name || (isMaster ? 'PAYTUNE Master Administrator' : email.split('@')[0]);

    if (!profile && !artist) {
       // Create a default profile
       profile = {
         id: userId,
         email,
         full_name: fullName,
         username: email.split('@')[0] + Math.floor(Math.random() * 1000),
         total_spent: 0,
         created_at: new Date().toISOString()
       };
       profiles.push(profile);
       saveTableData('profiles', profiles);
    }

    const role = isMaster ? 'MASTER_ADMIN' : undefined;

    const user = {
      id: userId,
      email,
      role: role || 'user',
      user_metadata: { 
        full_name: fullName,
        ...(role ? { role } : {})
      },
      created_at: new Date().toISOString()
    };

    const session = {
      access_token: createMockJwtToken(userId, email, fullName, role),
      user
    };
    setMockSession(session);

    return { data: { user, session }, error: null };
  },

  updateUser: async (attributes: any) => {
    const session = getMockSession();
    if (!session || !session.user) {
      return { data: { user: null }, error: { message: "No session to update" } };
    }
    const updatedUser = {
      ...session.user,
      ...attributes,
      user_metadata: {
        ...(session.user.user_metadata || {}),
        ...(attributes.data || {})
      }
    };
    if (attributes?.data?.role) {
      updatedUser.role = attributes.data.role;
    }
    const updatedSession = {
      ...session,
      access_token: createMockJwtToken(
        updatedUser.id, 
        updatedUser.email, 
        updatedUser.user_metadata?.full_name || 'User', 
        updatedUser.role
      ),
      user: updatedUser
    };
    setMockSession(updatedSession);
    return { data: { user: updatedUser }, error: null };
  },

  admin: {
    listUsers: async () => {
      const profiles = getTableData('profiles');
      const artists = getTableData('artists');
      const usersMap = new Map<string, any>();
      profiles.forEach((p: any) => {
        if (p.email) {
          usersMap.set(p.email.toLowerCase(), {
            id: p.id,
            email: p.email,
            user_metadata: { full_name: p.full_name, role: p.role || 'user' }
          });
        }
      });
      artists.forEach((a: any) => {
        if (a.email && !usersMap.has(a.email.toLowerCase())) {
          usersMap.set(a.email.toLowerCase(), {
            id: a.user_id || a.id,
            email: a.email,
            user_metadata: { full_name: a.full_name, role: 'artist', phone: a.phone }
          });
        }
      });
      return { data: { users: Array.from(usersMap.values()) }, error: null };
    },
    createUser: async ({ email, password, email_confirm, user_metadata }: any) => {
      const profiles = getTableData('profiles');
      const cleanEmail = (email || '').toLowerCase().trim();
      const existing = profiles.find((p: any) => p.email?.toLowerCase() === cleanEmail);
      if (existing) {
        return { data: { user: null }, error: { message: "User already exists" } };
      }
      const userId = `user-${Math.random().toString(36).substr(2, 9)}`;
      const fullName = user_metadata?.full_name || cleanEmail.split('@')[0];
      const newUser = {
        id: userId,
        email: cleanEmail,
        user_metadata: user_metadata || {},
        created_at: new Date().toISOString()
      };
      profiles.push({
        id: userId,
        email: cleanEmail,
        full_name: fullName,
        role: user_metadata?.role || 'artist',
        created_at: new Date().toISOString()
      });
      saveTableData('profiles', profiles);
      return { data: { user: newUser }, error: null };
    },
    deleteUser: async (id: string) => {
      let profiles = getTableData('profiles');
      profiles = profiles.filter((p: any) => p.id !== id);
      saveTableData('profiles', profiles);
      return { data: { user: null }, error: null };
    }
  },

  signInWithOAuth: async ({ provider, options }: any) => {
    const email = "google.demo@paytune.com";
    const userId = "google-user-demo-id";
    const user = {
      id: userId,
      email,
      user_metadata: { full_name: "Google Demo User" },
      created_at: new Date().toISOString()
    };
    const session = {
      access_token: createMockJwtToken(userId, email, "Google Demo User"),
      user
    };
    setMockSession(session);
    if (isBrowser) {
       window.location.reload();
    }
    return { data: { user, session }, error: null };
  },

  signOut: async () => {
    setMockSession(null);
    return { error: null };
  },

  getSession: async () => {
    const session = getMockSession();
    return { data: { session }, error: null };
  },

  getUser: async (token?: string) => {
    if (!token) {
      const session = getMockSession();
      if (session?.user) return { data: { user: session.user }, error: null };
      return { data: { user: null }, error: { message: "No session" } };
    }
    try {
      const parts = token.split('.');
      if (parts.length === 3 && parts[1]) {
        const payloadStr = isBrowser 
          ? atob(parts[1]) 
          : Buffer.from(parts[1], 'base64').toString('utf-8');
        const user = JSON.parse(payloadStr);
        return { data: { user }, error: null };
      }
    } catch (e) {
      // fallback
    }
    // Simple fallback logic if token decoding failed
    const session = getMockSession();
    if (session?.user) return { data: { user: session.user }, error: null };
    return { data: { user: null }, error: null };
  },

  onAuthStateChange: (callback: any) => {
    const session = getMockSession();
    setTimeout(() => {
      callback('SIGNED_IN', session);
    }, 0);

    const handler = () => {
      const s = getMockSession();
      callback(s ? 'SIGNED_IN' : 'SIGNED_OUT', s);
    };

    if (isBrowser) {
      window.addEventListener('mock-auth-changed', handler);
    }

    return {
      data: {
        subscription: {
          unsubscribe: () => {
            if (isBrowser) {
              window.removeEventListener('mock-auth-changed', handler);
            }
          }
        }
      }
    };
  }
};

// Create the overall Mock Supabase Client matching the SDK signature
export function createMockSupabaseClient() {
  return {
    auth: mockAuth,
    from: (table: string) => new MockQueryBuilder(table),
    storage: {
      from: (bucket: string) => ({
        upload: async (fileName: string, fileData: any, options?: any) => {
          try {
            if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function') {
              const fs = await import('fs');
              const path = await import('path');
              const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              const filePath = path.join(uploadsDir, fileName);
              if (Buffer.isBuffer(fileData)) {
                fs.writeFileSync(filePath, fileData);
              } else if (fileData instanceof Uint8Array) {
                fs.writeFileSync(filePath, Buffer.from(fileData));
              }
            }
          } catch (e) {
            // Browser or sandbox fallback
          }
          return { data: { path: fileName }, error: null };
        },
        createSignedUploadUrl: async (fileName: string) => {
          return {
            data: {
              signedUrl: `/api/artist/upload/mock-signed?bucket=${bucket}&path=${encodeURIComponent(fileName)}`,
              token: `mock-token-${Date.now()}`,
              path: fileName
            },
            error: null
          };
        },
        uploadToSignedUrl: async (fileName: string, _token: string, fileData: any, options?: any) => {
          try {
            if (typeof window === 'undefined' && typeof process !== 'undefined' && typeof process.cwd === 'function') {
              const fs = await import('fs');
              const path = await import('path');
              const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
              if (!fs.existsSync(uploadsDir)) {
                fs.mkdirSync(uploadsDir, { recursive: true });
              }
              const filePath = path.join(uploadsDir, fileName);
              if (Buffer.isBuffer(fileData)) {
                fs.writeFileSync(filePath, fileData);
              } else if (fileData instanceof Uint8Array) {
                fs.writeFileSync(filePath, Buffer.from(fileData));
              }
            }
          } catch (e) {}
          return { data: { path: fileName }, error: null };
        },
        getPublicUrl: (fileName: string) => {
          return { data: { publicUrl: `/uploads/${fileName}` } };
        }
      }),
      createBucket: async (bucket: string) => {
        return { data: { name: bucket }, error: null };
      }
    },
    channel: (channelName: string) => {
      const subscriptions: Array<{
        event: string;
        filter: any;
        callback: Function;
      }> = [];
      let unsubscribeFns: Array<() => void> = [];

      const channelObj = {
        name: channelName,
        on: (eventType: string, filter: any, callback: Function) => {
          subscriptions.push({ event: eventType, filter, callback });
          return channelObj;
        },
        subscribe: (statusCallback?: (status: string, err?: any) => void) => {
          unsubscribeFns = subscriptions.map((sub) => {
            return registerRealtimeListener((payload) => {
              if (sub.event === 'postgres_changes') {
                const targetEvent = (sub.filter?.event || '*').toUpperCase();
                const targetTable = sub.filter?.table;
                if (targetTable && targetTable !== '*' && targetTable !== payload.table) return;
                if (targetEvent !== '*' && targetEvent !== payload.eventType) return;
                sub.callback(payload);
              } else if (sub.event === 'broadcast') {
                sub.callback(payload);
              }
            });
          });

          if (isBrowser) {
            const browserHandler = (e: any) => {
              const payload = e.detail;
              subscriptions.forEach((sub) => {
                if (sub.event === 'postgres_changes') {
                  const targetEvent = (sub.filter?.event || '*').toUpperCase();
                  const targetTable = sub.filter?.table;
                  if (targetTable && targetTable !== '*' && targetTable !== payload.table) return;
                  if (targetEvent !== '*' && targetEvent !== payload.eventType) return;
                  sub.callback(payload);
                }
              });
            };
            window.addEventListener('supabase-realtime-event', browserHandler);
            unsubscribeFns.push(() => window.removeEventListener('supabase-realtime-event', browserHandler));
          }

          setTimeout(() => {
            if (statusCallback) statusCallback('SUBSCRIBED');
          }, 10);
          return channelObj;
        },
        unsubscribe: () => {
          unsubscribeFns.forEach((fn) => fn());
          unsubscribeFns = [];
          return channelObj;
        }
      };
      return channelObj;
    },
    removeChannel: (channelObj: any) => {
      if (channelObj && typeof channelObj.unsubscribe === 'function') {
        channelObj.unsubscribe();
      }
    }
  };
}
