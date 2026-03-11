# Technical Research: Video Streaming Platform POC

**Date**: 2026-03-10 | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

---

## 1. Cloudflare R2 Presigned URL Generation with AWS SDK for Java v2

### Decision

Use the AWS SDK for Java v2 `S3Presigner` with R2-specific endpoint configuration to generate presigned PUT URLs for direct client-to-R2 uploads.

### Rationale

R2 implements the S3 API with full support for presigned URLs (GET, PUT, HEAD, DELETE). The AWS SDK for Java v2 is the officially recommended approach since R2 uses AWS Signature Version 4. Presigned URLs are generated **client-side** — no network call to R2 is made during generation, only your credentials and the signing algorithm are needed.

### Key Configuration

```java
// S3 client for general operations (download, upload from worker)
S3Client s3Client = S3Client.builder()
    .endpointOverride(URI.create("https://<ACCOUNT_ID>.r2.cloudflarestorage.com"))
    .region(Region.of("auto"))  // R2 requires "auto"; us-east-1 also aliases to auto
    .credentialsProvider(StaticCredentialsProvider.create(
        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
    .build();

// S3Presigner for generating presigned URLs (separate from S3Client)
S3Presigner presigner = S3Presigner.builder()
    .endpointOverride(URI.create("https://<ACCOUNT_ID>.r2.cloudflarestorage.com"))
    .region(Region.of("auto"))
    .credentialsProvider(StaticCredentialsProvider.create(
        AwsBasicCredentials.create(accessKeyId, secretAccessKey)))
    .build();

// Generate presigned PUT URL
PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(b -> b
    .signatureDuration(Duration.ofMinutes(15))
    .putObjectRequest(por -> por
        .bucket("video-platform")
        .key("videos/original/" + videoId + "/" + filename)
        .contentType(mimeType)  // Restricts upload to specified Content-Type
    ));
String uploadUrl = presignedRequest.url().toString();
```

### R2-Specific Quirks vs Standard S3

- **Region**: Must be `"auto"`. SDK requires a region value, but R2 ignores it. `us-east-1` works as an alias.
- **Endpoint URL**: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` — account ID is in the Cloudflare dashboard.
- **Content-Type restriction**: When `ContentType` is specified in the presigned request, the signature includes it. Uploads with a different `Content-Type` get a `403 SignatureDoesNotMatch` — this is a security best practice.
- **No ACL support**: R2 doesn't support S3 ACLs. Public/private access is controlled at the bucket level via public bucket settings, not per-object.
- **Presigned URLs only work on the S3 API domain** (`*.r2.cloudflarestorage.com`), **not** on custom domains or `r2.dev`.
- **POST multipart form uploads are not supported** — only PUT-based presigned URLs.
- **Max expiry**: 1 second to 7 days (604,800 seconds). We use 15 minutes per FR-007.
- **Credentials**: Create an R2 API token in the Cloudflare dashboard (not the global API key). This gives you an Access Key ID and Secret Access Key.

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| Multipart upload via backend proxy | Violates architecture principle — backend would handle all file bytes, adding latency and memory pressure |
| Cloudflare Workers for upload handling | Adds complexity; presigned URLs are simpler for a POC and cost nothing extra |
| MinIO Java client | Extra dependency; AWS SDK v2 already works with any S3-compatible API |

---

## 2. FFmpeg HLS Transcoding Command Patterns

### Decision

Run FFmpeg as **separate sequential commands** per resolution (not a single complex filter_complex command), then generate the master playlist manually. Use H.264 (libx264) + AAC for maximum compatibility, 6-second segments, and the `medium` preset for balanced speed/quality.

### Rationale

A single `filter_complex` + `var_stream_map` command is elegant but harder to debug, and errors in one resolution kill the entire pipeline. For a POC, separate commands per resolution are simpler to implement, log, and debug from Java. Processing time is acceptable for the target workload (60s video < 5min).

### FFmpeg Commands

**360p transcoding:**
```bash
ffmpeg -i input.mp4 \
  -vf "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset medium -crf 28 -maxrate 800k -bufsize 1200k \
  -c:a aac -b:a 96k -ac 2 \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_segment_filename "360p/segment_%03d.ts" \
  360p/playlist.m3u8
