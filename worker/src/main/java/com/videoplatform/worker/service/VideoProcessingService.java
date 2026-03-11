package com.videoplatform.worker.service;

import com.videoplatform.worker.model.Video;
import com.videoplatform.worker.model.VideoStatus;
import com.videoplatform.worker.model.VideoStream;
import com.videoplatform.worker.processing.FfmpegService;
import com.videoplatform.worker.repository.VideoRepository;
import com.videoplatform.worker.repository.VideoStreamRepository;
import com.videoplatform.worker.storage.R2StorageService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.PersistenceContext;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.List;
import java.util.UUID;

@Service
public class VideoProcessingService {

    private static final Logger log = LoggerFactory.getLogger(VideoProcessingService.class);
    private static final String[] RESOLUTIONS = {"360p", "720p"};

    @PersistenceContext
    private EntityManager entityManager;

    private final VideoRepository videoRepository;
    private final VideoStreamRepository videoStreamRepository;
    private final R2StorageService storageService;
    private final FfmpegService ffmpegService;
    private final String publicUrl;

    public VideoProcessingService(VideoRepository videoRepository,
                                  VideoStreamRepository videoStreamRepository,
                                  R2StorageService storageService,
                                  FfmpegService ffmpegService,
                                  @Value("${r2.public-url}") String publicUrl) {
        this.videoRepository = videoRepository;
        this.videoStreamRepository = videoStreamRepository;
        this.storageService = storageService;
        this.ffmpegService = ffmpegService;
        this.publicUrl = publicUrl;
    }

    @Transactional
    public void processNextVideo() {
        List<Video> videos = entityManager.createQuery(
                        "SELECT v FROM Video v WHERE v.status = :status ORDER BY v.createdAt ASC",
                        Video.class)
                .setParameter("status", VideoStatus.UPLOADED)
                .setMaxResults(1)
                .setLockMode(LockModeType.PESSIMISTIC_WRITE)
                .setHint("jakarta.persistence.lock.timeout", -2) // SKIP LOCKED
                .getResultList();

        if (videos.isEmpty()) return;

        Video video = videos.get(0);
        video.setStatus(VideoStatus.PROCESSING);
        entityManager.flush();

        log.info("processing.started videoId={}", video.getId());

        Path workDir = null;
        try {
            workDir = Files.createTempDirectory("video-processing-" + video.getId());
            processVideo(video, workDir);
            video.setStatus(VideoStatus.READY);
            videoRepository.save(video);
            log.info("processing.completed videoId={}", video.getId());
        } catch (Exception e) {
            log.error("processing.failed videoId={} error={}", video.getId(), e.getMessage(), e);
            video.setStatus(VideoStatus.FAILED);
            videoRepository.save(video);
        } finally {
            cleanupWorkDir(workDir);
        }
    }

    private void processVideo(Video video, Path workDir) throws IOException, InterruptedException {
        UUID videoId = video.getId();
        String storageKey = video.getOriginalStorageKey();

        // 1. Download original
        String fileName = storageKey.substring(storageKey.lastIndexOf('/') + 1);
        Path inputFile = workDir.resolve(fileName);
        storageService.downloadToFile(storageKey, inputFile);

        // 2. Extract thumbnail
        Path thumbnailFile = workDir.resolve("thumbnail.jpg");
        ffmpegService.extractThumbnail(inputFile, thumbnailFile);
        String thumbnailKey = "videos/thumbnails/" + videoId + "/thumbnail.jpg";
        storageService.uploadFile(thumbnailKey, thumbnailFile, "image/jpeg");
        video.setThumbnailUrl(publicUrl + "/" + thumbnailKey);

        // 3. Transcode to each resolution
        for (String resolution : RESOLUTIONS) {
            Path resDir = workDir.resolve(resolution);
            ffmpegService.transcodeToHls(inputFile, resDir, resolution);

            // Upload all HLS files (.m3u8 and .ts)
            String baseKey = "videos/processed/" + videoId + "/" + resolution;
            uploadDirectory(resDir, baseKey);

            // Create stream record
            String playlistUrl = publicUrl + "/" + baseKey + "/playlist.m3u8";
            VideoStream stream = new VideoStream();
            stream.setVideo(video);
            stream.setResolution(resolution);
            stream.setPlaylistUrl(playlistUrl);
            videoStreamRepository.save(stream);
        }

        // 4. Generate and upload master playlist
        String masterPlaylist = generateMasterPlaylist();
        Path masterFile = workDir.resolve("master.m3u8");
        Files.writeString(masterFile, masterPlaylist);
        String masterKey = "videos/processed/" + videoId + "/master.m3u8";
        storageService.uploadFile(masterKey, masterFile, "application/vnd.apple.mpegurl");
        video.setMasterPlaylistUrl(publicUrl + "/" + masterKey);
    }

    private String generateMasterPlaylist() {
        return """
                #EXTM3U
                #EXT-X-VERSION:3
                #EXT-X-STREAM-INF:BANDWIDTH=896000,RESOLUTION=640x360,CODECS="avc1.42e01e,mp4a.40.2"
                360p/playlist.m3u8
                #EXT-X-STREAM-INF:BANDWIDTH=2628000,RESOLUTION=1280x720,CODECS="avc1.4d401f,mp4a.40.2"
                720p/playlist.m3u8
                """;
    }

    private void uploadDirectory(Path dir, String baseKey) throws IOException {
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(dir)) {
            for (Path file : stream) {
                if (Files.isRegularFile(file)) {
                    String fileName = file.getFileName().toString();
                    String contentType = fileName.endsWith(".m3u8")
                            ? "application/vnd.apple.mpegurl"
                            : "video/mp2t";
                    storageService.uploadFile(baseKey + "/" + fileName, file, contentType);
                }
            }
        }
    }

    private void cleanupWorkDir(Path workDir) {
        if (workDir == null) return;
        try {
            Files.walkFileTree(workDir, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.delete(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.delete(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            log.warn("Failed to cleanup work directory {}: {}", workDir, e.getMessage());
        }
    }
}
