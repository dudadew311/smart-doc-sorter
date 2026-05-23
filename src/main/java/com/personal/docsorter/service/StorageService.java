package com.personal.docsorter.service;

import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.Objects;

@Service
public class StorageService {

    private static final Logger log = LoggerFactory.getLogger(StorageService.class);

    private final Path stagingStoragePath;
    private final Path targetStoragePath;

    public StorageService(
            @Value("${app.storage.staging-dir}") String stagingDir,
            @Value("${app.storage.target-dir}") String targetDir) {
        this.stagingStoragePath = Paths.get(stagingDir).toAbsolutePath().normalize();
        this.targetStoragePath = Paths.get(targetDir).toAbsolutePath().normalize();
    }

    @PostConstruct
    public void init() {
        try {
            Files.createDirectories(stagingStoragePath);
            Files.createDirectories(targetStoragePath);
            log.info("Storage directories initialized cleanly:\nStaging: {}\nTarget: {}",
                    stagingStoragePath, targetStoragePath);
        } catch (IOException e) {
            throw new RuntimeException("Could not initialize storage directory structures.", e);
        }
    }

    public Path storeInStaging(MultipartFile file) {
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Failed to store empty file.");
        }

        String cleanedFilename = StringUtils.cleanPath(
                Objects.requireNonNull(file.getOriginalFilename())
        );

        try {
            Path destinationFile = this.stagingStoragePath.resolve(cleanedFilename)
                    .normalize().toAbsolutePath();

            if (!destinationFile.getParent().equals(this.stagingStoragePath)) {
                throw new IllegalArgumentException("Cannot store file outside designated staging directory.");
            }

            Files.copy(file.getInputStream(), destinationFile, StandardCopyOption.REPLACE_EXISTING);
            log.info("Successfully staged file: {}", cleanedFilename);

            return destinationFile;
        } catch (IOException e) {
            throw new RuntimeException("Failed to store file in staging area.", e);
        }
    }
}