```

**720p transcoding:**
```bash
ffmpeg -i input.mp4 \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2" \
  -c:v libx264 -preset medium -crf 23 -maxrate 2500k -bufsize 5000k \
  -c:a aac -b:a 128k -ac 2 \
  -g 48 -keyint_min 48 -sc_threshold 0 \
  -f hls \
  -hls_time 6 \
  -hls_playlist_type vod \
  -hls_flags independent_segments \
  -hls_segment_type mpegts \
  -hls_segment_filename "720p/segment_%03d.ts" \
  720p/playlist.m3u8
```

**Thumbnail extraction at 2 seconds:**
```bash
ffmpeg -i input.mp4 -ss 2 -frames:v 1 -q:v 2 thumbnail.jpg
```
If the video is shorter than 2 seconds, use `-ss 0` as fallback (detect duration first with `ffprobe -v error -show_entries format=duration -of csv=p=0 input.mp4`).

**Master playlist** (generated programmatically, not by FFmpeg):
```m3u8
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360,CODECS="avc1.42e01e,mp4a.40.2"
360p/playlist.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
720p/playlist.m3u8
```

### Key Parameters Explained

| Parameter | Value | Why |
|---|---|---|
| `-preset medium` | Balanced encode speed | `slow` is better quality but too slow for a POC on limited Railway resources |
| `-crf 23/28` | Quality targets | CRF 23 for 720p (good), 28 for 360p (acceptable) — lower = better quality, higher file size |
| `-g 48 -keyint_min 48` | Keyframe interval | Forces keyframe every 48 frames (~2s at 24fps). Critical for segment alignment across resolutions |
| `-sc_threshold 0` | Disable scene-change detection keyframes | Ensures consistent keyframe placement for HLS segment alignment |
| `-hls_time 6` | 6-second segments | Industry standard. Apple recommends 6s. Balances startup time vs. seek granularity |
| `-hls_playlist_type vod` | VOD playlist type | Inserts `#EXT-X-PLAYLIST-TYPE:VOD` and `#EXT-X-ENDLIST` for complete playlists |
| `force_original_aspect_ratio=decrease,pad=..` | Letterboxing | Handles non-standard aspect ratios without stretching |

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| Single `filter_complex` + `var_stream_map` | More efficient but harder to debug and handle partial failures from Java |
| VP9/AV1 codec | Superior compression but dramatically slower encoding; H.264 is universally supported |
| 2-second segments | Increases segment count and playlist overhead; 6s is the Apple recommendation |
| FFmpeg `-master_pl_name` flag | Works but coupled to the single-command approach; manual generation gives more control |

---

## 3. Spring Boot Worker Polling Pattern

### Decision

Use Spring's `@Scheduled(fixedDelay = ...)` annotation with `SELECT ... FOR UPDATE SKIP LOCKED` for safe database polling.

### Rationale

`@Scheduled` is built into Spring Boot, requires zero additional dependencies, and is perfectly suited for a single-worker POC. `fixedDelay` (not `fixedRate`) ensures the next poll starts only after the current processing completes, preventing overlap within a single instance. `SELECT ... FOR UPDATE SKIP LOCKED` prepares for future multi-instance scaling without redesign.

### Implementation Pattern

```java
@Component
public class VideoProcessingScheduler {

    private final VideoProcessingService processingService;

    @Scheduled(fixedDelayString = "${worker.poll-interval:15000}")  // 15s default
    public void pollForWork() {
        processingService.processNextVideo();
    }
}

@Service
@Transactional
public class VideoProcessingService {

    @PersistenceContext
    private EntityManager entityManager;

    public void processNextVideo() {
        // SELECT ... FOR UPDATE SKIP LOCKED — safe for concurrent workers
        List<Video> videos = entityManager.createQuery(
            "SELECT v FROM Video v WHERE v.status = :status ORDER BY v.createdAt ASC",
            Video.class)
            .setParameter("status", VideoStatus.UPLOADED)
            .setMaxResults(1)
            .setLockMode(LockModeType.PESSIMISTIC_WRITE)
            .setHint("jakarta.persistence.lock.timeout", -2)  // SKIP LOCKED
            .getResultList();

        if (videos.isEmpty()) return;

        Video video = videos.get(0);
        video.setStatus(VideoStatus.PROCESSING);
        entityManager.flush();  // Commit status change before long processing

        try {
            // ... download, transcode, upload, update to READY
        } catch (Exception e) {
            video.setStatus(VideoStatus.FAILED);
            // log error with videoId
        }
    }
}
```

