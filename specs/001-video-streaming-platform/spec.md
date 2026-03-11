# Feature Specification: Video Streaming Platform

**Feature Branch**: `001-video-streaming-platform`
**Created**: 2026-03-10
**Status**: Draft
**Input**: Production-grade video streaming platform POC with upload, async processing, HLS streaming, and CDN delivery

## Clarifications

### Session 2026-03-10

- Q: How should the worker service discover videos that need processing? → A: Worker polls the database for UPLOADED videos on a fixed interval
- Q: What should happen to a video stuck in FAILED status? → A: Allow manual retry via FAILED → UPLOADED transition so the user can trigger reprocessing
- Q: How should the video list be ordered, and should pagination be supported? → A: Newest first with offset-based pagination (page number + page size, default 20)
- Q: At what point in the video should the thumbnail be extracted? → A: At the 2-second mark, falling back to first frame if video is shorter
- Q: How should processed video assets be accessed for streaming? → A: Public bucket for processed assets and thumbnails; originals remain private

## User Scenarios & Testing *(mandatory)*

### User Story 1 — Upload a Video (Priority: P1)

A user visits the platform and uploads a video file. The system accepts the file, stores it in object storage without routing all bytes through the backend server, and creates a record tracking the video. The user sees confirmation that the upload succeeded and is informed that processing will begin automatically.

**Why this priority**: Without the ability to ingest video content, no other feature (browsing, streaming) has anything to operate on. Upload is the foundational entry point of the entire platform.

**Independent Test**: Upload a video file through the UI. Verify the file arrives in object storage, a video record exists in the database with status UPLOADED, and the user sees a success message — all without requiring any playback or browsing capability.

**Acceptance Scenarios**:

1. **Given** a user is on the upload page, **When** they select a valid video file (e.g., MP4, up to 500 MB) and submit, **Then** the system obtains an upload URL, the file is transferred directly to object storage, the backend is notified of completion, and the video record transitions to UPLOADED status.
2. **Given** a user selects a file that is not a supported video format, **When** they attempt to upload, **Then** the system rejects the upload before transfer and displays a clear error message indicating which formats are accepted.
3. **Given** a user selects a video file that exceeds the maximum allowed size, **When** they attempt to upload, **Then** the system rejects the request and informs the user of the size limit.
4. **Given** an upload is in progress, **When** a network failure occurs, **Then** the video record remains in UPLOADING status and does not transition to UPLOADED.

---

### User Story 2 — Process an Uploaded Video (Priority: P2)

After a video upload completes, the system automatically triggers asynchronous processing. A worker service downloads the original file, transcodes it into multiple resolutions, generates HLS segments and playlists, extracts a thumbnail, and stores all processed assets in object storage. The video record is updated to reflect processing progress and final readiness.

**Why this priority**: Processing transforms raw uploads into streamable content. Without it, uploaded videos cannot be played back. This is the second critical step in the value chain (after upload).

**Independent Test**: Mark a previously uploaded video as complete. Verify that the worker picks up the job, produces HLS segments for each configured resolution, uploads a thumbnail, creates a master playlist, and transitions the video status to READY — all verifiable by inspecting storage contents and database state, without requiring the frontend player.

**Acceptance Scenarios**:

1. **Given** a video is in UPLOADED status, **When** the processing pipeline runs, **Then** the video transitions to PROCESSING, the worker generates HLS segments for 360p and 720p resolutions, extracts a thumbnail image, uploads all assets to storage, generates a master playlist referencing both resolutions, and the video transitions to READY.
2. **Given** a video is in PROCESSING status, **When** FFmpeg encounters an error (e.g., corrupted source file), **Then** the video transitions to FAILED, the error is logged with the video ID, and partially generated assets are cleaned up.
3. **Given** multiple videos are in UPLOADED status, **When** the worker polls for work, **Then** it processes videos sequentially (one at a time) without blocking the API server.

---

