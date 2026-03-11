package com.videoplatform.storage;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.PresignedPutObjectRequest;

import java.time.Duration;

@Service
public class StorageService {

    private final S3Presigner presigner;
    private final String bucketName;

    public StorageService(S3Presigner presigner,
                          @Value("${r2.bucket-name}") String bucketName) {
        this.presigner = presigner;
        this.bucketName = bucketName;
    }

    public String generatePresignedUploadUrl(String objectKey, String contentType) {
        PresignedPutObjectRequest presignedRequest = presigner.presignPutObject(b -> b
                .signatureDuration(Duration.ofMinutes(15))
                .putObjectRequest(por -> por
                        .bucket(bucketName)
                        .key(objectKey)
                        .contentType(contentType)));
        return presignedRequest.url().toString();
    }
}
