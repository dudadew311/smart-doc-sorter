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

    public void storeInStaging(MultipartFile file, String fullPath) {
        try {
            Path target = this.targetPath.resolve("PENDING").resolve(fullPath);
            Files.createDirectories(target.getParent()); // This builds the subfolders
            Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new RuntimeException("Storage failed", e);
        }
    }

    public List<Map<String, Object>> listPendingFiles() {
        Path pendingDir = targetPath.resolve("PENDING");
        try (var stream = Files.list(pendingDir)) {
            return stream.map(p -> {
                Map<String, Object> map = new HashMap<>();
                map.put("name", p.getFileName().toString());
                map.put("isDirectory", Files.isDirectory(p));
                return map;
            }).collect(Collectors.toList());
        } catch (IOException e) { return Collections.emptyList(); }
    }

    public void moveToFinalFolder(String itemName, String targetFolder) throws IOException {
        Path source = targetPath.resolve("PENDING").resolve(itemName);
        Path destinationRoot = targetPath.resolve(targetFolder);
        Path destination = destinationRoot.resolve(itemName);

        Files.createDirectories(destinationRoot);

        // Check if it's a directory and move recursively if necessary
        if (Files.isDirectory(source)) {
            // Use a simple move which handles directory content if the destination
            // structure is clean.
            Files.move(source, destination, StandardCopyOption.REPLACE_EXISTING);
        } else {
            Files.move(source, destination, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    public Map<String, Object> getAiSuggestionForFile(String itemName) throws IOException, TikaException, SAXException {
        Path itemPath = targetPath.resolve("PENDING").resolve(itemName);
        String contentToAnalyze = "";

        // Recursive extraction for folders, simple extraction for files
        if (Files.isDirectory(itemPath)) {
            contentToAnalyze = Files.walk(itemPath)
                    .filter(Files::isRegularFile)
                    .limit(10)
                    .map(this::extractTextFromPath)
                    .map(text -> text.length() > 2000 ? text.substring(0, 2000) : text)
                    .collect(Collectors.joining("\n\n"));
        } else {
            contentToAnalyze = extractTextFromPath(itemPath);
        }

        // Call the AI. If this fails or returns UNCATEGORIZED, the UI will fallback
        return aiService.getSuggestion(contentToAnalyze, getFileTreeAsString());
    }

    // Helper method to keep the logic clean
    private String getFileTreeAsString() {
        try {
            // Assuming getFileTree() exists and returns a Map/Object
            return getFileTree().toString();
        } catch (IOException e) {
            return "[]";
        }
    }

    // Extractor helper
    private String extractTextFromPath(Path p) {
        try (InputStream is = Files.newInputStream(p)) {
            BodyContentHandler handler = new BodyContentHandler(-1);
            AutoDetectParser parser = new AutoDetectParser();
            parser.parse(is, handler, new Metadata());
            return handler.toString();
        } catch (Exception e) {
            return "[Could not read file]";
        }
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

    public List<Map<String, Object>> getChildren(String path) throws IOException {
        // Treat "/" as the target directory root
        Path dir = path.equals("/") ? targetPath : targetPath.resolve(path.substring(1));

        try (var stream = Files.list(dir)) {
            return stream
                    .filter(p -> !p.getFileName().toString().equals("PENDING"))
                    .map(p -> {
                        Map<String, Object> node = new LinkedHashMap<>();
                        node.put("name", p.getFileName().toString());
                        node.put("isDirectory", Files.isDirectory(p));
                        node.put("path", "/" + targetPath.relativize(p).toString());
                        return node;
                    })
                    .collect(Collectors.toList());
        }
    }
}