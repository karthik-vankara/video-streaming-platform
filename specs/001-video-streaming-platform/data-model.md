# Data Model: Video Streaming Platform

**Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md) | **Research**: [research.md](research.md)

## Entity Relationship Diagram

```
┌──────────────────────────────┐       ┌──────────────────────────────┐
│           videos             │       │       video_streams          │
├──────────────────────────────┤       ├──────────────────────────────┤
│ id           UUID        PK │──┐    │ id           UUID        PK │
│ title        VARCHAR(255)   │  │    │ video_id     UUID        FK │──┐
│ description  TEXT           │  │    │ resolution   VARCHAR(10)    │  │
│ status       VARCHAR(20)   │  │    │ playlist_url VARCHAR(500)   │  │
│ original_storage_key  V500 │  │    │ created_at   TIMESTAMP      │  │
│ thumbnail_url VARCHAR(500) │  │    └──────────────────────────────┘  │
│ master_playlist_url V500   │  │                                      │
│ file_size    BIGINT        │  │    video_streams.video_id ───────────┘
│ content_type VARCHAR(100)  │  │    REFERENCES videos(id) ON DELETE CASCADE
│ created_at   TIMESTAMP     │  │
│ updated_at   TIMESTAMP     │  │
└──────────────────────────────┘  │
                                   │    0..*
                                   └─────────
```

## Entity: `videos`

Stores metadata and lifecycle state for each uploaded video.

### Fields

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| `title` | `VARCHAR(255)` | NOT NULL | — | User-provided video title |
| `description` | `TEXT` | YES | `NULL` | Optional user-provided description |
| `status` | `VARCHAR(20)` | NOT NULL | `'UPLOADING'` | Current lifecycle state (see State Machine below) |
| `original_storage_key` | `VARCHAR(500)` | YES | `NULL` | R2 object key for the original uploaded file (e.g., `videos/original/{id}/{filename}`) |
| `thumbnail_url` | `VARCHAR(500)` | YES | `NULL` | Public URL to the extracted thumbnail image; set after processing |
| `master_playlist_url` | `VARCHAR(500)` | YES | `NULL` | Public URL to the HLS master playlist (.m3u8); set after processing |
| `file_size` | `BIGINT` | YES | `NULL` | Size of the original uploaded file in bytes |
| `content_type` | `VARCHAR(100)` | YES | `NULL` | MIME type of the original file (e.g., `video/mp4`) |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | Record creation time |
| `updated_at` | `TIMESTAMP` | NOT NULL | `NOW()` | Last modification time (updated on every status change) |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `pk_videos` | `id` | PRIMARY KEY | Identity |
| `idx_videos_status` | `status` | B-TREE | Worker polling: `WHERE status = 'UPLOADED'` |
| `idx_videos_created_at` | `created_at DESC` | B-TREE | List endpoint ordering (newest first) + pagination |

### Constraints