### Key Design Decisions

- **`fixedDelay` vs `fixedRate`**: `fixedDelay` waits N ms *after* the previous execution completes. `fixedRate` would schedule the next run N ms after the *start*, potentially overlapping if processing takes longer than the interval. `fixedDelay` is correct here.
- **`SKIP LOCKED`**: PostgreSQL-specific. If another worker instance has locked a row, this query skips it rather than blocking. Enables future horizontal scaling. The JPA hint `-2` maps to `SKIP LOCKED` in Hibernate.
- **Single video per poll**: Matches FR-015 (process one at a time). The worker picks one, processes it fully, then polls again.
- **Explicit status transition at start**: Setting `PROCESSING` and flushing *before* the long-running work ensures other workers/the API see the correct status.
- **`@EnableScheduling`** must be present on the application class or a config class.

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| Spring Integration Polling Channel | Massive overkill for a single polling use case; adds abstraction layers |
| `ScheduledExecutorService` (raw Java) | Loses Spring's lifecycle management, externalized config, and graceful shutdown |
| Message queue (RabbitMQ/SQS) | Perfect for production but violates the <$15/month budget and adds infrastructure complexity. Plan explicitly notes this as a future upgrade path |
| `@Async` + event listener | Doesn't provide polling; would need the upload endpoint to trigger processing, coupling API and worker |

---

## 4. React + hls.js Integration

### Decision

Use hls.js with a `useRef`/`useEffect` pattern in a React functional component. Check `Hls.isSupported()` first, fallback to native HLS for Safari.

### Rationale

hls.js (v1.6.x) is the industry standard for HLS playback in non-Safari browsers, used by JW Player, Clappr, Flowplayer, and others. It works on top of `<video>` + MediaSource Extensions. Safari has native HLS support and doesn't need hls.js.

### Implementation Pattern

```tsx
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

interface VideoPlayerProps {
  src: string;  // URL to master.m3u8
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,  // VOD, not live
      });

      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        // Autoplay or let user click play
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              setError('Network error — unable to load video.');
              hls.startLoad();  // Try to recover
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();  // Built-in recovery
              break;
            default:
              setError('Unable to play this video.');
              hls.destroy();
              break;
          }
        }
      });

      return () => {
        hls.destroy();  // Critical: detaches from video element, stops downloads
        hlsRef.current = null;
      };
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari native HLS
      video.src = src;
      video.addEventListener('error', () => setError('Unable to play this video.'));
    } else {
      setError('HLS playback is not supported in this browser.');
    }
  }, [src]);

  if (error) return <div className="video-error">{error}</div>;

  return <video ref={videoRef} controls style={{ width: '100%' }} />;
}
```

### Key Integration Points

- **`hls.destroy()` in cleanup**: Absolutely critical. Without it, the old hls.js instance continues downloading segments after unmount or `src` change, causing memory leaks and ghost network requests.
- **`src` in the `useEffect` dependency array**: Ensures the player reinitializes when the video URL changes (e.g., navigating between videos).
- **Adaptive bitrate**: hls.js handles ABR automatically — no configuration needed. It monitors download speed and buffer levels to select the best quality. Manual quality selection is available via `hls.currentLevel = index` if needed later.
- **Safari fallback**: Safari supports HLS natively via `<video src="...m3u8">`. The `canPlayType` check handles this. hls.js's `isSupported()` returns false on iOS Safari.
- **Error recovery**: hls.js has built-in retry for network errors (`startLoad()`) and media errors (`recoverMediaError()`). Only destroy on unrecoverable errors.
- **SSR safety**: hls.js exports a dummy object in Node.js, so `import Hls from 'hls.js'` won't crash during SSR/build.

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| video.js + contrib-hls | Much heavier; video.js is a full player framework with its own UI. hls.js is lighter and gives us full control |
| Shaka Player | Google's player; supports both DASH and HLS but is more complex to configure and less widely used for HLS-only |
| Native `<video>` only | Only works in Safari; Chrome/Firefox/Edge need MSE-based player for HLS |
| Media Chrome | UI framework on top of hls.js — nice but unnecessary for a POC |

---

## 5. Cloudflare R2 Public Bucket Configuration

### Decision

