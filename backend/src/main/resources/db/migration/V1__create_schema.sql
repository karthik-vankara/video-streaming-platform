-- Video metadata and lifecycle
CREATE TABLE videos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title                 VARCHAR(255) NOT NULL,
    description           TEXT,
    status                VARCHAR(20) NOT NULL DEFAULT 'UPLOADING',
    original_storage_key  VARCHAR(500),
    thumbnail_url         VARCHAR(500),
    master_playlist_url   VARCHAR(500),
    file_size             BIGINT,
    content_type          VARCHAR(100),
    created_at            TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at            TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Per-resolution transcoded streams
CREATE TABLE video_streams (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id      UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    resolution    VARCHAR(10) NOT NULL,
    playlist_url  VARCHAR(500) NOT NULL,
    created_at    TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_videos_status ON videos(status);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_video_streams_video_id ON video_streams(video_id);
