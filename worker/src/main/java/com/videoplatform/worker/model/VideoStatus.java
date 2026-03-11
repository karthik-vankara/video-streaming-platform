package com.videoplatform.worker.model;

import java.util.Map;
import java.util.Set;

public enum VideoStatus {
    UPLOADING,
    UPLOADED,
    PROCESSING,
    READY,
    FAILED;

    private static final Map<VideoStatus, Set<VideoStatus>> VALID_TRANSITIONS = Map.of(
            UPLOADING, Set.of(UPLOADED),
            UPLOADED, Set.of(PROCESSING),
            PROCESSING, Set.of(READY, FAILED),
            READY, Set.of(),
            FAILED, Set.of(UPLOADED)
    );

    public boolean canTransitionTo(VideoStatus target) {
        return VALID_TRANSITIONS.getOrDefault(this, Set.of()).contains(target);
    }
}