Use a **single R2 bucket** with **public access enabled via the r2.dev development URL** for the POC. All objects in the bucket are accessible, but only processed assets and thumbnails need public URLs. Original files are private by obscurity (not linked publicly). Upgrade to a custom domain for production.

### Rationale

R2 doesn't support per-object ACLs (unlike AWS S3). Access control is at the bucket level. For the POC, using the `r2.dev` development URL avoids needing a custom domain and DNS setup. The originals remain effectively private because their keys are never exposed to the frontend — only the backend/worker knows the `videos/original/` paths.

### Configuration

**Bucket setup:**
1. Create a single bucket (e.g., `video-platform`) in the Cloudflare dashboard.
2. Enable **Public Development URL** (`r2.dev` subdomain) under bucket Settings.
3. Public URL format: `https://pub-<hash>.r2.dev/videos/processed/<videoId>/master.m3u8`

**CORS policy** (set via dashboard or Wrangler):
```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://your-frontend.vercel.app"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["Content-Type", "Content-Length"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**Key CORS notes:**
- `PUT` is required for presigned URL uploads from the browser.
- `GET` is required for fetching HLS playlists/segments and thumbnails.
- `AllowedOrigins` must match exactly (scheme + host + optional port, no trailing slash, no path).
- `ExposeHeaders: ["ETag"]` allows JavaScript to read the upload response hash for verification.
- CORS propagation can take up to 30 seconds.

### Access Model

| Path | Access | How |
|---|---|---|
| `videos/original/{videoId}/` | Private (by obscurity) | Keys never exposed to frontend; only backend/worker use presigned URLs or direct S3 API |
| `videos/processed/{videoId}/` | Public read | Frontend fetches via public bucket URL — playlists, segments |
| `videos/thumbnails/{videoId}/` | Public read | Frontend displays via `<img src="...">` |

### Production Upgrade Path

For production, replace `r2.dev` with a **custom domain**:
1. Add your domain to Cloudflare (as a zone).
2. Connect the R2 bucket to a subdomain (e.g., `cdn.yourdomain.com`).
3. Enables Cloudflare Cache (with Smart Tiered Cache), WAF rules, and bot management.
4. `r2.dev` is rate-limited by Cloudflare and explicitly intended for development only.

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| Two separate buckets (private + public) | Adds complexity; worker would need to write to a different bucket. Single bucket with path-based privacy is simpler |
| Custom domain from day one | Requires owning and managing a domain with Cloudflare DNS; overkill for POC |
| Cloudflare Workers as auth proxy | Adds $5/month Workers plan cost and code complexity for no POC benefit |
| Signed URLs for read access | Every video play would need a backend roundtrip for a URL; public bucket is simpler for processed content |

---

## 6. Spring Boot + PostgreSQL on Railway Deployment

### Decision

Deploy as a Docker container using a multi-stage build on Railway's **Hobby plan** ($5/month). Use Railway's built-in PostgreSQL service. Configure memory-conscious JVM settings and connect via Railway's environment variable injection.

### Rationale

Railway detects Java apps automatically but a Dockerfile gives explicit control over the JVM version and flags. Railway's Hobby plan provides up to 8 GB RAM per service (shared across all services) with $5 of included usage. PostgreSQL on Railway is a one-click add.

### Dockerfile

```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
WORKDIR /app
COPY . .
RUN ./mvnw -DskipTests clean package

FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
```

### Environment Configuration

Railway injects database connection details as environment variables. Map them in `application.yml`:

```yaml
server:
  port: ${PORT:8080}  # Railway sets PORT

spring:
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/videoplatform}
    username: ${PGUSER:postgres}
    password: ${PGPASSWORD:postgres}
    hikari:
      maximum-pool-size: ${HIKARI_MAX_POOL:5}  # Keep low for Railway
      minimum-idle: 2
      connection-timeout: 20000
      idle-timeout: 300000
