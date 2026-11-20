# PAYTUNE — Livestream Implementation Report

**Overall Status:** `VERIFIED COMPLETE` (Core DB, API & UI) / `BLOCKED BY EXTERNAL DEPENDENCY` (Live External MoMo/Airtel/Stripe Ticket Settling Without Gateway API Keys)

## 1. Architecture & Components

PAYTUNE's livestreaming engine stores all broadcast metadata, ingest credentials, viewer heartbeats, chat messages, moderation bans, ticket purchases, and reminder opt-ins in Supabase PostgreSQL + Socket.IO real-time channels. No fake viewer counters or simulated chat messages remain.

### Key Files
- **Database Schema & View & Functions (`init.sql`)**:
  - Tables: `public.livestreams`, `public.livestream_credentials`, `public.livestream_hosts`, `public.livestream_viewer_sessions`, `public.livestream_stream_events`, `public.livestream_chat_messages`, `public.livestream_chat_moderation_actions`, `public.livestream_gift_catalog`, `public.livestream_gifts`, `public.livestream_ticket_types`, `public.livestream_ticket_orders`, `public.livestream_recordings`, `public.livestream_daily_analytics`, `public.livestream_reminders`
  - View: `public.v_livestream_overview`
  - Function: `public.paytune_recompute_livestream_viewers(p_livestream_id UUID)`
  - Trigger: `trg_livestreams_updated_at`
- **Backend Controller & Routes**:
  - `src/controllers/liveController.ts`
  - `src/routes/liveRoutes.ts` (`artistLiveRouter` mounted at `/api/artist/live`, `liveRouter` mounted at `/api/live`)
  - Real-time Socket.IO events in `server.ts`
- **Frontend Pages & Player**:
  - `src/pages/Live.tsx` -> `src/pages/live/LiveStreams.tsx`
  - Stream Watch & Watermark Integration (`LivestreamPlayer`, forensic session watermark overlay)

## 2. Verified API Endpoints

| Method & Endpoint | Auth Requirement | Purpose | Live Probe Status |
| :--- | :--- | :--- | :--- |
| `GET /api/live/now` | Public | Active `live` broadcasts ordered from DB | HTTP 200 (`[]` on unseeded DB) — `VERIFIED COMPLETE` |
| `GET /api/live/upcoming` | Public | Upcoming `scheduled` broadcasts | HTTP 200 (`[]` on unseeded DB) — `VERIFIED COMPLETE` |
| `GET /api/live/:id` | Optional JWT | Stream detail, access/ticket check, host metadata | `IMPLEMENTED, NOT FULLY VERIFIED` (requires live stream row) |
| `POST /api/live/:id/heartbeat` | Optional JWT | Records/refreshes active viewer session in `livestream_viewer_sessions` | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `POST /api/artist/live/create` | Artist JWT | Creates broadcast & issues credentials (`livestream_credentials`) | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `POST /api/artist/live/:id/key/rotate` | Artist JWT | Rotates ingest stream key safely | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `POST /api/artist/live/:id/key/revoke` | Artist JWT | Revokes active stream key | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `PUT /api/artist/live/:id/start` | Artist JWT | Transitions stream status to live & notifies followers | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `PUT /api/artist/live/:id/end` | Artist/Admin JWT | Ends broadcast & persists duration/recording info | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `GET/POST /api/live/:streamId/chat` | Public read / Auth write | Real-time persistent chat (`livestream_chat_messages`) | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `POST /api/live/:id/block/:userId` | Artist/Mod JWT | Chat moderation ban in `livestream_chat_moderation_actions` | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `POST /api/live/:id/remind` | User JWT | Toggles `livestream_reminders` notification row | `IMPLEMENTED, NOT FULLY VERIFIED` |
| `POST /api/live/:id/purchase` & `donate` | User JWT | Paid stream ticket & Super Thanks gift orders | `BLOCKED BY EXTERNAL DEPENDENCY` (payment provider keys not configured) |

## 3. Compliance Notes

- **Zero Simulation**: Viewer counts are computed exclusively from `livestream_viewer_sessions` heartbeats; chat renders only database/Socket.IO messages.
- **Forensic Watermark**: Active viewer sessions embed traceable session watermarks on playback.
- **Role Isolation**: `paytune_livestream_creds_owner_only` RLS policy ensures stream keys are readable only by owning channel/artist members and admins.
