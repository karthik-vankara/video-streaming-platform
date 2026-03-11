package com.videoplatform.repository;

import com.videoplatform.model.Video;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface VideoRepository extends JpaRepository<Video, UUID> {

    Page<Video> findAllByOrderByCreatedAtDesc(Pageable pageable);
}
