package com.personal.docsorter.service;

import org.apache.tika.Tika;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.multipart.MultipartFile;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.sax.BodyContentHandler;
import java.io.FileInputStream;

import java.io.IOException;
import java.io.InputStream;
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
    private final AISuggestionService aiService;

    public FileOrganizerService(@Value("${app.storage.staging-dir}") String stagingDir,
                                @Value("${app.storage.target-dir}") String targetDir,
                                AISuggestionService aiService) throws IOException {
        this.stagingPath = Paths.get(stagingDir).toAbsolutePath();
        this.targetPath = Paths.get(targetDir).toAbsolutePath();
        this.aiService = aiService;
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

    public Map<String, Object> getFileTree() throws IOException {
        return buildNode(targetPath);
    }

    private Map<String, Object> buildNode(Path path) throws IOException {
        Map<String, Object> node = new LinkedHashMap<>();
        node.put("name", path.getFileName().toString());
        node.put("isDirectory", Files.isDirectory(path));

        if (Files.isDirectory(path)) {
            try (var children = Files.list(path)) {
                List<Map<String, Object>> childNodes = children
                        .filter(p -> !p.getFileName().toString().equals("PENDING"))
                        .map(p -> {
                            try { return buildNode(p); }
                            catch (IOException e) { return null; }
                        })
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList());
                node.put("children", childNodes);
            }
        }
        return node;
    }

    public Map<String, String> getAiSuggestionForFile(String fileName) {
        // 1. Sanitize the path - prevent "No such file" due to accidental trailing spaces/chars
        String sanitizedName = fileName.trim();
        Path filePath = targetPath.resolve("PENDING").resolve(sanitizedName);

        // 2. Defensive check
        if (!Files.exists(filePath)) {
            System.err.println("File not found: " + filePath);
            return Map.of("category", "UNCATEGORIZED", "subfolder", "MISC");
        }

        try {
            // 3. Use BodyContentHandler to ensure deep parsing for .docx, .rtf, .pdf
            BodyContentHandler handler = new BodyContentHandler(-1);
            AutoDetectParser parser = new AutoDetectParser();
            Metadata metadata = new Metadata();

            try (InputStream is = Files.newInputStream(filePath)) {
                parser.parse(is, handler, metadata);
            }

            String content = handler.toString().trim();

            // 4. Return fallback if empty instead of throwing error
            if (content.isEmpty()) {
                return Map.of("category", "UNCATEGORIZED", "subfolder", "MISC");
            }

            return aiService.getSuggestion(content.length() > 1000 ? content.substring(0, 1000) : content);

        } catch (Exception e) {
            // Silently log and return neutral state to prevent UI red text
            System.err.println("Parsing error: " + e.getMessage());
            return Map.of("category", "UNCATEGORIZED", "subfolder", "MISC");
        }
    }
}
