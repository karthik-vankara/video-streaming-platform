package com.videoplatform.worker.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
public class VideoProcessingScheduler {

    private static final Logger log = LoggerFactory.getLogger(VideoProcessingScheduler.class);

    private final VideoProcessingService processingService;

    public VideoProcessingScheduler(VideoProcessingService processingService) {
        this.processingService = processingService;
    }

    @Scheduled(fixedDelayString = "${worker.poll-interval:15000}")
    public void pollForWork() {
        log.debug("Polling for uploaded videos to process");
        processingService.processNextVideo();
    }
}
