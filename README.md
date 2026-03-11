# Video Streaming Platform

A full-stack video upload, processing, and streaming platform built with **Spring Boot, React, FFmpeg, and Cloudflare R2**. Upload a video and watch it stream via adaptive HLS bitrate in real-time.

**Hosted demo:** https://video-streaming-platform-production-3f7a.up.railway.app/


**Branch**: `001-video-streaming-platform` | **Status**: ✅ Fully Implemented

---

## Features

### 📤 Upload Videos
- Direct-to-R2 presigned URL uploads (file never touches backend)
- Real-time upload progress tracking
- Supported formats: MP4, MOV, AVI, WebM
- Maximum size: 500 MB

### ⚙️ Automatic Processing
- Multi-resolution transcoding: **360p** (CRF 28) + **720p** (CRF 23)
- Automatic thumbnail extraction (2-second mark, with first-frame fallback)
- Master HLS playlist generation
- 6-second segment chunking for optimal streaming

### 🎬 Adaptive Streaming
- HLS adaptive bitrate playback with hls.js
- Safari native HLS fallback
- Automatic quality switching based on bandwidth
- Real-time playback controls

### 📋 Video Management
- Paginated video library with newest-first sorting
- Status indicators (UPLOADING, PROCESSING, READY, FAILED)
- Video retry for failed processing
- Thumbnail previews for ready videos

### 🔄 Workflow Status Tracking
- 5-state lifecycle: `UPLOADING → UPLOADED → PROCESSING → READY / FAILED`
- Real-time status updates
- Safe concurrent processing with `SELECT FOR UPDATE SKIP LOCKED`

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 18.3, TypeScript, Vite 6, hls.js 1.6, React Router v7 |
| **Backend API** | Spring Boot 3.4.3, Java 21, Spring Data JPA, Flyway |
| **Worker** | Spring Boot 3.4.3, Java 21, FFmpeg 5+, ProcessBuilder |
| **Database** | PostgreSQL 16 (HikariCP connection pool) |
| **Storage** | Cloudflare R2 (S3-compatible with presigned URLs) |
| **Deployment** | Docker, Docker Compose, Railway (recommended) |

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

### Install FFmpeg

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows (Chocolatey):**
```powershell
choco install ffmpeg
```

---

## Environment Variables

Create a `.env` file at the repository root:

```env
# ── Cloudflare R2 (REQUIRED) ──
R2_ACCOUNT_ID=<your-cloudflare-account-id>
R2_ACCESS_KEY_ID=<your-r2-api-token-access-key>
R2_SECRET_ACCESS_KEY=<your-r2-api-token-secret-key>
R2_BUCKET_NAME=video-platform
R2_PUBLIC_URL=https://pub-<your-hash>.r2.dev

# ── PostgreSQL (defaults work with docker-compose) ──
DATABASE_URL=jdbc:postgresql://localhost:5432/videoplatform
PGUSER=postgres
PGPASSWORD=postgres

# ── Worker (defaults are fine) ──
WORKER_POLL_INTERVAL=15000
FFMPEG_PATH=ffmpeg
FFPROBE_PATH=ffprobe
```

### Get R2 Credentials

1. Go to **Cloudflare Dashboard → R2 → Overview**
2. **Create a bucket** named `video-platform`
3. In bucket **Settings**, enable **Public Access** (r2.dev subdomain) — copy the public URL
4. Go to **R2 → Manage R2 API Tokens → Create API Token**
5. Grant **Object Read & Write** on `video-platform`
6. Copy **Access Key ID** and **Secret Access Key**
7. Find **Account ID** in dashboard URL: `https://dash.cloudflare.com/<ACCOUNT_ID>/r2`

### Configure R2 CORS

In R2 bucket **Settings → CORS**:

```json
[{
  "AllowedOrigins": ["http://localhost:5173", "http://localhost:3000"],
  "AllowedMethods": ["GET", "PUT", "HEAD"],
  "AllowedHeaders": ["Content-Type", "Content-Length"],
  "MaxAgeSeconds": 3600
}]
```

---

## Quick Start

### Option A: Docker Compose (Recommended)

```bash
# Start all services
docker compose up --build

# Stop all services
docker compose down -v  # -v removes volumes
```

Services will be available at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8080/api/v1
- **PostgreSQL**: localhost:5432

### Option B: Local Development (Separate Terminals)

