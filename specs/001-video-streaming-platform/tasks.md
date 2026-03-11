# Tasks: Video Streaming Platform

**Input**: Design documents from `/specs/001-video-streaming-platform/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/api.md ✅

**Tests**: NOT included — spec Constraints section explicitly states no unit tests for this POC.

**Organization**: Tasks are grouped by user story (P1→P4) to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3, US4)
- Exact file paths included in every description

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Scaffold all three services and local development environment

- [x] T001 Create project directory structure per plan.md (backend/, worker/, frontend/, .github/workflows/)
- [x] T002 Initialize backend Spring Boot Maven project with dependencies (Spring Web, Data JPA, Flyway, AWS SDK v2, PostgreSQL) and entry point in backend/pom.xml and backend/src/main/java/com/videoplatform/VideoPlatformApplication.java
- [x] T003 [P] Initialize worker Spring Boot Maven project with dependencies (Spring Data JPA, AWS SDK v2, PostgreSQL) and entry point with @EnableScheduling in worker/pom.xml and worker/src/main/java/com/videoplatform/worker/WorkerApplication.java
- [x] T004 [P] Initialize frontend React + TypeScript + Vite project with hls.js, axios, and react-router-dom in frontend/package.json
- [x] T005 [P] Create docker-compose.yml with PostgreSQL 16 service for local development at repository root docker-compose.yml

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Database schema, JPA entities, R2 config, and error handling infrastructure that ALL user stories depend on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [x] T006 Create Flyway migration with videos and video_streams tables per data-model.md in backend/src/main/resources/db/migration/V1__create_schema.sql
- [x] T007 Create VideoStatus enum with valid transition enforcement in backend/src/main/java/com/videoplatform/model/VideoStatus.java
- [x] T008 Create Video JPA entity mapped to videos table with all columns from data-model.md in backend/src/main/java/com/videoplatform/model/Video.java
- [x] T009 [P] Create VideoStream JPA entity mapped to video_streams table with ManyToOne to Video in backend/src/main/java/com/videoplatform/model/VideoStream.java
- [x] T010 [P] Create VideoRepository extending JpaRepository with status and pagination queries in backend/src/main/java/com/videoplatform/repository/VideoRepository.java
- [x] T011 [P] Create VideoStreamRepository extending JpaRepository in backend/src/main/java/com/videoplatform/repository/VideoStreamRepository.java
- [x] T012 Configure R2/S3 beans (S3Client and S3Presigner) with endpoint, region "auto", and credentials in backend/src/main/java/com/videoplatform/config/R2Config.java
- [x] T013 [P] Create ApiResponse envelope DTO with static factory methods for success and error in backend/src/main/java/com/videoplatform/dto/ApiResponse.java
- [x] T014 [P] Create GlobalExceptionHandler with @ControllerAdvice for validation, not-found, and conflict errors in backend/src/main/java/com/videoplatform/exception/GlobalExceptionHandler.java
- [x] T015 [P] Create CORS configuration allowing frontend origin (localhost:5173 and Vercel domain) in backend/src/main/java/com/videoplatform/config/CorsConfig.java
- [x] T016 Create backend application.yml with datasource, Flyway, R2, and server config in backend/src/main/resources/application.yml

**Checkpoint**: Backend compiles, database migrations run on startup, all entities persist correctly

---

## Phase 3: User Story 1 — Upload a Video (Priority: P1) 🎯 MVP

**Goal**: Users can upload a video file via presigned URL and the system creates a tracked record

**Independent Test**: Upload a video through the UI. Verify the file arrives in R2, a video record exists in the database with status UPLOADED, and the user sees a success message.

### Backend — Upload API

- [x] T017 [P] [US1] Create CreateVideoRequest DTO with validation (title non-blank, fileName non-blank, fileSize ≤ 500 MB, contentType in allowed set) in backend/src/main/java/com/videoplatform/dto/CreateVideoRequest.java
- [x] T018 [P] [US1] Create VideoResponse DTO for create and complete responses in backend/src/main/java/com/videoplatform/dto/VideoResponse.java
- [x] T019 [US1] Implement StorageService with generatePresignedUploadUrl method using S3Presigner in backend/src/main/java/com/videoplatform/storage/StorageService.java
- [x] T020 [US1] Implement VideoService with createVideo (generates presigned URL, persists record) and completeUpload (UPLOADING→UPLOADED transition) in backend/src/main/java/com/videoplatform/service/VideoService.java
- [x] T021 [US1] Implement VideoController with POST /api/v1/videos and POST /api/v1/videos/{id}/complete per contracts/api.md in backend/src/main/java/com/videoplatform/controller/VideoController.java

### Frontend — Upload Page

- [x] T022 [P] [US1] Create TypeScript types (Video, CreateVideoRequest, CreateVideoResponse, ApiResponse, PagedResponse) in frontend/src/types/video.ts
- [x] T023 [P] [US1] Create API client service with createVideo and completeUpload methods using Axios in frontend/src/services/api.ts
- [x] T024 [US1] Implement UploadPage with title/description form, file picker with MIME/size validation, presigned URL upload with progress bar, and complete notification in frontend/src/pages/UploadPage.tsx
- [x] T025 [US1] Configure React Router with routes for /, /upload, /videos, /videos/:id and navigation layout in frontend/src/App.tsx

**Checkpoint**: User can upload a video file through the frontend. File lands in R2 under videos/original/{id}/. Database shows record with status UPLOADED.

---

## Phase 4: User Story 2 — Process an Uploaded Video (Priority: P2)

**Goal**: Worker automatically picks up uploaded videos, transcodes to 360p/720p HLS, extracts thumbnail, and updates status to READY

**Independent Test**: Insert a video record with status UPLOADED and an original file in R2. Verify the worker produces HLS segments for both resolutions, a thumbnail, a master playlist, creates VideoStream records, and transitions to READY.

### Worker — Video Processing Pipeline

- [x] T026 [US2] Create worker application.yml with database, R2, poll interval (15s), and FFmpeg path config in worker/src/main/resources/application.yml
- [x] T027 [P] [US2] Create shared model classes (Video, VideoStream, VideoStatus) with JPA mappings in worker/src/main/java/com/videoplatform/worker/model/
- [x] T028 [P] [US2] Create VideoRepository and VideoStreamRepository in worker/src/main/java/com/videoplatform/worker/repository/
- [x] T029 [US2] Configure R2 S3Client and implement R2StorageService with downloadToFile and uploadFile methods in worker/src/main/java/com/videoplatform/worker/storage/R2StorageService.java
- [x] T030 [US2] Implement FfmpegService with transcodeToHls (360p + 720p commands per research.md) and extractThumbnail (2s mark with first-frame fallback) using ProcessBuilder in worker/src/main/java/com/videoplatform/worker/processing/FfmpegService.java
- [x] T031 [US2] Implement VideoProcessingService orchestrating download → transcode → generate master playlist → upload processed assets → create VideoStream records → update status in worker/src/main/java/com/videoplatform/worker/service/VideoProcessingService.java
- [x] T032 [US2] Implement VideoProcessingScheduler with @Scheduled(fixedDelay) and SELECT FOR UPDATE SKIP LOCKED pattern in worker/src/main/java/com/videoplatform/worker/service/VideoProcessingScheduler.java

### Backend — Retry Support

- [x] T033 [US2] Add retryVideo method to VideoService (FAILED→UPLOADED) and implement POST /api/v1/videos/{id}/retry in backend/src/main/java/com/videoplatform/controller/VideoController.java

**Checkpoint**: Upload a video via US1 flow. Worker picks it up within 15s, processes it, and video transitions to READY. HLS assets and thumbnail visible in R2. Retry of a FAILED video re-queues it.

---

## Phase 5: User Story 3 — Browse Available Videos (Priority: P3)

**Goal**: Users can browse a paginated list of all videos with thumbnails, titles, and status indicators

**Independent Test**: Seed database with videos in various statuses. Load the browse page and verify all videos show with correct metadata, thumbnails for READY videos, and accurate status badges.

### Backend — List Endpoint

- [x] T034 [US3] Add listVideos method with offset pagination (page, size, newest first) to VideoService in backend/src/main/java/com/videoplatform/service/VideoService.java
- [x] T035 [US3] Implement GET /api/v1/videos list endpoint with pagination query params per contracts/api.md in backend/src/main/java/com/videoplatform/controller/VideoController.java

### Frontend — Video List Page

- [x] T036 [P] [US3] Add getVideos method with page/size params to API client in frontend/src/services/api.ts
- [x] T037 [US3] Implement VideoListPage with video cards (thumbnail, title, status, date), pagination controls, and empty state in frontend/src/pages/VideoListPage.tsx
- [x] T038 [P] [US3] Create StatusBadge component rendering visual status indicators (UPLOADING, PROCESSING, READY, FAILED) in frontend/src/components/StatusBadge.tsx

**Checkpoint**: Browse page shows all videos with correct metadata. Pagination works. READY videos link to player. FAILED videos show status.

---

## Phase 6: User Story 4 — Stream a Video with Adaptive Playback (Priority: P4)

**Goal**: Users select a video and watch it via adaptive HLS streaming with automatic resolution switching

**Independent Test**: Given a READY video with HLS assets in R2, navigate to its player page. Verify playback starts within 5 seconds and the player streams adaptively.

### Backend — Detail Endpoint

- [x] T039 [US4] Add getVideoById method returning video with streams to VideoService in backend/src/main/java/com/videoplatform/service/VideoService.java
- [x] T040 [US4] Implement GET /api/v1/videos/{id} detail endpoint with streams per contracts/api.md in backend/src/main/java/com/videoplatform/controller/VideoController.java

### Frontend — Video Player

- [x] T041 [P] [US4] Add getVideo method to API client in frontend/src/services/api.ts
- [x] T042 [US4] Implement VideoPlayer component with hls.js, Safari native fallback, error recovery, and cleanup per research.md pattern in frontend/src/components/VideoPlayer.tsx
- [x] T043 [US4] Implement VideoPlayerPage loading video metadata and rendering VideoPlayer with not-ready and error states in frontend/src/pages/VideoPlayerPage.tsx

**Checkpoint**: Navigate to a READY video's player page. HLS playback starts with adaptive bitrate. Player shows appropriate messages for PROCESSING and FAILED videos.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Containerization, logging, and end-to-end validation

- [x] T044 [P] Create backend Dockerfile with multi-stage build (eclipse-temurin:21-jdk-alpine → jre-alpine) in backend/Dockerfile
- [x] T045 [P] Create worker Dockerfile with multi-stage build and FFmpeg installation in worker/Dockerfile
- [x] T046 [P] Create frontend Dockerfile with Vite build and nginx serving in frontend/Dockerfile
- [x] T047 Update docker-compose.yml with backend, worker, frontend, and PostgreSQL services with health checks in docker-compose.yml
- [x] T048 [P] Configure structured JSON logging for pipeline events (video.uploaded, processing.started, processing.completed, processing.failed) in backend/src/main/resources/application.yml and worker/src/main/resources/application.yml
- [x] T049 Validate full end-to-end workflow per quickstart.md verification steps

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Setup — **BLOCKS all user stories**
- **US1 Upload (Phase 3)**: Depends on Foundational
- **US2 Process (Phase 4)**: Depends on Foundational; benefits from US1 for realistic testing
- **US3 Browse (Phase 5)**: Depends on Foundational; benefits from US1+US2 for thumbnails
- **US4 Stream (Phase 6)**: Depends on Foundational; requires US2 for HLS assets
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

```
Setup ──► Foundational ──┬──► US1 (Upload)  ──► US2 (Process) ──► US4 (Stream)
                         │                                    
                         └──► US3 (Browse) ◄── benefits from US2 for thumbnails
