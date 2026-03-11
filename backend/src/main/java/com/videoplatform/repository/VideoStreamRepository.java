package com.videoplatform.repository;

import com.videoplatform.model.VideoStream;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface VideoStreamRepository extends JpaRepository<VideoStream, UUID> {

    List<VideoStream> findByVideoId(UUID videoId);
}
