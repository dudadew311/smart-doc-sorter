package com.personal.docsorter.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FileOrganizerServiceTest {

    @Mock
    private AISuggestionService aiService;
    private FileOrganizerService fileOrganizerService;

    @BeforeEach
    void setUp() throws IOException {
        // Manually initialize with dummy paths to avoid null @Value injection issues
        fileOrganizerService = new FileOrganizerService("target/test-staging", "target/test-storage", aiService);
    }

//    @Test
//    public void testHighConfidenceAutoSortsFile() throws Exception {
//        // 1. Create a dummy file so Files.exists(filePath) returns true
//        Path pendingDir = Paths.get("target/test-storage/PENDING");
//        Files.createDirectories(pendingDir);
//        Files.writeString(pendingDir.resolve("test-file.pdf"), "dummy content");
//
//        when(aiService.getSuggestion(anyString(), anyString()))
//                .thenReturn(Map.of("path", "Work/Docs", "confidence", 0.99));
//
//        var result = fileOrganizerService.getAiSuggestionForFile("test-file.pdf");
//
//        // 2. Use getOrDefault to prevent NullPointerException
//        assertTrue((Boolean) result.getOrDefault("autoMoved", false));
//    }
//
//    @Test
//    public void testLowConfidenceLeavesFileInPending() throws Exception {
//        // 1. Create a dummy file
//        Path pendingDir = Paths.get("target/test-storage/PENDING");
//        Files.createDirectories(pendingDir);
//        Files.writeString(pendingDir.resolve("test-file.pdf"), "dummy content");
//
//        when(aiService.getSuggestion(anyString(), anyString()))
//                .thenReturn(Map.of("path", "Misc", "confidence", 0.50));
//
//        var result = fileOrganizerService.getAiSuggestionForFile("test-file.pdf");
//
//        // 2. Use getOrDefault
//        assertFalse((Boolean) result.getOrDefault("autoMoved", true)); // Check it explicitly returns false
//    }

    @Test
    public void testFileTreeExcludesPendingDirectory() throws IOException {
        // Ensure PENDING exists
        Path pending = Paths.get("target/test-storage/PENDING");
        Files.createDirectories(pending);

        Map<String, Object> tree = fileOrganizerService.getFileTree();

        // Check if the tree structure contains "PENDING"
        // This validates the logic: .filter(p -> !p.getFileName().toString().equals("PENDING"))
        String treeJson = tree.toString();
        assertFalse(treeJson.contains("PENDING"), "Tree should not contain PENDING directory");
    }
}