```

- **US1 → US2**: US2 needs uploaded videos to process (depends on US1)
- **US2 → US4**: US4 needs HLS assets to stream (depends on US2)
- **US3**: Can start after Foundational; works with seeded DB data. Benefits from US2 for thumbnails.

### Within Each User Story

- DTOs before services
- Services before controllers
- TypeScript types before frontend components
- API client methods before page components
- Backend endpoints before frontend pages that consume them

### Parallel Opportunities

#### Setup Phase
```
T001 (directories) → T002, T003, T004, T005 (all in parallel)
```

#### Foundational Phase
```
T006 (migration) → T007 (enum) → T008 (Video entity) → T009, T010, T011 (parallel)
T012 (R2 config)
T013, T014, T015 (parallel — independent configs/DTOs)
T016 (application.yml — after T012)
```

#### User Story 1
```
T017, T018 (DTOs — parallel)
T022, T023 (frontend types + API — parallel with backend DTOs)
T019 (StorageService) → T020 (VideoService) → T021 (VideoController)
T024 (UploadPage — after T023)
T025 (Router — after T024)
```

#### User Story 2
```
T026, T027, T028 (config + models + repos — parallel)
T029 (R2StorageService — after T028)
T030 (FfmpegService — parallel with T029)
T031 (ProcessingService — after T029, T030)
T032 (Scheduler — after T031)
T033 (retry endpoint — parallel with worker tasks)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — blocks everything)
3. Complete Phase 3: User Story 1 — Upload
4. **STOP and VALIDATE**: Upload a video, verify presigned URL flow works end-to-end
5. Deploy/demo if ready — users can upload but not yet watch

### Incremental Delivery

1. Setup + Foundational → Foundation ready
2. **Add US1 (Upload)** → Test: upload works → **Deploy MVP**
3. **Add US2 (Process)** → Test: uploaded videos get transcoded → Deploy
4. **Add US3 (Browse)** → Test: paginated list with thumbnails → Deploy
5. **Add US4 (Stream)** → Test: HLS playback works → Deploy
6. **Polish** → Dockerize, validate quickstart → Final release

### Suggested MVP Scope

**Phase 1 + Phase 2 + Phase 3 (US1)** = 25 tasks

This delivers a working upload pipeline where users can submit videos to storage with tracked records — the foundational entry point for the entire platform.

---

## Notes

- [P] tasks = different files, no dependencies on incomplete tasks
- [Story] label maps task to specific user story for traceability
- No unit tests per spec Constraints section — validate via manual acceptance testing
- Worker model classes are duplicated from backend (separate Maven projects)
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
