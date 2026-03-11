# API Contract: Video Streaming Platform

**Base URL**: `/api/v1`
**Response Envelope**: All responses use `{ "data": ..., "error": ... }` structure.
**Content-Type**: `application/json` (all requests and responses)

---

## 1. Create Video — `POST /api/v1/videos`

Creates a new video record and returns a presigned URL for direct upload to R2.

### Request

```json
{
  "title": "My Video Title",
  "description": "Optional description of the video",
  "fileName": "my-video.mp4",
  "fileSize": 52428800,
  "contentType": "video/mp4"
}
```

| Field | Type | Required | Validation |
|-------|------|----------|------------|
| `title` | `string` | YES | 1–255 characters, non-blank |
| `description` | `string` | NO | Max 5000 characters |
| `fileName` | `string` | YES | Non-blank, used to construct storage key |
| `fileSize` | `long` | YES | > 0 and ≤ 524288000 (500 MB) |
| `contentType` | `string` | YES | Must be one of: `video/mp4`, `video/quicktime`, `video/x-msvideo`, `video/webm` |

### Response — `201 Created`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "My Video Title",
    "description": "Optional description of the video",
    "status": "UPLOADING",
    "uploadUrl": "https://account-id.r2.cloudflarestorage.com/video-platform/videos/original/a1b2c3d4.../my-video.mp4?X-Amz-...",
    "createdAt": "2026-03-10T14:30:00Z"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.id` | `string (UUID)` | Unique identifier for the video |
| `data.title` | `string` | As submitted |
| `data.description` | `string \| null` | As submitted or null |
| `data.status` | `string` | Always `"UPLOADING"` on creation |
| `data.uploadUrl` | `string` | Presigned PUT URL; expires in 15 minutes |
| `data.createdAt` | `string (ISO 8601)` | Record creation timestamp |

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400` | Missing/invalid title, fileName, fileSize, or contentType | `{ "data": null, "error": "Title is required" }` |
| `400` | Unsupported content type | `{ "data": null, "error": "Unsupported file type. Accepted: video/mp4, video/quicktime, video/x-msvideo, video/webm" }` |
| `400` | File size exceeds 500 MB | `{ "data": null, "error": "File size exceeds maximum of 500 MB" }` |

### Frontend Upload Flow

After receiving the response:

1. Extract `uploadUrl` from `data.uploadUrl`
2. `PUT` the file to `uploadUrl` with `Content-Type` matching the submitted `contentType`
3. On successful PUT (HTTP 200), call `POST /api/v1/videos/{id}/complete`

---

## 2. Complete Upload — `POST /api/v1/videos/{id}/complete`

Marks a video upload as complete. Transitions status from `UPLOADING` to `UPLOADED`. The worker will pick it up on the next poll cycle.

### Request

No request body. The video ID is in the URL path.

### Response — `200 OK`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "My Video Title",
    "description": "Optional description of the video",
    "status": "UPLOADED",
    "createdAt": "2026-03-10T14:30:00Z",
    "updatedAt": "2026-03-10T14:32:00Z"
  },
  "error": null
}
```

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `404` | Video ID not found | `{ "data": null, "error": "Video not found" }` |
| `409` | Video is not in UPLOADING status | `{ "data": null, "error": "Video cannot be completed — current status: PROCESSING" }` |

---

## 3. Retry Failed Video — `POST /api/v1/videos/{id}/retry`

Retries processing of a failed video. Transitions status from `FAILED` to `UPLOADED` so the worker picks it up again.

### Request

No request body.

### Response — `200 OK`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "My Video Title",
    "status": "UPLOADED",
    "updatedAt": "2026-03-10T15:00:00Z"
  },
  "error": null
}
```

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `404` | Video ID not found | `{ "data": null, "error": "Video not found" }` |
| `409` | Video is not in FAILED status | `{ "data": null, "error": "Only failed videos can be retried — current status: READY" }` |

---

## 4. List Videos — `GET /api/v1/videos`

Returns a paginated list of all videos, ordered by creation date descending (newest first).

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | `int` | `0` | Zero-based page number |
| `size` | `int` | `20` | Page size (1–100) |

### Response — `200 OK`