```

### Key Deployment Considerations

- **Memory**: Railway charges $10/GB/month for RAM. A Spring Boot app typically needs 256–512 MB. Set `-XX:MaxRAMPercentage=75.0` to let the JVM use 75% of the container's available memory, leaving headroom for the OS.
- **Connection pooling**: HikariCP is the default in Spring Boot. Keep `maximum-pool-size` low (5) — Railway's PostgreSQL free tier has a limited connection count. Both the backend and worker share this database.
- **PORT env var**: Railway assigns a random port via the `PORT` environment variable. Spring Boot must bind to it.
- **Health checks**: Railway supports HTTP health checks. Add Spring Boot Actuator or a simple `/health` endpoint.
- **Cost estimate** (Hobby plan, $5 included):
  - Backend: ~256 MB RAM × 24/7 ≈ $2.56/month
  - Worker: ~256 MB RAM × 24/7 ≈ $2.56/month (but can idle when not processing)
  - PostgreSQL: ~256 MB RAM ≈ $2.56/month
  - **Total: ~$7-8/month** — within budget with Hobby plan's $5 credit

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| Railway's Railpack (auto-detect) | Less control over JVM flags and base image version |
| Neon Serverless PostgreSQL | Free tier has 0.5 GB storage limit and cold-start latency; Railway PostgreSQL is always-on and simpler |
| Fly.io | Comparable pricing but requires more CLI configuration; Railway's dashboard is simpler |
| Render | Free tier spins down after inactivity; worker polling would fail |

---

## 7. Flyway vs Manual SQL for Schema Management

### Decision

Use **Flyway** with versioned migration scripts in `src/main/resources/db/migration/`.

### Rationale

Despite this being a POC, Flyway adds near-zero overhead (it's a single Spring Boot starter dependency) while preventing the most common POC pitfall: schema drift between local, staging, and production databases. Spring Boot auto-configures Flyway when it's on the classpath — no code required.

`schema.sql` (Spring Boot's built-in initialization) has a critical limitation: it runs every time the app starts with `spring.sql.init.mode=always`, which means it must use `CREATE TABLE IF NOT EXISTS` everywhere and cannot evolve the schema incrementally. Schema changes during development become manual and error-prone.

### Setup

**Dependency** (pom.xml):
```xml
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-core</artifactId>
</dependency>
<dependency>
    <groupId>org.flywaydb</groupId>
    <artifactId>flyway-database-postgresql</artifactId>
</dependency>
```

**First migration** (`src/main/resources/db/migration/V1__create_schema.sql`):
```sql
CREATE TABLE videos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'UPLOADING',
    original_storage_key VARCHAR(500),
    thumbnail_url VARCHAR(500),
    master_playlist_url VARCHAR(500),
    file_size BIGINT,
    content_type VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE video_streams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    resolution VARCHAR(10) NOT NULL,
    playlist_url VARCHAR(500) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_video_streams_video_id ON video_streams(video_id);
```

**Configuration** (`application.yml`):
```yaml
spring:
  flyway:
    enabled: true
    locations: classpath:db/migration
    # Flyway auto-creates its tracking table (flyway_schema_history)
  jpa:
    hibernate:
      ddl-auto: validate  # Validate entity mappings against Flyway-managed schema
```

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| `schema.sql` / `data.sql` | Cannot evolve schema incrementally; no version tracking; error-prone on repeated starts |
| Hibernate `ddl-auto=update` | Unsafe — can make destructive changes, doesn't handle renames, not reproducible |
| Liquibase | More powerful than Flyway (rollback support, XML/YAML formats) but more complex; Flyway's SQL-file approach is simpler |
| No migration tool (manual DDL) | Not reproducible across environments; too easy to forget schema changes |

---

## 8. Java Process Execution for FFmpeg

### Decision

Use `ProcessBuilder` with explicit stdout/stderr handling, configurable timeout, and non-zero exit code detection.

### Rationale

`ProcessBuilder` is the modern Java API for process execution (since Java 5, enhanced in later versions). It provides full control over environment, working directory, and stream redirection. `Runtime.exec()` is the legacy alternative with a less user-friendly API and well-known pitfalls.

### Implementation Pattern

```java
public class FfmpegExecutor {

    private final String ffmpegPath;
    private final Duration timeout;

    public FfmpegExecutor(String ffmpegPath, Duration timeout) {
        this.ffmpegPath = ffmpegPath;
        this.timeout = timeout;
    }