### User Story 3 — Browse Available Videos (Priority: P3)

A user visits the platform and sees a list of available videos. Each video displays its title, description, thumbnail, upload date, and current status. The user can browse the list to find a video they want to watch.

**Why this priority**: Browsing enables content discovery and gives users a way to locate and select videos. It depends on videos already being uploaded and ideally processed (for thumbnails and status).

**Independent Test**: Seed the database with several video records in various statuses (PROCESSING, READY, FAILED). Load the browse page and verify all videos appear with correct metadata, thumbnails display for processed videos, and status indicators are accurate — without requiring upload or playback functionality.

**Acceptance Scenarios**:

1. **Given** there are multiple videos in the system, **When** a user visits the browse page, **Then** they see a list of videos showing title, thumbnail (if available), upload date, and processing status for each.
2. **Given** a video is still in PROCESSING status, **When** the user views the list, **Then** that video displays a processing indicator and no playback option.
3. **Given** a video is in READY status, **When** the user views the list, **Then** that video displays its thumbnail and a link to the playback page.
4. **Given** no videos exist in the system, **When** a user visits the browse page, **Then** they see a clear empty state message.

---

### User Story 4 — Stream a Video with Adaptive Playback (Priority: P4)

A user selects a processed video and opens the playback page. The player loads the master HLS playlist from CDN-backed storage and begins streaming. The player automatically selects the best resolution based on network conditions and allows the user to watch the video with smooth playback.

**Why this priority**: Streaming is the ultimate user-facing deliverable — the reason the platform exists. However, it requires upload, processing, and browse to all be functional first, making it the culmination of the other stories.

**Independent Test**: Given a video in READY status with HLS assets in storage, navigate to its playback page. Verify the player loads the master playlist, begins playing, and the user can watch the video — without requiring the upload or processing UI.

**Acceptance Scenarios**:

1. **Given** a video is in READY status with processed HLS assets, **When** a user opens the playback page, **Then** the player loads the master playlist, selects an appropriate resolution, and begins streaming within 5 seconds.
2. **Given** a video has multiple resolution streams available, **When** network conditions change during playback, **Then** the player adapts to a different resolution without interrupting playback.
3. **Given** a user navigates to the playback page of a video still in PROCESSING status, **When** the page loads, **Then** the user sees a message indicating the video is not yet available for playback.
4. **Given** a user navigates to the playback page of a video in FAILED status, **When** the page loads, **Then** the user sees an error message explaining that processing failed.

---

### Edge Cases

- What happens when a user attempts to upload while another upload is already in progress? The system should allow it — each upload creates an independent video record.
- What happens when the worker service is unavailable after a video upload completes? The video remains in UPLOADED status and must be picked up once the worker recovers.
- What happens when storage becomes temporarily unavailable during processing? The worker must fail gracefully, transition the video to FAILED, and log the storage error.
- What happens when a user requests a video that does not exist? The API must return a clear "not found" response and the UI must display an appropriate message.
- What happens when the presigned upload URL expires before the client finishes uploading? The client must request a new URL; the system should not leave orphaned records.
- What happens when a processed video's HLS segments are deleted from storage? The player must handle the missing segments gracefully without crashing, displaying an error to the user.

## Requirements *(mandatory)*

### Functional Requirements

**Video Upload**

- **FR-001**: System MUST allow users to initiate a video upload by providing a title, description, and selecting a video file.
- **FR-002**: System MUST generate a presigned upload URL that allows the client to upload directly to object storage, bypassing the backend server for file transfer.
- **FR-003**: System MUST create a video record in the database before the upload begins, with initial status UPLOADING.
- **FR-004**: System MUST accept a "complete" notification from the client after upload finishes, transitioning the video to UPLOADED status.
- **FR-005**: System MUST restrict uploads to supported video MIME types (video/mp4, video/quicktime, video/x-msvideo, video/webm).
- **FR-006**: System MUST enforce a maximum upload file size of 500 MB.
- **FR-007**: Presigned upload URLs MUST expire after a configured duration (default: 15 minutes).