```json
{
  "data": {
    "content": [
      {
        "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "title": "My Video Title",
        "description": "Optional description",
        "status": "READY",
        "thumbnailUrl": "https://pub-hash.r2.dev/videos/thumbnails/a1b2c3d4....jpg",
        "createdAt": "2026-03-10T14:30:00Z"
      },
      {
        "id": "f9e8d7c6-b5a4-3210-fedc-ba0987654321",
        "title": "Another Video",
        "description": null,
        "status": "PROCESSING",
        "thumbnailUrl": null,
        "createdAt": "2026-03-10T13:00:00Z"
      }
    ],
    "page": 0,
    "size": 20,
    "totalElements": 42,
    "totalPages": 3
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.content` | `array` | List of video summaries |
| `data.content[].id` | `string (UUID)` | Video identifier |
| `data.content[].title` | `string` | Video title |
| `data.content[].description` | `string \| null` | Video description |
| `data.content[].status` | `string` | One of: `UPLOADING`, `UPLOADED`, `PROCESSING`, `READY`, `FAILED` |
| `data.content[].thumbnailUrl` | `string \| null` | Public thumbnail URL (null if not yet processed) |
| `data.content[].createdAt` | `string (ISO 8601)` | Upload timestamp |
| `data.page` | `int` | Current page number (zero-based) |
| `data.size` | `int` | Requested page size |
| `data.totalElements` | `long` | Total number of videos |
| `data.totalPages` | `int` | Total number of pages |

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `400` | Invalid page or size parameter | `{ "data": null, "error": "Page size must be between 1 and 100" }` |

---

## 5. Get Video Details — `GET /api/v1/videos/{id}`

Returns full metadata for a single video, including its transcoded streams when available.

### Response — `200 OK`

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "My Video Title",
    "description": "Optional description of the video",
    "status": "READY",
    "thumbnailUrl": "https://pub-hash.r2.dev/videos/thumbnails/a1b2c3d4....jpg",
    "masterPlaylistUrl": "https://pub-hash.r2.dev/videos/processed/a1b2c3d4.../master.m3u8",
    "fileSize": 52428800,
    "contentType": "video/mp4",
    "streams": [
      {
        "id": "11112222-3333-4444-5555-666677778888",
        "resolution": "360p",
        "playlistUrl": "https://pub-hash.r2.dev/videos/processed/a1b2c3d4.../360p/playlist.m3u8"
      },
      {
        "id": "99998888-7777-6666-5555-444433332222",
        "resolution": "720p",
        "playlistUrl": "https://pub-hash.r2.dev/videos/processed/a1b2c3d4.../720p/playlist.m3u8"
      }
    ],
    "createdAt": "2026-03-10T14:30:00Z",
    "updatedAt": "2026-03-10T14:35:00Z"
  },
  "error": null
}
```

| Field | Type | Description |
|-------|------|-------------|
| `data.id` | `string (UUID)` | Video identifier |
| `data.title` | `string` | Video title |
| `data.description` | `string \| null` | Video description |
| `data.status` | `string` | Current lifecycle status |
| `data.thumbnailUrl` | `string \| null` | Public thumbnail URL |
| `data.masterPlaylistUrl` | `string \| null` | Public master playlist URL (null until READY) |
| `data.fileSize` | `long \| null` | Original file size in bytes |
| `data.contentType` | `string \| null` | MIME type of original file |
| `data.streams` | `array` | List of transcoded stream variants (empty if not yet processed) |
| `data.streams[].id` | `string (UUID)` | Stream identifier |
| `data.streams[].resolution` | `string` | Resolution label: `"360p"` or `"720p"` |
| `data.streams[].playlistUrl` | `string` | Public URL to resolution-specific playlist |
| `data.createdAt` | `string (ISO 8601)` | Record creation time |
| `data.updatedAt` | `string (ISO 8601)` | Last modification time |

### Error Responses

| Status | Condition | Body |
|--------|-----------|------|
| `404` | Video ID not found | `{ "data": null, "error": "Video not found" }` |

---

## CORS Configuration

The backend MUST include CORS headers for cross-origin requests from the frontend (Vercel domain).

| Header | Value |
|--------|-------|
| `Access-Control-Allow-Origin` | Frontend origin (e.g., `https://your-app.vercel.app`) |
| `Access-Control-Allow-Methods` | `GET, POST, OPTIONS` |
| `Access-Control-Allow-Headers` | `Content-Type` |

---

## Error Response Format

All errors follow the standard envelope:

```json
{
  "data": null,
  "error": "Human-readable error message"
}
```

HTTP status codes used:

| Code | Usage |
|------|-------|
| `200` | Successful read or update |
| `201` | Successful resource creation |
| `400` | Validation error (bad input) |
| `404` | Resource not found |
| `409` | Conflict (invalid state transition) |
| `500` | Unexpected server error |
