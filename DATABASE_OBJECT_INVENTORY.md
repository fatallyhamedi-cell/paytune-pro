# PAYTUNE — Database Object Inventory (`init.sql` + Live Supabase)

**Target Engine:** PostgreSQL / Supabase (`lgetnnqaggjjdfefhbgn`)  
**Schema Source File:** `/init.sql` (2,463 lines)

## 1. Summary Counts

| Object Type | Count in `init.sql` | Verification Status |
| :--- | :---: | :--- |
| Tables (`CREATE TABLE IF NOT EXISTS`) | 118 | Core tables verified live via REST (`/api/metrics`, `/api/health`); full 118-table DDL documented in `init.sql` |
| Views (`CREATE OR REPLACE VIEW`) | 2 | `IMPLEMENTED, NOT FULLY VERIFIED` (`v_livestream_overview`, `v_music_track_catalog_summary`) |
| Functions (`CREATE OR REPLACE FUNCTION`) | 7 | `IMPLEMENTED, NOT FULLY VERIFIED` |
| Triggers (`CREATE TRIGGER`) | 4 | `IMPLEMENTED, NOT FULLY VERIFIED` |
| RLS Policies (`CREATE POLICY`) | 20 | `IMPLEMENTED, NOT FULLY VERIFIED` (16 public schema + 4 `storage.objects`) |
| Explicit Secondary Indexes (`CREATE INDEX`) | 18 | `IMPLEMENTED, NOT FULLY VERIFIED` |
| Storage Buckets (`storage.buckets`) | 7 in `init.sql` (9 active in live Supabase) | `VERIFIED COMPLETE` |

## 2. Tables by Domain (118 Total)

1. **Identity, Security & Compliance (8):** `profiles`, `user_role_assignments`, `user_settings`, `user_notification_preferences`, `user_privacy_settings`, `user_security_events`, `user_consents`, `account_deletion_requests`
2. **Artists, Creator Channels & Following (12):** `artist_profiles`, `artist_members`, `artist_invitations`, `artist_social_links`, `artist_verification_requests`, `artist_phone_verification_events`, `artist_follows`, `creator_channels`, `creator_channel_members`, `creator_channel_social_links`, `creator_channel_verification_requests`, `user_follows`
3. **Taxonomy & Media Storage Assets (8):** `categories`, `tags`, `media_assets`, `media_variants`, `media_asset_links`, `media_upload_sessions`, `media_upload_parts`, `media_processing_jobs`
4. **Videos, Shorts, Playback & Analytics (10):** `videos`, `video_captions`, `video_playback_sessions`, `video_view_events`, `video_watch_history`, `video_watch_progress`, `video_daily_analytics`, `shorts_analytics`, `video_playlists`, `video_playlist_items`
5. **Music Catalog, Lyrics, Rights & Playlists (12):** `music_genres`, `music_releases`, `music_tracks`, `music_release_tracks`, `music_release_artists`, `music_track_artists`, `music_track_credits`, `music_lyrics`, `music_rights`, `music_play_events`, `playlists`, `playlist_items`
6. **Community Engagement (2):** `comments`, `content_reactions`
7. **Livestreaming, Chat, Tickets & Reminders (14):** `livestreams`, `livestream_credentials`, `livestream_hosts`, `livestream_viewer_sessions`, `livestream_stream_events`, `livestream_chat_messages`, `livestream_chat_moderation_actions`, `livestream_gift_catalog`, `livestream_gifts`, `livestream_ticket_types`, `livestream_ticket_orders`, `livestream_recordings`, `livestream_daily_analytics`, `livestream_reminders`
8. **Advertising & Invalid Traffic Protection (9):** `advertiser_accounts`, `advertising_campaigns`, `advertising_creatives`, `advertising_placements`, `advertising_campaign_placements`, `advertising_targeting_rules`, `advertising_integrations`, `advertising_delivery_events`, `advertising_invalid_traffic_events`
9. **Monetization, Payments, Ledger, Withdrawals & Entitlements (23):** `creator_monetization_accounts`, `creator_monetization_applications`, `creator_monetization_eligibility_checks`, `creator_monetization_events`, `creator_revenue_share_policies`, `payment_provider_accounts`, `payment_customers`, `payment_methods`, `payment_intents`, `financial_transactions`, `financial_ledger_accounts`, `financial_journal_entries`, `financial_journal_lines`, `financial_reconciliations`, `creator_earning_accounts`, `creator_earning_transactions`, `advertising_creator_revenue_attributions`, `creator_membership_tiers`, `creator_memberships`, `super_thanks`, `creator_gift_events`, `premium_content_access_grants`, `access_requests`, `creator_payout_methods`, `creator_payout_verification_profiles`, `creator_tax_profiles`, `creator_withdrawal_requests` *(27 tables across monetization + payments + ledger + payouts)*
10. **Notifications, Moderation, Copyright & Governance (10):** `notifications`, `user_reports`, `moderation_cases`, `moderation_actions`, `copyright_claims`, `copyright_disputes`, `admin_permissions`, `admin_role_permissions`, `admin_action_audit_logs`, `platform_settings`, `platform_setting_revisions` *(11 tables)*
11. **Support & Observability (5):** `support_tickets`, `support_ticket_messages`, `system_error_events`, `operational_health_logs`, `playback_logs`

## 3. Views, Functions & Triggers

- **Views (2):** `public.v_livestream_overview`, `public.v_music_track_catalog_summary`
- **Functions (7):** `paytune_generate_uuid()`, `paytune_null_if_blank(TEXT)`, `paytune_touch_updated_at()`, `paytune_is_admin(UUID)`, `paytune_calculate_revenue_split(...)`, `paytune_recompute_livestream_viewers(UUID)`, `paytune_sync_watch_history_from_progress()`
- **Triggers (4):** `trg_video_watch_progress_sync`, `trg_livestreams_updated_at`, `trg_music_tracks_updated_at`, `trg_support_tickets_updated_at`

## 4. Storage Buckets Verified Live in Supabase

Live `/api/health` and `/api/metrics` confirm 9 buckets present:
`artist-avatars`, `videos`, `audio`, `thumbnails`, `avatars`, `banners`, `previews`, `media_assets`, `paytune-video-private`.
