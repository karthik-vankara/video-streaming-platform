package com.videoplatform.worker.repository;

import com.videoplatform.worker.model.VideoStream;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VideoStreamRepository extends JpaRepository<VideoStream, UUID> {
}