**Terminal 1 — PostgreSQL:**
```bash
docker compose up db -d
```

**Terminal 2 — Backend API:**
```bash
cd backend
export $(grep -v '^#' ../.env | xargs)
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

**Terminal 3 — Worker:**
```bash
cd worker
export $(grep -v '^#' ../.env | xargs)
./mvnw spring-boot:run
# Polling starts immediately
```

**Terminal 4 — Frontend:**
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

---

## Testing the Full Flow

### Health Check

```bash
curl http://localhost:8080/api/v1/videos
```

Expected response:
```json
{
  "data": {
    "content": [],
    "page": 0,
    "size": 20,
    "totalElements": 0,
    "totalPages": 0
  },
  "error": null
}
```

### End-to-End Upload & Playback Test

1. **Open frontend**: http://localhost:5173 (or http://localhost:3000 with Docker)

2. **Upload a video**:
   - Click **Upload** page
   - Enter title and optional description
   - Select a video file (MP4, MOV, AVI, WebM) < 500 MB
   - Click **Upload**
   - Watch progress bar

3. **Monitor status**:
   - Go to **Videos** page
   - Watch status change:
     - `UPLOADING` → upload to R2 completes
     - `UPLOADED` → backend confirms receipt
     - `PROCESSING` → worker picks it up (within 15 seconds)
     - `READY` → transcoding, thumbnail, and master playlist complete

4. **Play the video**:
   - Click on a READY video card
   - HLS adaptive playback should start within 5 seconds
   - Verify multiple bitrates available (360p, 720p)

5. **Check logs**:
   ```bash
   # Docker Compose
   docker compose logs -f worker
   docker compose logs -f backend

   # Local runs — check terminal windows
   ```

### Test Retry Flow

1. Upload a video
2. While processing, check worker logs for errors
3. If video transitions to `FAILED`:
   - Click the failed video
   - Click **Retry Processing** button
   - Worker re-processes immediately

---

## API Endpoints

All endpoints use response envelope: `{ "data": ..., "error": ... }`

### Videos

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/v1/videos` | Create video and get presigned upload URL |
| POST | `/api/v1/videos/{id}/complete` | Mark upload complete, transition to UPLOADED |
| POST | `/api/v1/videos/{id}/retry` | Retry failed video (FAILED → UPLOADED) |
| GET | `/api/v1/videos` | List videos (paginated, newest first) |
| GET | `/api/v1/videos/{id}` | Get video details with streams |

### Query Parameters

| Endpoint | Parameter | Type | Default |
|----------|-----------|------|---------|
| GET /videos | `page` | int | 0 |
| GET /videos | `size` | int | 20 |

### Example Requests

**Upload:**
```bash
curl -X POST http://localhost:8080/api/v1/videos \
  -H "Content-Type: application/json" \
  -d '{
    "title": "My Video",
    "description": "A test video",
    "fileName": "video.mp4",
    "fileSize": 52428800,
    "contentType": "video/mp4"
  }'
```

**Complete Upload:**
```bash
curl -X POST http://localhost:8080/api/v1/videos/{videoId}/complete
```

**List Videos:**
```bash
curl http://localhost:8080/api/v1/videos?page=0&size=20
```

---

## Architecture

