package com.videoplatform.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

public record CreateVideoRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 255, message = "Title must be 255 characters or less")
        String title,

        @Size(max = 5000, message = "Description must be 5000 characters or less")
        String description,

        @NotBlank(message = "File name is required")
        String fileName,

        @NotNull(message = "File size is required")
        @Positive(message = "File size must be positive")
        Long fileSize,

        @NotBlank(message = "Content type is required")
        String contentType
) {}
