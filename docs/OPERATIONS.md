# PAYTUNE Operations, Monitoring & Troubleshooting

## 1. Health Checks & Diagnostics

The platform exposes dedicated diagnostic endpoints for health monitoring, load balancers, and uptime probes:

- **Primary Health Probe**:
  `GET /api/health`
  Returns `{"status": "ok", "app": "PAYTUNE"}` with HTTP 200. Used by Docker `HEALTHCHECK` and Cloud Run probes.
- **Database Connectivity Diagnostics**:
  `GET /api/diagnostics/supabase`
  Verifies connection state, table read availability, and project credentials.

---

## 2. Backup & Recovery Operations

### PostgreSQL / Supabase
1. Run automated daily backups via Supabase dashboard or pg_dump:
   ```bash
   pg_dump -h $PGHOST -U $PGUSER -d $PGDATABASE -F c -b -v -f "paytune_backup_$(date +%Y%m%d).dump"
   ```
2. Restore command:
   ```bash
   pg_restore -h $PGHOST -U $PGUSER -d $PGDATABASE -v "paytune_backup_YYYYMMDD.dump"
   ```

### MySQL (when using mysql2 driver)
1. Dump command:
   ```bash
   mysqldump -u $MYSQL_USER -p -h $MYSQL_HOST --single-transaction --routines --triggers $MYSQL_DATABASE > "paytune_mysql_$(date +%Y%m%d).sql"
   ```
2. Restore command:
   ```bash
   mysql -u $MYSQL_USER -p -h $MYSQL_HOST $MYSQL_DATABASE < "paytune_mysql_YYYYMMDD.sql"
   ```

---

## 3. Incident Response & Troubleshooting Guide

### Issue 1: HTTP 413 (Payload Too Large) on Video Upload
- **Cause**: Upload was sent through the Express server rather than the direct-to-storage signed URL pipeline.
- **Resolution**: Ensure the frontend calls `/api/artist/upload/signed-url` and streams bytes directly via HTTP `PUT` to Supabase Object Storage, bypassing the backend.

### Issue 2: HTTP 429 (Too Many Requests)
- **Cause**: High-frequency requests exceeded the rate limiter threshold.
- **Resolution**: Read-only public discovery endpoints (`GET /api/videos/*`, `/api/comments/*`) are explicitly bypassed in `server.ts`. For payment endpoints, wait 5 minutes before retrying.

### Issue 3: Mobile Money Webhook Delayed or Timed Out
- **Cause**: Payer phone was unreachable or delayed in entering PIN.
- **Resolution**: The frontend automatically polls `/api/payments/:paymentId/status` every 3 seconds for up to 2 minutes. The backend reconciles payment status upon receiving operator confirmation.

### Issue 4: Video Returns 404 (Not Found)
- **Cause**: Requested release has not been approved (`upload_status: 'review'`) or is flagged.
- **Resolution**: Log in as Master Administrator (`/master`), review the pending video queue, and click **Approve Release**.