### System Components

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER BROWSER                                 │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  React SPA (Frontend)                                       │   │
│  │  • Upload Page (with presigned URL flow)                   │   │
│  │  • Video List (paginated, status-aware)                    │   │
│  │  • HLS Player (hls.js adaptive bitrate)                    │   │
│  │  • Navigation & routing (React Router v7)                  │   │
│  └─────────────────────────────────────────────────────────────┘   │
└─────────────────┬──────────────────────────────────┬─────────────────┘
                  │ HTTP REST API                     │ Direct S3 PUT
                  │ (JSON, CORS-enabled)              │ (via presigned URL)
        ┌─────────▼──────────┐                ┌──────▼───────────────┐
        │                    │                │                      │
        │  BACKEND API       │                │   CLOUDFLARE R2      │
        │ (Spring Boot 3.4)  │                │   (Object Storage)   │
        │                    │                │                      │
        │ • REST Endpoints   │                │ • videos/original/   │
        │ • Request Validate │                │ • videos/processed/  │
        │ • Video CRUD       │                │ • videos/thumbnails/ │
        │ • R2 Presigner     │                │ • Public r2.dev URL  │
        │ • Entity Mapping   │                │                      │
        └─────────┬──────────┘                └──────────────────────┘
                  │
        ┌─────────▼──────────────────────────────────┐
        │                                            │
        │     POSTGRESQL (Database)                  │
        │                                            │
        │  ┌────────────────────────────────────┐   │
        │  │ videos → status, paths, URLs       │   │
        │  │ video_streams → resolution, m3u8   │   │
        │  │ Indexes on status, created_at      │   │
        │  └────────────────────────────────────┘   │
        │                                            │
        └────────────┬───────────────────────────────┘
                     │ Share database
        ┌────────────▼──────────────┐
        │                           │
        │    WORKER SCHEDULER       │
        │ (Spring Boot, @Scheduled) │
        │                           │
        │ • @Scheduled fixedDelay   │
        │ • SELECT FOR UPDATE SKIP  │
        │   LOCKED pattern          │
        │ • Picks next UPLOADED     │
        │   video every 15s         │
        │                           │
        └────────────┬──────────────┘
                     │ Coordinates
        ┌────────────▼──────────────────────────────┐
        │                                           │
        │   VIDEO PROCESSING PIPELINE               │
        │                                           │
        │  1. Download original from R2             │
        │  2. Extract thumbnail (FFmpeg)            │
        │  3. Transcode 360p (H.264, CRF 28)        │
        │  4. Transcode 720p (H.264, CRF 23)        │
        │  5. Generate master.m3u8                  │
        │  6. Upload all to R2                      │
        │  7. Create VideoStream records            │
        │  8. Update status → READY                 │
        │                                           │
        └────────────┬──────────────────────────────┘
                     │
        ┌────────────▼──────────────┐
        │                           │
        │   FFmpeg (LocalProcess)   │
        │                           │
        │ ProcessBuilder execution: │
        │ • 360p cmd + 720p cmd     │
        │ • ~25-35s per 60s video   │
        │ • H.264 + AAC codec       │
        │ • 6s segment chunks       │
        │                           │
        └───────────────────────────┘
```

### Service Responsibilities

| Service | Port | Role |
|---------|------|------|
| **Frontend** | 5173 (dev), 80 (docker) | SPA serving, API proxying, HLS playback |
| **Backend API** | 8080 | HTTP REST endpoints, validation, R2 presigner, DB persistence |
| **Worker** | — (polling only) | Video transcoding orchestration, FFmpeg invocation, status updates |
| **PostgreSQL** | 5432 | Persistent storage for videos and streams metadata |
| **R2** | HTTPS | Original video storage, processed HLS assets, thumbnails, public URLs |

### Deployment Structure

The project uses two distinct deployment modes:

1. **Local development (Docker Compose)**
   - Four separate containers: `db`, `backend`, `worker`, `frontend`.
   - Each Java service has its own image built from a focused Dockerfile.
   - Containers communicate over the default compose network.
   - Useful for development, debugging, and CI integration.

2. **Single‑container production (Railway, other PaaS)**
   - An all‑in‑one root `Dockerfile` builds backend, worker, and frontend in
     three build stages and then packages them together.
   - `supervisord` runs three processes in the final image:
     * Java backend on port **8080**
     * Java worker (no external port) with periodic polling
     * `nginx` serving the SPA on port **3000**, proxying `/api` → backend
   - `deploy/start.sh` is the container entrypoint—it converts the
     `DATABASE_URL`, writes environment variables to `/app/env.sh`, and
     launches `supervisord`.
   - `railway.json` contains `{ "build": { "builder": "dockerfile" } }`
     which forces Railway to use the root Dockerfile instead of auto‑detecting.
   - This single image simplifies deployment to platforms that only allow one
     process per service and avoids cross‑container networking issues.

> Tip: the **Docker Compose** setup is still the recommended way to work
> locally; the single‑container image is specifically for cloud deployment
> (Railway, Heroku, etc.) where you can’t run multiple containers.

### Data Flow — Upload to Playback

```
Step 1: User Initiates Upload
┌─────────────────────────────────┐
│ Frontend: UploadPage.tsx        │
│ • Validate title & filename     │
│ • POST /api/v1/videos ──────┐   │
└─────────────────────────────│───┘
                              │
