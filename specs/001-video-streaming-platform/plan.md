# Implementation Plan: Video Streaming Platform

**Branch**: `001-video-streaming-platform` | **Date**: 2026-03-10 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/001-video-streaming-platform/spec.md`

## Summary

Build a production-grade video streaming platform POC with three independently deployable services: a React frontend, a Java Spring Boot API, and a Java worker service. Users upload videos via presigned URLs directly to Cloudflare R2. A worker polls for new uploads, transcodes to 360p/720p HLS using FFmpeg, and stores processed assets in a public R2 bucket. Videos are streamed via hls.js from CDN-backed storage. PostgreSQL stores all metadata. The architecture supports future scaling to message queues, authentication, and additional features without redesign.

## Technical Context

**Backend Language/Version**: Java 21+ (LTS), Spring Boot 3.x
**Frontend Language/Version**: TypeScript, React 18+, Vite
**Worker Language/Version**: Java 21+ (same codebase or separate module)
**Primary Dependencies**:
  - Backend: Spring Boot Starter Web, Spring Data JPA, AWS SDK for Java v2 (S3-compatible), PostgreSQL JDBC driver
  - Frontend: React, React Router, hls.js, Axios
  - Worker: Spring Boot (or standalone Java), AWS SDK for Java v2, FFmpeg (system binary)
**Storage**: PostgreSQL (Neon or Railway), Cloudflare R2 (S3-compatible)
**Testing**: No unit tests per spec Constraints section; manual acceptance testing only
**Target Platform**: Linux containers (Docker), deployed on Railway (backend + worker) and Vercel (frontend)
**Project Type**: Multi-service web application (frontend + backend API + worker)
**Performance Goals**: <3s page load (browse), <5s time-to-first-frame (playback), <5min processing (60s video)
**Constraints**: <$15/month infrastructure, 500 MB max upload, no authentication in POC
**Scale/Scope**: Single-digit concurrent users, dozens of videos, 3 frontend pages

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| # | Constitution Principle | Status | Notes |
|---|----------------------|--------|-------|
| I | Separation of Responsibilities — 5 distinct layers | ✅ PASS | Frontend (Vercel), API (Railway), Worker (Railway), R2 (storage), PostgreSQL (DB) — all independently deployable |
| II | Asynchronous Video Processing — never block API | ✅ PASS | Worker polls DB independently; processing runs outside API process (FR-008, FR-015) |
| III | Direct Client Uploads via Presigned URLs | ✅ PASS | Client uploads directly to R2 via presigned URL; API never handles file bytes (FR-002) |
| IV | Adaptive Streaming (HLS) — multi-resolution | ✅ PASS | 360p + 720p HLS segments with master playlist; 1080p deferred (FR-009, FR-010) |
| V | Object Storage Architecture — defined structure | ✅ PASS | `videos/original/`, `videos/processed/{videoId}/`, `videos/thumbnails/` (FR-037) |
| VI | CDN-Based Video Delivery | ✅ PASS | Public R2 bucket for processed assets; originals private (FR-018) |
| — | Technology Stack | ✅ PASS | Java/Spring Boot, React, PostgreSQL, Cloudflare R2, FFmpeg — all per constitution |
| — | API Design Standards — REST, `/api/v1`, JSON envelope | ✅ PASS | 5 endpoints defined under `/api/v1` with `{ data, error }` envelope (FR-030–FR-036) |
| — | Infrastructure Constraints — <$15/month | ✅ PASS | Vercel free, Railway starter, Neon free, R2 free tier (SC-008) |
| — | Deployment — Docker + GitHub Actions | ✅ PASS | All services containerized; CI/CD via GitHub Actions |
| — | Observability — structured logging | ✅ PASS | Pipeline events logged with videoId (FR-023, FR-024) |
| — | Code Organization — clean architecture | ✅ PASS | Controllers/services/repositories/storage/processing/workers/models per constitution |
| — | Security — MIME restriction, size limit, URL expiry, no secrets in code | ✅ PASS | FR-005, FR-006, FR-007, env vars for config |
| — | Performance — streaming I/O, no full-memory buffering | ✅ PASS | Presigned URLs for upload; worker streams from R2 |
| — | Database Modeling — UUID PKs, timestamps, status fields | ✅ PASS | Video + VideoStream entities with UUIDs, audit timestamps, enum status |

**GATE RESULT: ALL PASS — proceed to Phase 0.**

## Project Structure

### Documentation (this feature)

```text
specs/001-video-streaming-platform/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── api.md           # REST API contract
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
backend/
├── src/main/java/com/videoplatform/
│   ├── controller/       # REST controllers (request handling only)
│   ├── service/          # Business logic
│   ├── repository/       # Spring Data JPA repositories
│   ├── storage/          # R2/S3 integration (presigned URLs, uploads)
│   ├── model/            # JPA entities (Video, VideoStream)
│   ├── dto/              # Request/response DTOs
│   ├── config/           # Spring configuration, R2 config, CORS
│   └── exception/        # Global exception handling
├── src/main/resources/
│   ├── application.yml
│   └── db/migration/     # Flyway or schema SQL
├── Dockerfile
└── pom.xml

