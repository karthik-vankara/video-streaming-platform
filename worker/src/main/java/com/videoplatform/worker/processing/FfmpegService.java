package com.videoplatform.worker.processing;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;

@Service
public class FfmpegService {

    private static final Logger log = LoggerFactory.getLogger(FfmpegService.class);

    private final String ffmpegPath;
    private final String ffprobePath;

    public FfmpegService(@Value("${worker.ffmpeg-path:ffmpeg}") String ffmpegPath,
                         @Value("${worker.ffprobe-path:ffprobe}") String ffprobePath) {
        this.ffmpegPath = ffmpegPath;
        this.ffprobePath = ffprobePath;
    }

    public void transcodeToHls(Path inputFile, Path outputDir, String resolution) throws IOException, InterruptedException {
        Files.createDirectories(outputDir);

        String scale;
        String crf;
        String maxrate;
        String bufsize;
        String audioBitrate;

        if ("360p".equals(resolution)) {
            scale = "scale=640:360:force_original_aspect_ratio=decrease,pad=640:360:(ow-iw)/2:(oh-ih)/2";
            crf = "28";
            maxrate = "800k";
            bufsize = "1200k";
            audioBitrate = "96k";
        } else {
            scale = "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2";
            crf = "23";
            maxrate = "2500k";
            bufsize = "5000k";
            audioBitrate = "128k";
        }

        String segmentPattern = outputDir.resolve("segment_%03d.ts").toString();
        String playlistPath = outputDir.resolve("playlist.m3u8").toString();

        ProcessBuilder pb = new ProcessBuilder(
                ffmpegPath, "-i", inputFile.toString(),
                "-vf", scale,
                "-c:v", "libx264", "-preset", "medium", "-crf", crf,
                "-maxrate", maxrate, "-bufsize", bufsize,
                "-c:a", "aac", "-b:a", audioBitrate, "-ac", "2",
                "-g", "48", "-keyint_min", "48", "-sc_threshold", "0",
                "-f", "hls",
                "-hls_time", "6",
                "-hls_playlist_type", "vod",
                "-hls_flags", "independent_segments",
                "-hls_segment_type", "mpegts",
                "-hls_segment_filename", segmentPattern,
                playlistPath
        );

        pb.redirectErrorStream(true);
        log.info("Starting {} transcode: {}", resolution, String.join(" ", pb.command()));

        runProcess(pb, "FFmpeg " + resolution + " transcode");
    }

    public void extractThumbnail(Path inputFile, Path outputFile) throws IOException, InterruptedException {
        Files.createDirectories(outputFile.getParent());

        double duration = getVideoDuration(inputFile);
        String seekTime = duration >= 2.0 ? "2" : "0";

        ProcessBuilder pb = new ProcessBuilder(
                ffmpegPath, "-i", inputFile.toString(),
                "-ss", seekTime,
                "-frames:v", "1",
                "-q:v", "2",
                outputFile.toString()
        );
        pb.redirectErrorStream(true);

        log.info("Extracting thumbnail at {}s from {}", seekTime, inputFile);
        runProcess(pb, "thumbnail extraction");
    }

    private double getVideoDuration(Path inputFile) {
        try {
            ProcessBuilder pb = new ProcessBuilder(
                    ffprobePath, "-v", "error",
                    "-show_entries", "format=duration",
                    "-of", "csv=p=0",
                    inputFile.toString()
            );
            pb.redirectErrorStream(true);
            Process process = pb.start();

            String output;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
                output = reader.readLine();
            }

            int exitCode = process.waitFor();
            if (exitCode == 0 && output != null && !output.isBlank()) {
                return Double.parseDouble(output.trim());
            }
        } catch (Exception e) {
            log.warn("Could not determine video duration, defaulting to 0: {}", e.getMessage());
        }
        return 0.0;
    }

    private void runProcess(ProcessBuilder pb, String description) throws IOException, InterruptedException {
        Process process = pb.start();

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()))) {
            String line;
            while ((line = reader.readLine()) != null) {
                log.debug("[{}] {}", description, line);
            }
        }

        int exitCode = process.waitFor();
        if (exitCode != 0) {
            throw new IOException(description + " failed with exit code " + exitCode);
        }
        log.info("{} completed successfully", description);
    }
}