**Video Processing**

- **FR-008**: System MUST trigger asynchronous video processing by having the worker service poll the database on a fixed interval (e.g., every 10–30 seconds) for videos in UPLOADED status. This polling mechanism may be replaced with an event-driven approach (message queue) in a future phase without changing the state machine.
- **FR-009**: Worker MUST download the original video from object storage, transcode it into 360p and 720p resolutions, and generate HLS segments (.ts files) and resolution-specific playlists (.m3u8) for each.
- **FR-010**: Worker MUST generate a master HLS playlist (.m3u8) referencing all available resolution playlists.
- **FR-011**: Worker MUST extract a thumbnail image from the video at the 2-second mark. If the video is shorter than 2 seconds, the worker MUST fall back to the first frame.
- **FR-012**: Worker MUST upload all processed assets (segments, playlists, thumbnail) to object storage in the defined directory structure.
- **FR-013**: Worker MUST update the video status to PROCESSING when it begins work, READY on success, or FAILED on error.
- **FR-014**: Worker MUST create VideoStream records in the database for each resolution successfully generated.
- **FR-015**: Processing MUST never block or run inside the API server process.

**Video Browsing**

- **FR-016**: System MUST provide an endpoint to list all videos with their metadata (title, description, thumbnail URL, upload date, status), ordered by upload date descending (newest first), with offset-based pagination (page number + page size, default page size of 20).
- **FR-017**: System MUST provide an endpoint to retrieve detailed metadata for a single video, including its available streams.

**Video Streaming**

- **FR-018**: System MUST serve HLS playlists, segments, and thumbnails from a publicly accessible R2 bucket (or public custom domain). Original uploaded files MUST remain in a private storage path accessible only by the backend and worker services.
- **FR-019**: Frontend MUST load the master HLS playlist and use adaptive bitrate selection for playback.
- **FR-020**: Frontend MUST never access storage credentials directly; all storage URLs must be publicly accessible via CDN or provided by the backend.

**Video Status Lifecycle**

- **FR-021**: System MUST enforce the following valid state transitions: UPLOADING → UPLOADED → PROCESSING → READY, PROCESSING → FAILED, and FAILED → UPLOADED (manual retry).
- **FR-022**: System MUST reject any state transition not defined in the valid transition set.

**Observability**

- **FR-023**: System MUST emit structured log entries for each major pipeline event: video upload initiated, upload completed, processing started, processing completed, processing failed.
- **FR-024**: All log entries related to a video MUST include the video's unique identifier for traceability.

**Frontend Views**

- **FR-025**: Frontend MUST provide an Upload Page where users can enter a title, description, select a video file, and initiate the upload. The page MUST display upload progress and a success or error message upon completion.
- **FR-026**: Frontend MUST provide a Video List Page that displays all videos with their title, thumbnail (if available), upload date, and processing status. Each READY video MUST link to its playback page.
- **FR-027**: Frontend MUST provide a Video Player Page that loads the master HLS playlist for a given video and renders adaptive bitrate playback. The page MUST display an appropriate message when the video is not yet READY or has FAILED.
- **FR-028**: Frontend MUST display user-friendly error messages for all failure scenarios (invalid file type, size exceeded, upload failure, video not found, playback unavailable).
- **FR-029**: Frontend MUST communicate exclusively with the backend API. It MUST never access storage credentials, database connections, or worker services directly.

**Backend API Endpoints**

