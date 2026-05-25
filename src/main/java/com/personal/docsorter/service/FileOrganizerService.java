package com.personal.docsorter.service;

import org.apache.tika.exception.TikaException;
import org.apache.tika.metadata.Metadata;
import org.apache.tika.parser.AutoDetectParser;
import org.apache.tika.sax.BodyContentHandler;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.SAXException;

import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class FileOrganizerService {
    private final Path stagingPath;
    private final Path targetPath;
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

    public void storeInStaging(MultipartFile file) {
        try {
            String fileName = StringUtils.cleanPath(Objects.requireNonNull(file.getOriginalFilename()));
            // Save directly to the PENDING directory to await categorization
            Files.copy(file.getInputStream(), this.targetPath.resolve("PENDING").resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Could not store file.", e);
        }
    }

    public List<String> listPendingFiles() {
        try (var files = Files.list(targetPath.resolve("PENDING"))) {
            return files.map(p -> p.getFileName().toString()).collect(Collectors.toList());
        } catch (IOException e) { return Collections.emptyList(); }
    }

    public void moveToFinalFolder(String fileName, String fullPath) throws IOException {
        Path destDir = targetPath.resolve(fullPath);
        Files.createDirectories(destDir);
        Files.move(targetPath.resolve("PENDING").resolve(fileName), destDir.resolve(fileName), StandardCopyOption.REPLACE_EXISTING);
    }

    public Map<String, Object> getAiSuggestionForFile(String fileName) throws IOException, TikaException, SAXException {
        Path filePath = targetPath.resolve("PENDING").resolve(fileName.trim());
        if (!Files.exists(filePath)) return Map.of("options", List.of("UNCATEGORIZED"));

        // Extract text content from the file
        BodyContentHandler handler = new BodyContentHandler(-1);
        AutoDetectParser parser = new AutoDetectParser();
        try (InputStream is = Files.newInputStream(filePath)) {
            parser.parse(is, handler, new Metadata());
        }

        // Get AI logic result
        Map<String, Object> aiResult = aiService.getSuggestion(handler.toString(), getFileTree().toString());
        double confidence = ((Number) aiResult.getOrDefault("confidence", 0.0)).doubleValue();

        // High Confidence Gatekeeper: Auto-move if confidence >= 0.99
        if (confidence >= 0.99) {
            moveToFinalFolder(fileName, (String) aiResult.get("path"));
            return Map.of("options", List.of("Auto-sorted to " + aiResult.get("path")), "autoMoved", true);
        }

        // Low Confidence: Return primary path + alternatives
        List<String> options = new ArrayList<>();
        options.add((String) aiResult.get("path"));
        options.addAll((List<String>) aiResult.getOrDefault("alternatives", new ArrayList<>()));

        return Map.of("options", options, "autoMoved", false);
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
                        .map(p -> { try { return buildNode(p); } catch (IOException e) { return null; } })
                        .filter(Objects::nonNull)
                        .collect(Collectors.toList());
                node.put("children", childNodes);
            }
        }
        return node;
    }
}