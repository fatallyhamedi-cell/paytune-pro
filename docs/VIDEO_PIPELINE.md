# PAYTUNE Video Upload, Processing & Secure Delivery Pipeline

## 1. Direct-to-Storage Upload Pipeline

### The 32 MB Cloud Run Constraint & Solution
Traditional web servers route file uploads through Express multipart middleware (`multer`). However, modern serverless and containerized environments (such as Google Cloud Run, Cloudflare, and AWS API Gateway) cap request payloads at 32 MB. Video files routinely exceed 50 MB to 2 GB.

PAYTUNE uses direct-to-cloud signed upload URLs:

```
[ Creator Browser ] ───(1) Request Signed URL (/api/artist/upload/signed-url)───► [ Express API ]
        │                                                                               │
        │◄────────────────(2) Return Signed Upload URL & Public Path────────────────────┘
        │
        ▼ (3) Direct HTTP PUT of raw video bytes (0 MB - 2 GB)
[ Supabase / S3 Object Storage ]
        │
        ▼ (4) Storage Upload Success
[ Creator Browser ] ───(5) Complete Video Registration (/api/artist/video/complete)──► [ Express API ]
                                                                                               │
                                                                                               ▼
                                                                                   [ Videos DB: 'review' ]
```

### Supported Buckets
- `videos`: Master video files (MP4, WebM, MOV) up to 2 GB.
- `audio`: Master songs & audio tracks (MP3, WAV, M4A) up to 100 MB.
- `thumbnails`: High-definition 16:9 cover images up to 10 MB.
- `avatars` / `banners`: Artist channel branding images.

---

## 2. Playback Authorization & Paywall Engine

### Paywall Decision Logic
When a viewer accesses `/watch/:id`:
1. Server queries video record and resolves `is_free`, `is_short`, and price.
2. If `is_free === true` or `is_short === true`: Playback is authorized immediately.
3. If `is_free === false`: Server checks `purchases` for `(user_id, video_id)` or active channel membership.
4. If purchase is found: Full master streaming URL is authorized.
5. If purchase is not found: Server serves the 30-second preview stream (`preview_url`). Once the preview timer expires, the custom player triggers the interactive MoMo payment modal.

---

## 3. Anti-Piracy & Forensic Watermarking

1. **Dynamic Forensic Watermark**:
   - The player embeds a cryptographically generated session token containing the authenticated user's ID and timestamp.
   - The watermark shifts position between the four viewport corners every 20 seconds, preventing cropping or screen-recorder scraping.
2. **Shortcuts & Inspection Defense**:
   - Intercepts and blocks browser save commands (`Ctrl+S`, `Cmd+S`), source view (`Ctrl+U`, `Cmd+U`), and developer shortcut keys (`F12`).
   - Context menu is restricted over active playback surfaces.
3. **No Indiscriminate Service-Worker Caching**:
   - Paid video stream segments are never cached in unencrypted service worker caches, mitigating unauthorized local extraction.