Step 2: Presigned URL Generation
                              │
                    ┌─────────▼──────────────┐
                    │ Backend: VideoService  │
                    │ • Validate contentType │
                    │ • Create Video entity  │
                    │ • Set status=UPLOADING │
                    │ • S3Presigner.signPut()
                    │ ◄─────────── return URL
                    └────────────────────────┘

Step 3: Direct Browser Upload to R2
┌─────────────────────────────────┐
│ Browser: XMLHttpRequest PUT      │
│ • Upload URL (S3 presigned)     │
│ • File bytes → R2 directly      │
│ • No backend involved           │
│ • Progress events tracked       │
│ • On complete: POST /complete ──┼─────┐
└─────────────────────────────────┘     │
                                        │
Step 4: Mark Upload Complete
                                        │
                              ┌─────────▼──────────────┐
                              │ Backend: VideoService  │
                              │ • Find Video by ID     │
                              │ • Validate state change│
                              │ • Status: UPLOADING→  │
                              │   UPLOADED            │
                              │ • Save to DB          │
                              │ ◄─────────── return OK
                              └────────────────────────┘

Step 5: Worker Picks Up (Polling)
┌──────────────────────────────────┐
│ Worker: VideoProcessingScheduler │
│ • Every 15s: SELECT WHERE status │
│   = 'UPLOADED' FOR UPDATE        │
│ • SKIP LOCKED (concurrent safe)  │
│ ├─ Video found?                  │
│ │  YES → proceed, NO → idle      │
│ └─ Set status = PROCESSING       │
│ • Release lock, start processing │
└────────────┬─────────────────────┘
             │
