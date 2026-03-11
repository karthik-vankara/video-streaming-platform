# Quickstart: Video Streaming Platform

**Branch**: `001-video-streaming-platform` | **Plan**: [plan.md](plan.md)

---

## Prerequisites

| Tool | Version | Check |
|------|---------|-------|
| Java | 21+ | `java --version` |
| Maven | 3.8+ | `mvn --version` |
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| FFmpeg | 5+ | `ffmpeg -version` |
| Docker | 20+ | `docker --version` |
| Docker Compose | v2+ | `docker compose version` |

### Install FFmpeg (macOS)

```bash
brew install ffmpeg
```

---

## Environment Variables

Create a `.env` file at the repository root:

```env
# PostgreSQL
DATABASE_URL=jdbc:postgresql://localhost:5432/videoplatform
DB_USERNAME=postgres
DB_PASSWORD=postgres

# Cloudflare R2
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<your-r2-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-secret-key>
R2_BUCKET_NAME=video-platform
R2_PUBLIC_URL=https://pub-<hash>.r2.dev

# Worker
WORKER_POLL_INTERVAL_MS=10000
FFMPEG_PATH=/opt/homebrew/bin/ffmpeg

# Frontend
VITE_API_BASE_URL=http://localhost:8080/api/v1
```

> Replace `R2_*` values with your Cloudflare dashboard credentials. To find them:
> 1. Go to **Cloudflare Dashboard → R2 → Overview**
> 2. Click **Manage R2 API Tokens** to create access keys
> 3. Create a bucket called `video-platform` with **public access enabled** via r2.dev subdomain

---

## Option A: Docker Compose (Recommended)

Start all services with one command:

```bash
docker compose up --build
```

This starts:

| Service | Port | URL |
|---------|------|-----|
| Backend API | 8080 | http://localhost:8080/api/v1/videos |
| Worker | — | Runs on poll loop (no HTTP port) |
| Frontend | 5173 | http://localhost:5173 |
| PostgreSQL | 5432 | — |

To stop:

```bash
docker compose down
```

---

## Option B: Run Services Individually

### 1. Start PostgreSQL

```bash
docker run -d \
  --name videoplatform-db \
  -e POSTGRES_DB=videoplatform \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -p 5432:5432 \
  postgres:16-alpine
```

### 2. Start Backend API

```bash
cd backend
mvn spring-boot:run
```

The backend runs on **http://localhost:8080**. Flyway applies database migrations on startup.

### 3. Start Worker

```bash
cd worker
mvn spring-boot:run
```

The worker begins polling for `UPLOADED` videos every 10 seconds.

### 4. Start Frontend

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on **http://localhost:5173**.

---

## Verify Setup

### 1. Health Check

```bash
curl http://localhost:8080/api/v1/videos
```

Expected: `{ "data": { "content": [], "page": 0, "size": 20, "totalElements": 0, "totalPages": 0 }, "error": null }`

### 2. Upload Flow Test

1. Open **http://localhost:5173** in your browser
2. Navigate to the **Upload** page
3. Select an MP4 file (< 500 MB)
4. Enter a title and click Upload
5. Watch the video list page — status should progress: `UPLOADING → UPLOADED → PROCESSING → READY`
6. Click on the video to open the player — HLS playback should start within 5 seconds

### 3. Check Worker Logs

```bash
# Docker Compose
docker compose logs -f worker

# Individual
# Check terminal where worker mvn spring-boot:run is running
```

Look for log lines like:

```
Picked up video a1b2c3d4... for processing
Transcoding 360p... done (12s)
Transcoding 720p... done (18s)
Generating thumbnail... done
Video a1b2c3d4... processing complete → READY
```

---

## Common Issues

| Symptom | Cause | Fix |
|---------|-------|-----|
| `ffmpeg: command not found` | FFmpeg not installed or not in PATH | Install FFmpeg; set `FFMPEG_PATH` in env |
| Upload fails with CORS error | Backend CORS not matching frontend origin | Check `Access-Control-Allow-Origin` in backend config |
| Video stuck in `UPLOADED` | Worker not running or not polling | Start the worker; check `WORKER_POLL_INTERVAL_MS` |
| Video stuck in `PROCESSING` | FFmpeg crashed or R2 upload failed | Check worker logs; retry via `POST /api/v1/videos/{id}/retry` |
| R2 presigned URL 403 | R2 credentials wrong or bucket doesn't exist | Verify `R2_*` env vars; create bucket in Cloudflare dashboard |
| Frontend blank page | `VITE_API_BASE_URL` not set | Set env var and restart `npm run dev` |

---

## Project Structure Reference

```
video-streaming-platform/
├── backend/          # Spring Boot API (port 8080)
├── worker/           # Spring Boot Worker (FFmpeg processing)
├── frontend/         # React + Vite SPA (port 5173)
├── docker-compose.yml
├── .env
└── specs/            # Design documents
```

See [plan.md — Project Structure](plan.md) for detailed package layout.
