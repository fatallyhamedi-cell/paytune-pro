# PAYTUNE Production Deployment Guide

## 1. Build and Run Commands

PAYTUNE uses a dual-compilation build step that compiles the Vite React client into `dist/` and bundles `server.ts` into a standalone Node.js script.

### 1.1 Production Build
```bash
npm run build
```
This runs:
1. `vite build` — generates client assets in `/dist`.
2. `esbuild server.ts --bundle --platform=node --format=cjs --packages=external --sourcemap --outfile=dist/server.cjs` — bundles the full-stack server.

### 1.2 Start Production Server
```bash
npm start
```
Starts the bundled server on `PORT` (defaults to `3000`).

---

## 2. Docker & Container Deployment

### Production `Dockerfile`
```dockerfile
FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/mock_database.json ./
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 3. Cloud Run / Container Platforms

When deploying to Google Cloud Run or AWS ECS:
1. **Container Port**: Set to `3000`.
2. **Memory & CPU**: Minimum 1 GiB RAM and 1 vCPU recommended.
3. **Request Timeout**: Set to 300 seconds.
4. **Environment Variables**: Configure secrets securely using Cloud Secret Manager or platform environment configuration:
   - `JWT_SECRET`
   - `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` (or `MYSQL_*`)
   - `MTN_MOMO_*` & `AIRTEL_*`
   - `VAT_PERCENTAGE=5`
   - `ARTIST_SHARE_PERCENTAGE=70`

---

## 4. Reverse Proxy & Domain Configuration (Nginx)

```nginx
server {
    listen 80;
    server_name paytune.rw www.paytune.rw;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name paytune.rw www.paytune.rw;

    ssl_certificate /etc/letsencrypt/live/paytune.rw/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/paytune.rw/privkey.pem;

    client_max_body_size 50M;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```
