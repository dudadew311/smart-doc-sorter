package com.personal.docsorter.service;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.Comparator;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
public class FileOrganizerServiceTest {

    @Mock
    private AISuggestionService aiService;
    private FileOrganizerService fileOrganizerService;
    private final String STAGING = "target/test-staging";
    private final String STORAGE = "target/test-storage";

    @BeforeEach
    void setUp() throws IOException {
        fileOrganizerService = new FileOrganizerService(STAGING, STORAGE, aiService);
    }

    @AfterEach
    void tearDown() throws IOException {
        // Cleanup created directories
        Path storagePath = Paths.get(STORAGE);
        if (Files.exists(storagePath)) {
            Files.walk(storagePath)
                    .sorted(Comparator.reverseOrder())
                    .map(Path::toFile)
                    .forEach(java.io.File::delete);
        }
    }

    @Test
    public void testFileTreeExcludesPendingDirectory() throws IOException {
        Path pending = Paths.get(STORAGE, "PENDING");
        Files.createDirectories(pending);
        Map<String, Object> tree = fileOrganizerService.getFileTree();
        assertFalse(tree.toString().contains("PENDING"), "Tree should not contain PENDING directory");
    }

    @Test
    public void testListPendingFiles() throws IOException {
        Path pending = Paths.get(STORAGE, "PENDING");
        Files.createDirectories(pending);
        Files.writeString(pending.resolve("test.txt"), "hello");

        var files = fileOrganizerService.listPendingFiles();
        assertEquals(1, files.size());
        assertEquals("test.txt", files.get(0).get("name"));
    }

    @Test
    public void testDeletePendingFile() throws IOException {
        Path pending = Paths.get(STORAGE, "PENDING");
        Files.createDirectories(pending);
        Path file = pending.resolve("delete-me.txt");
        Files.writeString(file, "content");

        fileOrganizerService.deletePendingFile("delete-me.txt");
        assertFalse(Files.exists(file));
    }

    @Test
    public void testMoveToFinalFolder() throws IOException {
        Path pending = Paths.get(STORAGE, "PENDING");
        Files.createDirectories(pending);
        Files.writeString(pending.resolve("move-me.txt"), "content");

        fileOrganizerService.moveToFinalFolder("move-me.txt", "Archive");

        assertTrue(Files.exists(Paths.get(STORAGE, "Archive", "move-me.txt")));
        assertFalse(Files.exists(pending.resolve("move-me.txt")));
    }
}