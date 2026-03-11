package com.videoplatform.service;

import com.videoplatform.dto.CreateVideoRequest;
import com.videoplatform.dto.VideoResponse;
import com.videoplatform.exception.InvalidStateTransitionException;
import com.videoplatform.exception.VideoNotFoundException;
import com.videoplatform.model.Video;
import com.videoplatform.model.VideoStatus;
import com.videoplatform.repository.VideoRepository;
import com.videoplatform.storage.StorageService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;
import java.util.UUID;

@Service
public class VideoService {

    private static final Logger log = LoggerFactory.getLogger(VideoService.class);
    private static final long MAX_FILE_SIZE = 524_288_000L; // 500 MB
    private static final Set<String> ALLOWED_CONTENT_TYPES = Set.of(
            "video/mp4", "video/quicktime", "video/x-msvideo", "video/webm"
    );

    private final VideoRepository videoRepository;
    private final StorageService storageService;

    public VideoService(VideoRepository videoRepository, StorageService storageService) {
        this.videoRepository = videoRepository;
        this.storageService = storageService;
    }

    @Transactional
    public VideoResponse createVideo(CreateVideoRequest request) {
        if (!ALLOWED_CONTENT_TYPES.contains(request.contentType())) {
            throw new IllegalArgumentException(
                    "Unsupported file type. Accepted: video/mp4, video/quicktime, video/x-msvideo, video/webm");
        }
        if (request.fileSize() > MAX_FILE_SIZE) {
            throw new IllegalArgumentException("File size exceeds maximum of 500 MB");
        }

        Video video = new Video();
        video.setTitle(request.title());
        video.setDescription(request.description());
        video.setStatus(VideoStatus.UPLOADING);
        video.setFileSize(request.fileSize());
        video.setContentType(request.contentType());

        video = videoRepository.save(video);

        String storageKey = "videos/original/" + video.getId() + "/" + request.fileName();
        video.setOriginalStorageKey(storageKey);
        video = videoRepository.save(video);

        String uploadUrl = storageService.generatePresignedUploadUrl(storageKey, request.contentType());

        log.info("video.upload.initiated videoId={}", video.getId());

        return VideoResponse.from(video, uploadUrl);
    }

    @Transactional
    public VideoResponse completeUpload(UUID videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new VideoNotFoundException("Video not found"));

        if (!video.getStatus().canTransitionTo(VideoStatus.UPLOADED)) {
            throw new InvalidStateTransitionException(
                    "Video cannot be completed — current status: " + video.getStatus());
        }

        video.setStatus(VideoStatus.UPLOADED);
        video = videoRepository.save(video);

        log.info("video.upload.completed videoId={}", video.getId());

        return VideoResponse.from(video);
    }

    @Transactional
    public VideoResponse retryVideo(UUID videoId) {
        Video video = videoRepository.findById(videoId)
                .orElseThrow(() -> new VideoNotFoundException("Video not found"));

        if (!video.getStatus().canTransitionTo(VideoStatus.UPLOADED)) {
            throw new InvalidStateTransitionException(
                    "Only failed videos can be retried — current status: " + video.getStatus());
        }

        video.setStatus(VideoStatus.UPLOADED);
        video = videoRepository.save(video);

        log.info("video.retry.initiated videoId={}", video.getId());

        return VideoResponse.from(video);
    }

    @Transactional(readOnly = true)
    public Page<VideoResponse> listVideos(int page, int size) {
        return videoRepository.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size))
                .map(VideoResponse::from);
    }

    @Transactional(readOnly = true)
    public Video getVideoById(UUID videoId) {
        return videoRepository.findById(videoId)
                .orElseThrow(() -> new VideoNotFoundException("Video not found"));
    }
}
