package com.videoplatform.worker.storage;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;

@Service
public class R2StorageService {

    private static final Logger log = LoggerFactory.getLogger(R2StorageService.class);

    private final S3Client s3Client;
    private final String bucketName;

    public R2StorageService(S3Client s3Client,
                            @Value("${r2.bucket-name}") String bucketName) {
        this.s3Client = s3Client;
        this.bucketName = bucketName;
    }

    public void downloadToFile(String objectKey, Path destination) throws IOException {
        log.info("Downloading s3://{}/{} to {}", bucketName, objectKey, destination);
        Files.createDirectories(destination.getParent());

        try (InputStream is = s3Client.getObject(GetObjectRequest.builder()
                .bucket(bucketName)
                .key(objectKey)
                .build())) {
            Files.copy(is, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public void uploadFile(String objectKey, Path source, String contentType) {
        log.info("Uploading {} to s3://{}/{}", source, bucketName, objectKey);
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucketName)
                        .key(objectKey)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromFile(source));
    }
}
