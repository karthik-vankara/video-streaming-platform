<!--
  Sync Impact Report
  ===================
  Version change: N/A → 1.0.0
  Modified principles: N/A (initial constitution)
  Added sections:
    - Core Architecture Principles (6 principles)
    - Technology Stack
    - Video Processing Pipeline
    - Video Status Lifecycle
    - Database Modeling Principles
    - API Design Standards
    - Infrastructure Constraints
    - Deployment Principles
    - Observability
    - Code Organization
    - Security Guidelines
    - Performance Considerations
    - Extensibility Goals
    - Development Philosophy
    - Governance
  Removed sections: N/A
  Templates requiring updates:
    - .specify/templates/plan-template.md ✅ no update needed
    - .specify/templates/spec-template.md ✅ no update needed
    - .specify/templates/tasks-template.md ✅ no update needed
  Follow-up TODOs: None
-->

# Video Streaming Platform Constitution

## Purpose

This repository defines the architecture and implementation
guidelines for a **production-grade video streaming platform**
built as a proof of concept (POC). The system MUST demonstrate
real-world scalable architecture patterns used in modern video
platforms (e.g., YouTube/Netflix) while maintaining **minimal
infrastructure cost**.

The project MUST prioritize:

- Production-grade architecture
- Extensibility
- Low operational cost
- Clear system boundaries
- Maintainable code structure

All implementations MUST reflect industry-standard backend
architecture practices.

## Core Architecture Principles

### I. Separation of Responsibilities

The system MUST be divided into distinct, independently
deployable and scalable layers:

- **Frontend** — User interface and video playback
- **API Layer** — REST endpoints and orchestration
- **Processing Workers** — Async video processing
- **Storage Layer** — Object storage for all media
- **Database Layer** — Relational metadata persistence

Each layer MUST remain independently deployable and scalable.
No layer may directly depend on the internal implementation
details of another layer.

### II. Asynchronous Video Processing

Video processing MUST **never block API requests**.

Video upload MUST trigger asynchronous processing that runs
independently from the API server. Processing tasks include:

- Video transcoding (multi-resolution)
- HLS segment generation
- Thumbnail generation
- Metadata extraction

Workers MUST execute processing jobs outside the API process.

### III. Direct Client Uploads via Presigned URLs

Large file uploads MUST **never pass through the API server**.

Uploads MUST use presigned URLs to store files directly into
object storage. The required flow is:

1. Client requests upload URL from API
2. API generates presigned URL and returns it
3. Client uploads file directly to object storage
4. API triggers the processing job

### IV. Adaptive Streaming (HLS)

Videos MUST be delivered using **HLS streaming** rather than
raw MP4 playback. The system MUST support multiple resolutions:

- 360p (baseline)
- 720p (standard)
- 1080p (future extension)

A master playlist MUST dynamically reference all available
resolution variants.

### V. Object Storage Architecture

All video files MUST be stored in **object storage** — never
on local server disks. Storage MUST follow this structure:

```
videos/
  original/
  processed/{videoId}/
  thumbnails/
```

Processed videos MUST be segmented into HLS format (.m3u8
playlists and .ts segment files).

### VI. CDN-Based Video Delivery

All video playback MUST be delivered through CDN-enabled
storage. Video clients MUST only consume:

- HLS playlists (`.m3u8`)
- Segment files (`.ts`)

This ensures scalable streaming performance without direct
origin server load.

## Technology Stack

### Frontend

- **Framework**: React
- **Deployment**: Vercel
- **Responsibilities**:
  - Video upload interface
  - Video browsing and listing
  - Video playback via `hls.js`

### Backend API

- **Language**: Java
- **Framework**: Spring Boot
- **Deployment**: Railway
- **Responsibilities**:
  - REST API endpoints
  - Authentication (future phase)
  - Metadata management
  - Presigned upload URL generation
  - Processing orchestration

### Worker Service

- **Language**: Java or lightweight service container
- **Responsibilities**:
  - Video transcoding using FFmpeg
  - HLS segment generation
  - Thumbnail extraction
  - Processing status updates

Workers MUST run independently from the API service.

### Database

- **Engine**: PostgreSQL
- **Responsibilities**:
  - Video metadata
  - Processing status tracking
  - Video resolution stream records
  - Upload state tracking

### Object Storage

- **Provider**: Cloudflare R2
- **Responsibilities**:
  - Original uploads
  - HLS segments and playlists
  - Thumbnails

All storage access MUST use S3-compatible APIs.

## Video Processing Pipeline

The platform MUST implement this pipeline:

1. Video upload initiated
2. Metadata record created in database
3. File uploaded to object storage (via presigned URL)
4. Processing job triggered
5. Worker executes FFmpeg transcoding
6. HLS segments generated per resolution
7. Segments uploaded to object storage
8. Video status updated to READY