Step 6: Process Video
             │
    ┌────────▼──────────────────┐
    │ Worker: VideoProcessingService
    │ • Download from R2        │
    │  videos/original/{id}/{fn}│
    │ ├─ Extract thumbnail      │
    │ │  @ 2s mark (fallback 0s)│
    │ │  → thumbnail.jpg        │
    │ │  ├─ Upload to R2:       │
    │ │  │  thumbnails/{id}/    │
    │ │  └─ Store URL in DB     │
    │ ├─ Transcode 360p         │
    │ │  ProcessBuilder:        │
    │ │  ffmpeg -i input.mp4... │
    │ │  → 360p/segment_*.ts    │
    │ │  → 360p/playlist.m3u8   │
    │ ├─ Transcode 720p         │
    │ │  (same for 720p)        │
    │ ├─ Generate master.m3u8   │
    │ │  #EXTM3U               │
    │ │  #EXT-X-STREAM-INF:... │
    │ │  360p/playlist.m3u8     │
    │ │  720p/playlist.m3u8     │
    │ ├─ Upload all to R2:      │
    │ │  processed/{id}/*.ts    │
    │ │  processed/{id}/*.m3u8  │
    │ ├─ Create VideoStream     │
    │ │  records in DB          │
    │ │  - resolution: "360p"   │
    │ │  - playlistUrl: public  │
    │ │  - resolution: "720p"   │
    │ └─ Set status = READY     │
    │    (or FAILED on error)   │
    └────────┬──────────────────┘
             │
Step 7: Frontend Fetches & Renders
             │
    ┌────────▼──────────────────┐
    │ Frontend: VideoPlayerPage │
    │ • GET /api/v1/videos/{id} │
    ├─ Response includes:       │
    │  - status: "READY"        │
    │  - masterPlaylistUrl: "..." (public r2.dev URL)
    │  - streams: [{res: "360p", url...}, ...]
    │ • Render VideoPlayer      │
    │  component with URL       │
    └────────┬──────────────────┘
             │
Step 8: HLS Streaming
             │
    ┌────────▼──────────────────┐
    │ Browser: hls.js Player    │
    │ • Load master.m3u8        │
    │ • Parse bandwidth variants│
    │ • Adaptive bitrate select │
    │ • Download segments       │
    │ • <video> element plays   │
    │ • Monitor buffer & switch │
    │   quality as needed       │
    └───────────────────────────┘
```

### Database Schema

**Videos Table (11 columns):**
```sql
CREATE TABLE videos (
    id UUID PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL,           -- UPLOADING | UPLOADED | PROCESSING | READY | FAILED
    original_storage_key VARCHAR(500),     -- videos/original/{id}/{filename}
    thumbnail_url VARCHAR(500),            -- https://pub-....r2.dev/videos/thumbnails/{id}/...
    master_playlist_url VARCHAR(500),      -- https://pub-....r2.dev/videos/processed/{id}/master.m3u8
    file_size BIGINT,
    content_type VARCHAR(100),             -- video/mp4, video/quicktime, etc.
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);

-- Indexes for common queries
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
```

**Video Streams Table (5 columns):**
```sql
CREATE TABLE video_streams (
    id UUID PRIMARY KEY,
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    resolution VARCHAR(10) NOT NULL,      -- "360p", "720p"
    playlist_url VARCHAR(500) NOT NULL,   -- https://pub-....r2.dev/videos/processed/{id}/{resolution}/playlist.m3u8
    created_at TIMESTAMP NOT NULL
);

CREATE INDEX idx_video_streams_video_id ON video_streams(video_id);
```

**Status State Machine:**
```
    ┌─────────────┐
    │  UPLOADING  │   User uploading file to R2
    └──────┬──────┘   via presigned URL
           │
           ▼
    ┌─────────────┐
    │  UPLOADED   │   File in R2, backend confirmed
    └──────┬──────┘   Ready for processing
           │
           ▼
    ┌─────────────┐
    │ PROCESSING  │   Worker transcoding, uploading assets
    └──────┬──────┘   (HLS, thumbnail, master playlist)
           │
      ┌────┴────┐
      │          │
      ▼          ▼
  ┌─────────┐  ┌──────────┐
  │  READY  │  │  FAILED  │
  └─────────┘  └────┬─────┘
                    │
                    └──────► Retry: FAILED → UPLOADED
  (can stream)         (re-process)
```

### Concurrency & Scalability

**Worker Polling Safety:**
```sql
SELECT * FROM videos 
WHERE status = 'UPLOADED' 
FOR UPDATE SKIP LOCKED 
LIMIT 1;
```
- `FOR UPDATE` acquires row lock
- `SKIP LOCKED` allows other workers to skip locked rows and process different videos
- Multiple workers can run safely without duplicate processing
- No busy-wait; workers poll every 15 seconds

**Connection Pooling:**
- HikariCP manages 5 PostgreSQL connections (configurable)
- Backend shares same DB as Worker
- Connection timeout: 30s
- Idle timeout: 10 min

**Performance Characteristics:**

| Operation | Duration | Notes |
|-----------|----------|-------|
| Presigned URL Gen | <100ms | Local crypto, R2 auth token |
| Thumbnail Extract | ~2-5s | FFmpeg 2s seek + encoding |
| 360p Transcode | ~8-12s | 60s video at CRF 28 (lower quality, fast) |
| 720p Transcode | ~15-25s | 60s video at CRF 23 (higher quality) |
| Master m3u8 Gen | <100ms | Text generation + S3 PUT |
| Full Pipeline | ~30-45s | Per 60s video (parallel transcodes) |
| Segment Upload | ~1-2s | Per resolution batch (vectorized) |

**Scalability Approach:**
1. **Horizontal scaling**: Add more Worker instances (polling with SKIP LOCKED)
2. **HLS streaming**: CDN-friendly (segmented, static assets)
3. **Presigned URLs**: Direct browser→R2 offloads backend bandwidth
4. **Status polling**: Lightweight, no webhooks/callbacks needed

### R2 Storage Structure

```
bucket-name/
├── videos/
│   ├── original/{videoId}/{originalFilename}
│   │   └── Raw file uploaded by user
│   │       (accessed only by Worker to download)
│   │
│   ├── processed/{videoId}/
│   │   ├── master.m3u8
│   │   │   └── Lists both resolutions, browser-accessible
│   │   │       #EXTM3U
│   │   │       #EXT-X-STREAM-INF:BANDWIDTH=1000000
│   │   │       360p/playlist.m3u8
│   │   │       #EXT-X-STREAM-INF:BANDWIDTH=3000000
│   │   │       720p/playlist.m3u8
│   │   │
│   │   ├── 360p/
│   │   │   ├── playlist.m3u8 (6-second segments)
│   │   │   ├── segment___0-600000_.ts  
│   │   │   ├── segment___600000-1200000_.ts
│   │   │   └── ...
│   │   │
│   │   └── 720p/
│   │       ├── playlist.m3u8 (6-second segments)
│   │       ├── segment___0-600000_.ts
│   │       ├── segment___600000-1200000_.ts
│   │       └── ...
│   │
│   └── thumbnails/{videoId}/
│       └── thumbnail.jpg
│           └── JPEG from 2-second mark (or start if shorter)
│               Displayed in video grid on UI
```

**Access Control:**
```
original/  → Private (referenced in presigned URLs, not exposed via public URL)
processed/ → Public (r2.dev URLs returned in API response)
thumbnails/→ Public (r2.dev URLs returned in API response)
```

**URL Examples:**
```
Presigned Upload: https://accountid.r2.cloudflarestorage.com/videos/original/{id}/{name}?X-Amz-Signature=...
Public Access:    https://pub-{random}.r2.dev/videos/processed/{id}/master.m3u8
Thumbnail:        https://pub-{random}.r2.dev/videos/thumbnails/{id}/thumbnail.jpg
```

---

## Deployment

### Local Docker Compose (Development)

All three services run locally with `docker-compose up`:

```
Services:
  - PostgreSQL (5432): Persists videos and streams metadata
  - Backend (8080): REST API for video CRUD and presigned URLs
  - Worker (no port): Polls for UPLOADED videos and transcodes
  - Frontend (5173): React SPA served by Vite dev server
```

**Health Checks:**
- Backend waits for PostgreSQL to be healthy (`pg_isready`)
- Worker waits for Backend to be healthy (`curl /api/v1/videos`)
- Frontend can fetch from Backend API once available

### Railway Deployment (Production)

Railway provides git-based auto-deploy with Docker support.

**Step 1: Create Railway Project**
```bash
npm i -g @railway/cli
railway login
railway init
```

**Step 2: Connect to GitHub (Recommended)**
- Push code to GitHub
- In Railway dashboard: `New Project` → `Deploy from GitHub`
- Select repository and optional environment variables

**Step 3: Configure Environment Variables**

In Railway dashboard → Variables:
```
# Cloudflare R2
R2_ACCOUNT_ID=<your-account-id>
R2_ACCESS_KEY_ID=<your-access-key>
R2_SECRET_ACCESS_KEY=<your-secret-key>
R2_BUCKET_NAME=video-platform
R2_PUBLIC_URL=https://pub-<random>.r2.dev

# Database (auto-injected by Railway)
DATABASE_URL=postgres://...

# Application
SPRING_PROFILES_ACTIVE=production
```

**Step 4: Provision PostgreSQL Service**

From Railway → Database Plugin:
1. Click `+ New` → Search "PostgreSQL"
2. Add PostgreSQL 16
3. Railway auto-injects `DATABASE_URL` for your services

**Step 5: Deploy Services**

Railway auto-detects `docker-compose.yml` and builds all services:

```yaml
services:
  backend:
    build: ./backend
    environment:
      DATABASE_URL: ${DATABASE_URL}
      R2_ACCOUNT_ID: ${R2_ACCOUNT_ID}
      ...
    ports:
      - "8080:8080"
    healthcheck: curl /api/v1/videos

  worker:
    build: ./worker
    depends_on:
      backend:
        condition: service_healthy
    environment:
      DATABASE_URL: ${DATABASE_URL}
      ...

  frontend:
    build: ./frontend
    environment:
      VITE_API_URL: https://your-backend.railway.app/api/v1
    ports:
      - "3000:80"
    depends_on:
      backend:
        condition: service_healthy
```

**Step 6: Monitor Deployment**

```bash
railway logs                # Stream logs from all services
railway status             # Check service health
railway open               # Open Railway dashboard
```

**Step 7: Test Deployed Application**

Frontend: `https://your-frontend.railway.app`
Backend API: `https://your-backend.railway.app/api/v1`

---

## Troubleshooting

| Issue | Cause | Fix |
|-------|-------|-----|
| `ffmpeg: command not found` | FFmpeg not in PATH | Install FFmpeg; set `FFMPEG_PATH` env var |
| PostgreSQL role error | Local Postgres occupying port 5432 | `brew services stop postgresql@14` |
| CORS error on upload | Frontend origin not in R2 CORS | Add origin to R2 bucket CORS settings |
| Video stuck in UPLOADED | Worker not running or poll interval too high | Start worker; reduce `WORKER_POLL_INTERVAL` |
| Video stuck in PROCESSING | FFmpeg crash or R2 write failed | Check worker logs; check R2 credentials |
| R2 presigned URL 403 | Wrong credentials or bucket | Verify `R2_*` env vars; check bucket exists |
| Frontend blank | API base URL not configured | Set correct API URL (default: `http://localhost:8080/api/v1`) |
| Playback error in Safari | Master playlist CORS issue | Verify R2 CORS allows `GET`, `HEAD` |

---

## Performance Notes

### Encoding Presets

- **360p**: CRF 28, 2500k max bitrate → smaller file, acceptable quality
- **720p**: CRF 23, 5000k max bitrate → better quality, larger file
- Both use H.264 (libx264) `medium` preset for speed/quality balance

### Processing Time (Approximate)

- **60-second video**:
  - 360p transcode: ~8–12 seconds
  - 720p transcode: ~15–20 seconds
  - Thumbnail extraction: ~1 second
  - Total: ~25–35 seconds

- Faster with:
  - SSD storage
  - More CPU cores
  - Lower resolutions

### Database Connections

- Default HikariCP pool: 5 connections
- Environment: `HIKARI_MAX_POOL=5`
- Safe for Railway Hobby tier (~$5–7/month combined)

---

## Development Workflow

### Build

```bash
# Backend
cd backend && ./mvnw clean package

# Worker
cd worker && ./mvnw clean package

# Frontend
cd frontend && npm run build
```

### Local Linting

```bash
# Frontend TypeScript
cd frontend && npx tsc --noEmit

# Backend (Maven)
cd backend && ./mvnw spotbugs:check
```

### Adding a New Feature

1. Update [specs/001-video-streaming-platform/spec.md](specs/001-video-streaming-platform/spec.md) with FR (Functional Requirement)
2. Create a task in [specs/001-video-streaming-platform/tasks.md](specs/001-video-streaming-platform/tasks.md)
3. Implement in backend, worker, or frontend
4. Test locally with docker-compose
5. Commit with reference to task ID: `feat: implement [taskId] description`

---

## File Structure

```
video-streaming-platform/
├── backend/                    # Spring Boot API
│   ├── src/main/java/com/videoplatform/
│   │   ├── controller/         # REST endpoints
│   │   ├── service/            # Business logic
│   │   ├── model/              # JPA entities
│   │   ├── repository/         # Data access
│   │   ├── dto/                # Request/response DTOs
│   │   ├── exception/          # Error handling
│   │   └── config/             # R2, CORS config
│   ├── src/main/resources/
│   │   ├── application.yml     # Config
│   │   └── db/migration/       # Flyway migrations
│   └── pom.xml
│
├── worker/                     # Spring Boot Worker
│   ├── src/main/java/com/videoplatform/worker/
│   │   ├── model/              # Entities
│   │   ├── repository/         # Data access
│   │   ├── service/            # Processing service
│   │   ├── processing/         # FFmpeg service
│   │   ├── storage/            # R2 service
│   │   └── config/             # R2 config
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   └── db/migration/
│   └── pom.xml
│
├── frontend/                   # React + Vite
│   ├── src/
│   │   ├── pages/              # Upload, List, Player
│   │   ├── components/         # StatusBadge, VideoPlayer
│   │   ├── services/           # API client
│   │   ├── types/              # TypeScript interfaces
│   │   └── App.tsx             # Routes
│   ├── vite.config.ts
│   ├── tsconfig.json
│   └── package.json
│
├── specs/
│   └── 001-video-streaming-platform/
│       ├── spec.md             # 37 FRs, 4 user stories
│       ├── plan.md             # Architecture, tech stack
│       ├── data-model.md       # Schema
│       ├── contracts/
│       │   └── api.md          # Endpoint specs
│       ├── research.md         # Implementation decisions
│       ├── quickstart.md       # Setup guide
│       ├── tasks.md            # 49 implementation tasks
│       └── checklists/
│           └── requirements.md # Verification checklist
│
├── docker-compose.yml          # All services
├── .env                        # Environment variables
├── .gitignore
└── README.md                   # This file
```

---

## Contributing

1. Read [specs/001-video-streaming-platform/spec.md](specs/001-video-streaming-platform/spec.md)
2. Pick a task from [tasks.md](specs/001-video-streaming-platform/tasks.md)
3. Implement and test locally
4. Commit with reference to task ID
5. Push and create pull request

---

## License

MIT

---

## Authors

Built with SpecKit workflow system and GitHub Copilot By `Karthik Vankara`.

**Started**: 2026-03-10 | **Status**: ✅ Complete (49/49 tasks)
