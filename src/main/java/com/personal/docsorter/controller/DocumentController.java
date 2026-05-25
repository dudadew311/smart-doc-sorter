package com.personal.docsorter.controller;

import com.personal.docsorter.service.FileOrganizerService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final FileOrganizerService fileOrganizerService;

    public DocumentController(FileOrganizerService fileOrganizerService) {
        this.fileOrganizerService = fileOrganizerService;
    }

    // 1. Upload (You'll need a simple storeInStaging method in FileOrganizerService)
    @PostMapping("/upload")
    public ResponseEntity<String> upload(@RequestParam("file") MultipartFile file) {
        fileOrganizerService.storeInStaging(file);
        return ResponseEntity.ok("SUCCESS");
    }

    // 2. Trigger the "Smart" Sort
    @PostMapping("/sort")
    public ResponseEntity<String> sort() throws Exception {
        fileOrganizerService.processStagedFiles();
        return ResponseEntity.ok("BATCH_COMPLETE");
    }

    // 3. Pending List (Need this for your Center Pane)
    @GetMapping("/pending")
    public ResponseEntity<List<String>> getPending() {
        return ResponseEntity.ok(fileOrganizerService.listPendingFiles());
    }

    // 4. Categorize (Need this for your Manual Review)
    @PostMapping("/categorize")
    public ResponseEntity<String> categorize(@RequestParam String fileName,
                                             @RequestParam String category,
                                             @RequestParam String subfolder) throws Exception {
        fileOrganizerService.moveToFinalFolder(fileName, category, subfolder);
        return ResponseEntity.ok("SUCCESS");
    }

    @GetMapping("/tree")
    public ResponseEntity<Map<String, Object>> getTree() throws IOException {
        return ResponseEntity.ok(fileOrganizerService.getFileTree());
    }

    @GetMapping("/suggestions")
    public ResponseEntity<Map<String, String>> getSuggestions(@RequestParam String fileName) {
        return ResponseEntity.ok(fileOrganizerService.getAiSuggestionForFile(fileName));
    }
}