- **FR-030**: Backend MUST expose `POST /api/v1/videos` to create a new video record and return a presigned upload URL.
- **FR-031**: Backend MUST expose `POST /api/v1/videos/{id}/complete` to mark an upload as complete and trigger processing.
- **FR-032**: Backend MUST expose `GET /api/v1/videos` to list all videos with metadata, ordered by upload date descending, supporting query parameters for page number and page size (default 20).
- **FR-033**: Backend MUST expose `GET /api/v1/videos/{id}` to retrieve detailed metadata for a single video, including available streams.
- **FR-034**: All API responses MUST follow a consistent JSON envelope structure: `{ "data": {}, "error": null }`.
- **FR-035**: Backend MUST return appropriate error responses with meaningful messages for validation failures, not-found resources, and invalid state transitions.
- **FR-036**: Backend MUST expose `POST /api/v1/videos/{id}/retry` to allow retrying a FAILED video. This endpoint MUST transition the video from FAILED back to UPLOADED so that the worker picks it up on the next poll cycle.

**Storage Layout**

- **FR-037**: All video assets MUST be stored in object storage under a defined directory structure: `videos/original/{videoId}` for originals (private), `videos/processed/{videoId}/{resolution}/` for HLS streams (public), and `videos/thumbnails/{videoId}` for thumbnails (public).

### Key Entities

- **Video**: Represents a single uploaded video. Key attributes: unique identifier, title, description, status (UPLOADING / UPLOADED / PROCESSING / READY / FAILED), original file storage reference, thumbnail storage reference, master playlist storage reference, upload timestamp, last-updated timestamp.
- **VideoStream**: Represents a single resolution variant of a processed video. Key attributes: unique identifier, reference to parent Video, resolution label (e.g., "360p", "720p"), playlist storage reference, creation timestamp. A Video can have zero or more VideoStreams; streams are created during processing.
- **UploadSession** *(optional extension)*: Tracks the lifecycle of an individual upload attempt. Key attributes: unique identifier, reference to parent Video, presigned URL, expiration time, upload status, creation timestamp.

### Key Entity Relationships

- A **Video** has zero-to-many **VideoStream** records (one per resolution, created upon successful processing).
- A **Video** may optionally have one or more **UploadSession** records tracking upload attempts.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can upload a video file (up to 500 MB) and see confirmation within 30 seconds of the upload completing (excluding transfer time).
- **SC-002**: The system processes an uploaded video (60 seconds duration, 1080p source) and produces all HLS assets within 5 minutes of the upload being marked complete.
- **SC-003**: A user can browse all available videos and see accurate metadata (title, thumbnail, status) with page load completing within 3 seconds.
- **SC-004**: A user can begin streaming a READY video and see the first frame within 5 seconds of opening the playback page.
- **SC-005**: The player adapts to available resolutions without manual user intervention, maintaining continuous playback during resolution switches.
- **SC-006**: 100% of pipeline events (upload, processing start, completion, failure) are captured in structured logs with the video identifier attached.
- **SC-007**: The system handles a video processing failure gracefully — the user sees a clear FAILED status, and no partial/corrupted assets are left accessible for playback.
- **SC-008**: Total monthly infrastructure cost remains below $15 for the POC workload (single-digit concurrent users, dozens of videos).

## Constraints

- **No unit tests**: This POC does NOT require unit tests for either the frontend or backend. Validation is performed through acceptance scenario verification and manual functional testing as described in each user story's Independent Test section. Automated unit and integration test suites are deferred to a future phase.

## Assumptions

- The platform has a single implicit user for the POC phase; authentication is deferred to a future phase.
- Video files are assumed to be in common formats (MP4, MOV, AVI, WebM) that FFmpeg can process without special codec licenses.
- The initial POC supports 360p and 720p output resolutions; 1080p is flagged as a future extension per the constitution.
- The worker service processes one video at a time in the POC; queue-based parallel processing is a future upgrade.
- Cloudflare R2's built-in CDN capabilities (public bucket or custom domain) are sufficient for POC streaming delivery.
- PostgreSQL on Neon or Railway free tier provides sufficient storage and connections for the POC workload.
- The HLS segment duration will follow standard practice (approximately 6 seconds per segment).
- Error handling follows user-friendly messaging on the frontend and structured logging on the backend; no external error-tracking service is required for POC.