    public void execute(List<String> arguments, Path workingDir) {
        List<String> command = new ArrayList<>();
        command.add(ffmpegPath);
        command.addAll(arguments);

        ProcessBuilder pb = new ProcessBuilder(command)
            .directory(workingDir.toFile())
            .redirectErrorStream(true);  // Merge stderr into stdout

        Process process = pb.start();

        // Read output in a separate thread to prevent buffer deadlock
        String output;
        try (var reader = new BufferedReader(
                new InputStreamReader(process.getInputStream()))) {
            output = reader.lines().collect(Collectors.joining("\n"));
        }

        boolean finished = process.waitFor(timeout.toMillis(), TimeUnit.MILLISECONDS);

        if (!finished) {
            process.destroyForcibly();
            throw new FfmpegException("FFmpeg timed out after " + timeout);
        }

        int exitCode = process.exitValue();
        if (exitCode != 0) {
            throw new FfmpegException("FFmpeg failed with exit code " + exitCode
                + ": " + output);
        }
    }
}
```

### Key Design Decisions

- **`redirectErrorStream(true)`**: Merges stderr into stdout. FFmpeg writes progress and logs to stderr, actual errors also to stderr. Merging simplifies handling — read one stream instead of two. Without this, you must read *both* stdout and stderr concurrently (in separate threads) or the OS pipe buffer can fill and deadlock the process.
- **Read output before `waitFor`**: The OS gives each pipe a fixed buffer (~64KB). If FFmpeg writes more than the buffer can hold and nobody reads it, the process blocks forever. Reading output concurrently prevents this.
- **`waitFor` with timeout**: FFmpeg can hang on corrupted files or problematic codecs. A timeout (e.g., 10 minutes for a 60s video) prevents the worker from getting stuck indefinitely.
- **`destroyForcibly()`**: If the process times out, `destroyForcibly()` sends SIGKILL. Use this over `destroy()` (SIGTERM) because FFmpeg may not respond to graceful shutdown when stuck.
- **Exit code checking**: FFmpeg returns 0 on success, non-zero on failure. Always check.
- **Command as List, not String**: `ProcessBuilder` takes a `List<String>` where each argument is a separate element. This avoids shell-escaping issues. Never use `ProcessBuilder("sh", "-c", "ffmpeg ...")`.
- **Configurable `ffmpegPath`**: Default to `"ffmpeg"` (assumes it's on PATH in Docker), but allow override via config for local development.

### Docker Consideration

The worker Dockerfile needs FFmpeg installed:
```dockerfile
FROM eclipse-temurin:21-jdk-alpine AS build
# ...build stage...

FROM eclipse-temurin:21-jre-alpine
RUN apk add --no-cache ffmpeg
COPY --from=build /app/target/*.jar app.jar
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75.0", "-jar", "app.jar"]
```

### Alternatives Considered

| Alternative | Why Not |
|---|---|
| `Runtime.exec()` | Older API; doesn't support `redirectErrorStream` or easy working directory config; same process but less ergonomic |
| JavaCV / FFmpeg JNI bindings | In-process FFmpeg would crash the JVM on FFmpeg errors; process isolation is safer. Also adds large native dependencies |
| Xuggler / Jaffree | Wrappers around FFmpeg process — add abstraction but also dependency. Direct ProcessBuilder is clearer for a POC |
| Apache Commons Exec | Nice library for process execution with timeout/watchdog support, but adds a dependency for something achievable with ProcessBuilder in ~30 lines |

---

## Summary of Decisions

| # | Topic | Decision | Key Dependency |
|---|---|---|---|
| 1 | R2 Presigned URLs | AWS SDK Java v2 `S3Presigner`, R2 endpoint | `software.amazon.awssdk:s3` |
| 2 | FFmpeg HLS Transcoding | Separate commands per resolution, 6s segments, H.264/AAC, manual master playlist | FFmpeg system binary |
| 3 | Worker Polling | `@Scheduled(fixedDelay)` + `SELECT FOR UPDATE SKIP LOCKED` | Spring Boot (built-in) |
| 4 | React + hls.js | `useRef`/`useEffect` pattern, `Hls.isSupported()` check, Safari native fallback | `hls.js` |
| 5 | R2 Public Bucket | Single bucket, `r2.dev` public URL for POC, CORS policy for frontend | Cloudflare R2 dashboard |
| 6 | Railway Deployment | Docker multi-stage build, Hobby plan, memory-conscious JVM flags | Railway Hobby ($5/mo) |
| 7 | Schema Management | Flyway versioned migrations | `org.flywaydb:flyway-core` |
| 8 | Java FFmpeg Execution | `ProcessBuilder` with merged streams, timeout, exit code check | JDK (built-in) |
