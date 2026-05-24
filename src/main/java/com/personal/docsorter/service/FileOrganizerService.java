package com.personal.docsorter.service;

import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FileOrganizerService {
    private final Path stagingPath;
    private final Path targetPath;
    private final Tika tika = new Tika();
    private final RestTemplate restTemplate = new RestTemplate();
    private final String OLLAMA_URL = "http://localhost:11434/api/generate";

    public FileOrganizerService(@Value("${app.storage.staging-dir}") String stagingDir,
                                @Value("${app.storage.target-dir}") String targetDir) throws IOException {
        this.stagingPath = Paths.get(stagingDir).toAbsolutePath();
        this.targetPath = Paths.get(targetDir).toAbsolutePath();
        Files.createDirectories(this.stagingPath);
        Files.createDirectories(this.targetPath.resolve("PENDING"));
    }

    // 1. Store in Staging
    public void storeInStaging(MultipartFile file) {
        try {
            String fileName = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
            Files.copy(file.getInputStream(), stagingPath.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) { throw new RuntimeException("Could not store file", e); }
    }

    // 2. List Pending
    public List<String> listPendingFiles() {
        try (var paths = Files.list(targetPath.resolve("PENDING"))) {
            return paths.filter(Files::isRegularFile)
                    .map(p -> p.getFileName().toString())
                    .collect(Collectors.toList());
        } catch (IOException e) { return List.of(); }
    }

    // 3. Move to Final
    public void moveToFinalFolder(String fileName, String category, String subfolder) throws IOException {
        Path source = targetPath.resolve("PENDING").resolve(fileName);
        Path destDir = targetPath.resolve(category).resolve(subfolder);
        Files.createDirectories(destDir);
        Files.move(source, destDir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
    }

    public void processStagedFiles() throws Exception {
        try (var paths = Files.list(stagingPath)) {
            paths.filter(Files::isRegularFile).forEach(this::processFile);
        }
    }

    private void processFile(Path file) {
        try {
            String content = tika.parseToString(file.toFile());
            if (content.length() > 1000) content = content.substring(0, 1000);

            // Strict Prompt: JSON only
            String prompt = "Analyze this: " + content +
                    ". Respond ONLY in JSON: {\"category\": \"...\", \"subfolder\": \"...\"}";

            Map<String, Object> request = Map.of("model", "llama3", "prompt", prompt, "stream", false);
            Map response = restTemplate.postForObject(OLLAMA_URL, request, Map.class);

            // Here you would add logic to parse JSON response safely
            // If parsing fails or AI is unsure -> move to targetPath/PENDING

        } catch (Exception e) {
            moveToPending(file);
        }
    }

    private void moveToPending(Path file) {
        try {
            Path pending = targetPath.resolve("PENDING");
            Files.createDirectories(pending);
            Files.move(file, pending.resolve(file.getFileName()));
        } catch (Exception e) { e.printStackTrace(); }
    }
}
