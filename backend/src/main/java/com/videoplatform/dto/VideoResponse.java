package com.videoplatform.dto;

import com.videoplatform.model.Video;

import java.time.Instant;
import java.util.UUID;

public record VideoResponse(
        UUID id,
        String title,
        String description,
        String status,
        String uploadUrl,
        String thumbnailUrl,
        String masterPlaylistUrl,
        Long fileSize,
        String contentType,
        Instant createdAt,
        Instant updatedAt
) {
    public static VideoResponse from(Video video) {
        return from(video, null);
    }

    public static VideoResponse from(Video video, String uploadUrl) {
        return new VideoResponse(
                video.getId(),
                video.getTitle(),
                video.getDescription(),
                video.getStatus().name(),
                uploadUrl,
                video.getThumbnailUrl(),
                video.getMasterPlaylistUrl(),
                video.getFileSize(),
                video.getContentType(),
                video.getCreatedAt(),
                video.getUpdatedAt()
        );
    }
}