Each step MUST be logged for observability.

## Video Status Lifecycle

Each video MUST follow a defined state machine with these
states:

- `UPLOADING` — Upload in progress
- `UPLOADED` — File received in storage
- `PROCESSING` — Worker actively transcoding
- `READY` — All streams available for playback
- `FAILED` — Processing encountered an error

The system MUST enforce valid transitions between states.
Invalid state transitions MUST be rejected.

## Database Modeling Principles

All database models MUST follow:

- **UUID primary keys** for all entities
- **Normalized relational design**
- **Audit timestamps** (`created_at`, `updated_at`)
- **Explicit status fields** using enum types

Required entities:

- `Video` — Core video metadata and status
- `VideoStream` — Per-resolution stream references
- `UploadSession` — (optional extension) Upload tracking

## API Design Standards

All APIs MUST follow REST conventions.

- **Base path**: `/api/v1`
- **Standard endpoints**:
  - `POST /videos` — Initiate new video upload
  - `POST /videos/{id}/complete` — Mark upload complete
  - `GET /videos` — List videos
  - `GET /videos/{id}` — Get video details

All responses MUST follow a consistent JSON structure:

```json
{
  "data": {},
  "error": null
}
```

## Infrastructure Constraints

This project MUST remain low-cost and deployable on
free/cheap tiers.

**Approved infrastructure:**

| Component | Provider |
|-----------|----------|
| Frontend | Vercel |
| Backend | Railway |
| Database | PostgreSQL (Neon or Railway) |
| Object Storage | Cloudflare R2 |

**Total infrastructure cost target**: Less than $15/month.

No additional paid services may be introduced without
constitution amendment.

## Deployment Principles

All services MUST be containerized using Docker.

Deployment MUST support:

- Automated CI/CD via GitHub Actions
- Environment-based configuration
- Secure secret management (no secrets in source code)

CI pipeline MUST include:

1. Build
2. Test
3. Docker image build
4. Deploy

## Observability

The system MUST provide basic observability including:

- Structured logging (JSON format preferred)
- Processing pipeline logs
- Error tracking with context

Each major pipeline step MUST log events:

- `video.uploaded`
- `processing.started`
- `processing.completed`
- `processing.failed`

## Code Organization

Backend MUST follow clean architecture principles.

Required package structure:

```
controllers/    — HTTP request handling only
services/       — Business logic
repositories/   — Data access
storage/        — Object storage integration
processing/     — FFmpeg and transcoding logic
workers/        — Async job execution
models/         — Domain entities and DTOs
```

**Business logic MUST never exist inside controllers.**
Controllers MUST only handle request parsing, validation
delegation, and response formatting.

## Security Guidelines

- Uploads MUST be restricted to allowed video MIME types
- A maximum file size limit MUST be enforced
- Presigned URLs MUST have expiration times
- Secrets MUST never be stored in source code
- All environment-specific configuration MUST use
  environment variables or secure vaults

## Performance Considerations

- Large files MUST never be buffered fully in memory
- Streaming uploads and downloads MUST be used
- Workers MUST process videos independently from API
  servers to prevent resource contention
- Database queries MUST use appropriate indexes

## Extensibility Goals

The system MUST be designed to allow future expansion
without major refactoring, including:

- User authentication and authorization
- Comments and likes
- Video search
- Recommendation systems
- Analytics tracking
- AI-generated captions

Database schema and API design MUST accommodate these
features through forward-compatible modeling.

## Development Philosophy

This repository prioritizes:

- **Clarity over cleverness** — Code MUST be readable
  and self-documenting
- **Simple architecture over premature complexity** —
  Introduce abstractions only when justified
- **Extensible systems over quick hacks** — Design for
  future growth without over-engineering

The system MUST represent real-world production architecture
while remaining minimal and cost-efficient.

All contributions MUST comply with this constitution.

## Governance

This constitution supersedes all other architectural and
process decisions within the project.

**Amendment procedure:**

1. Propose change with rationale in a PR
2. Document the specific sections affected
3. Update all dependent templates if principles change
4. Version bump according to semantic versioning:
   - **MAJOR**: Principle removal or incompatible redefinition
   - **MINOR**: New principle or material expansion
   - **PATCH**: Clarifications, wording, non-semantic fixes

**Compliance:**

- All PRs and code reviews MUST verify compliance with
  this constitution
- Complexity beyond what is prescribed MUST be justified
  in the PR description
- Violations discovered post-merge MUST be tracked as
  technical debt and resolved promptly

**Version**: 1.0.0 | **Ratified**: 2026-03-10 | **Last Amended**: 2026-03-10