worker/
├── src/main/java/com/videoplatform/worker/
│   ├── WorkerApplication.java
│   ├── service/          # Processing orchestration
│   ├── processing/       # FFmpeg transcoding, HLS generation, thumbnail
│   ├── storage/          # R2/S3 upload of processed assets
│   ├── repository/       # DB access for status updates
│   ├── model/            # Shared entities
│   └── config/           # Worker config (poll interval, FFmpeg path)
├── src/main/resources/
│   └── application.yml
├── Dockerfile
└── pom.xml

frontend/
├── src/
│   ├── components/       # Reusable UI components
│   ├── pages/            # UploadPage, VideoListPage, VideoPlayerPage
│   ├── services/         # API client (Axios)
│   ├── types/            # TypeScript interfaces
│   └── App.tsx
├── public/
├── package.json
├── tsconfig.json
├── vite.config.ts
└── Dockerfile

.github/
└── workflows/            # CI/CD pipelines

docker-compose.yml         # Local development
```

**Structure Decision**: Three-service architecture (backend + worker + frontend) following the constitution's Separation of Responsibilities principle. Backend and worker share the same Java/Spring Boot stack but are independently deployable. Frontend is a standalone React SPA. This maps directly to the five constitution layers: Frontend → `frontend/`, API Layer → `backend/`, Processing Workers → `worker/`, Storage Layer → Cloudflare R2 (external), Database Layer → PostgreSQL (external).

## Post-Design Constitution Re-Check

*Re-evaluated after Phase 1 design artifacts (data-model.md, contracts/api.md, quickstart.md) were created.*

| # | Constitution Principle | Status | Evidence |
|---|----------------------|--------|----------|
| I | Separation of Responsibilities | ✅ PASS | 3 independent services in project structure; no cross-layer coupling in contracts |
| II | Asynchronous Video Processing | ✅ PASS | Worker polls DB independently; `@Scheduled` + `SELECT FOR UPDATE SKIP LOCKED` (research.md) |
| III | Direct Client Uploads via Presigned URLs | ✅ PASS | `POST /videos` returns `uploadUrl`; client PUTs directly to R2 (contracts/api.md) |
| IV | Adaptive Streaming (HLS) | ✅ PASS | 360p + 720p streams in data-model.md `video_streams` table; master playlist URL in GET response |
| V | Object Storage Architecture | ✅ PASS | Storage key patterns in data-model.md match constitution structure exactly |
| VI | CDN-Based Video Delivery | ✅ PASS | Public R2 URLs for thumbnails, playlists, segments; originals remain private |
| — | Technology Stack | ✅ PASS | All technologies match constitution (Java/Spring Boot, React, PostgreSQL, R2, FFmpeg) |
| — | API Design Standards | ✅ PASS | 5 endpoints under `/api/v1` with `{ data, error }` envelope documented in contracts/api.md |
| — | Infrastructure Constraints | ✅ PASS | All services on free/cheap tiers; no new paid services introduced |
| — | Database Modeling | ✅ PASS | UUID PKs, audit timestamps, enum status, normalized design in data-model.md |
| — | Security | ✅ PASS | MIME validation, 500 MB limit, 15-min URL expiry, CORS config — all in contracts/api.md |
| — | Performance | ✅ PASS | Presigned URLs avoid memory buffering; streaming I/O; indexed queries in data-model.md |
| — | Code Organization | ✅ PASS | Package structure follows constitution's clean architecture (controllers/services/repositories/storage/processing/workers/models) |
| — | Observability | ✅ PASS | Pipeline events logged per quickstart.md verification section |
| — | Deployment | ✅ PASS | Docker + docker-compose for local dev; Dockerfile per service in project structure |

**POST-DESIGN GATE RESULT: ALL PASS — no violations detected. Ready for task generation.**

## Complexity Tracking

No constitution violations detected — this table is intentionally empty.