- `title` must not be empty (application-level validation; NOT NULL at DB level).
- `status` must be one of: `UPLOADING`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED` (validated at application level via Java enum; stored as VARCHAR for Flyway simplicity).
- `file_size` must be ≤ 524,288,000 (500 MB) — enforced at application level before presigned URL generation.

## Entity: `video_streams`

Stores one record per transcoded resolution variant of a processed video.

### Fields

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | `UUID` | NOT NULL | `gen_random_uuid()` | Primary key |
| `video_id` | `UUID` | NOT NULL | — | Foreign key to `videos.id` |
| `resolution` | `VARCHAR(10)` | NOT NULL | — | Resolution label: `"360p"` or `"720p"` |
| `playlist_url` | `VARCHAR(500)` | NOT NULL | — | Public URL to the resolution-specific HLS playlist (.m3u8) |
| `created_at` | `TIMESTAMP` | NOT NULL | `NOW()` | Record creation time |

### Indexes

| Name | Columns | Type | Purpose |
|------|---------|------|---------|
| `pk_video_streams` | `id` | PRIMARY KEY | Identity |
| `idx_video_streams_video_id` | `video_id` | B-TREE | JOIN performance when fetching streams for a video |

### Constraints

- `video_id` REFERENCES `videos(id)` ON DELETE CASCADE — deleting a video removes all its stream records.
- `resolution` must be one of: `"360p"`, `"720p"` (application-level validation).
- A video should have at most one stream per resolution (enforced at application level; could add a UNIQUE constraint on `(video_id, resolution)` for safety).

### Relationships

- **videos 1 ⟶ 0..* video_streams**: A video has zero streams when uploading/processing, and one stream per resolution after successful processing.

## State Machine: `videos.status`

```
                ┌──────────┐
                │UPLOADING │
                └────┬─────┘
                     │ POST /videos/{id}/complete
                     ▼
                ┌──────────┐
         ┌─────│ UPLOADED  │◄─────────────────┐
         │     └────┬─────┘                    │
         │          │ Worker picks up           │ POST /videos/{id}/retry
         │          ▼                           │
         │     ┌──────────┐                    │
         │     │PROCESSING│                    │
         │     └──┬────┬──┘                    │
         │        │    │                       │
         │   OK   │    │  Error                │
         │        ▼    ▼                       │
         │  ┌──────┐ ┌──────┐                  │
         │  │READY │ │FAILED│──────────────────┘
         │  └──────┘ └──────┘
         │
```

### Valid Transitions

| From | To | Trigger | Actor |
|------|----|---------|-------|
| `UPLOADING` | `UPLOADED` | Client calls `POST /videos/{id}/complete` | Backend API |
| `UPLOADED` | `PROCESSING` | Worker picks up video from poll | Worker |
| `PROCESSING` | `READY` | Processing completes successfully | Worker |
| `PROCESSING` | `FAILED` | Processing encounters an error | Worker |
| `FAILED` | `UPLOADED` | User triggers retry via `POST /videos/{id}/retry` | Backend API |

All other transitions MUST be rejected by the application.

## Flyway Migration

**File**: `src/main/resources/db/migration/V1__create_schema.sql`

```sql
-- Video metadata and lifecycle
CREATE TABLE videos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                 VARCHAR(255) NOT NULL,
    description           TEXT,
    status                VARCHAR(20) NOT NULL DEFAULT 'UPLOADING',
    original_storage_key  VARCHAR(500),
    thumbnail_url         VARCHAR(500),
    master_playlist_url   VARCHAR(500),
    file_size             BIGINT,
    content_type          VARCHAR(100),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Per-resolution transcoded streams
CREATE TABLE video_streams (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    resolution    VARCHAR(10) NOT NULL,
    playlist_url  VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_video_streams_video_id ON video_streams(video_id);
```

## Storage Key Patterns

These are the R2 object key conventions used in `original_storage_key`, `thumbnail_url`, `playlist_url`, and `master_playlist_url`:

| Asset | Key Pattern | Access |
|-------|-------------|--------|
| Original upload | `videos/original/{videoId}/{filename}` | Private (S3 API only) |
| Master playlist | `videos/processed/{videoId}/master.m3u8` | Public |
| 360p playlist | `videos/processed/{videoId}/360p/playlist.m3u8` | Public |
| 360p segments | `videos/processed/{videoId}/360p/segment_000.ts` | Public |
| 720p playlist | `videos/processed/{videoId}/720p/playlist.m3u8` | Public |
| 720p segments | `videos/processed/{videoId}/720p/segment_000.ts` | Public |
| Thumbnail | `videos/thumbnails/{videoId}.jpg` | Public |

URL fields (`thumbnail_url`, `master_playlist_url`, `playlist_url`) store the **full public URL** (e.g., `https://pub-<hash>.r2.dev/videos/thumbnails/{videoId}.jpg`), while `original_storage_key` stores only the **object key** (private, accessed via S3 API).
