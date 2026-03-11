package com.videoplatform.controller;

import com.videoplatform.dto.ApiResponse;
import com.videoplatform.dto.CreateVideoRequest;
import com.videoplatform.dto.VideoResponse;
import com.videoplatform.model.Video;
import com.videoplatform.service.VideoService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/videos")
public class VideoController {

    private final VideoService videoService;

    public VideoController(VideoService videoService) {
        this.videoService = videoService;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<VideoResponse>> createVideo(
            @Valid @RequestBody CreateVideoRequest request) {
        VideoResponse response = videoService.createVideo(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiResponse.success(response));
    }

    @PostMapping("/{id}/complete")
    public ResponseEntity<ApiResponse<VideoResponse>> completeUpload(@PathVariable UUID id) {
        VideoResponse response = videoService.completeUpload(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @PostMapping("/{id}/retry")
    public ResponseEntity<ApiResponse<VideoResponse>> retryVideo(@PathVariable UUID id) {
        VideoResponse response = videoService.retryVideo(id);
        return ResponseEntity.ok(ApiResponse.success(response));
    }

    @GetMapping
    public ResponseEntity<ApiResponse<Map<String, Object>>> listVideos(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        if (size < 1 || size > 100) {
            return ResponseEntity.badRequest()
                    .body(ApiResponse.error("Page size must be between 1 and 100"));
        }

        Page<VideoResponse> videoPage = videoService.listVideos(page, size);

        Map<String, Object> pageData = new LinkedHashMap<>();
        pageData.put("content", videoPage.getContent());
        pageData.put("page", videoPage.getNumber());
        pageData.put("size", videoPage.getSize());
        pageData.put("totalElements", videoPage.getTotalElements());
        pageData.put("totalPages", videoPage.getTotalPages());

        return ResponseEntity.ok(ApiResponse.success(pageData));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ApiResponse<VideoResponse>> getVideo(@PathVariable UUID id) {
        Video video = videoService.getVideoById(id);
        return ResponseEntity.ok(ApiResponse.success(VideoResponse.from(video)));
    }
}
