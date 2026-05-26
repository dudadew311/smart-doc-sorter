package com.personal.docsorter.controller;

import com.personal.docsorter.service.FileOrganizerService;
import org.apache.tika.exception.TikaException;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.xml.sax.SAXException;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final FileOrganizerService fileOrganizerService;

    public DocumentController(FileOrganizerService fileOrganizerService) {
        this.fileOrganizerService = fileOrganizerService;
    }

    @PostMapping("/upload")
    public ResponseEntity<String> upload(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "fullPath", defaultValue = "") String fullPath) {

        // Fallback to original name if fullPath is empty
        String path = fullPath.isEmpty() ? file.getOriginalFilename() : fullPath;
        fileOrganizerService.storeInStaging(file, path);
        return ResponseEntity.ok("SUCCESS");
    }

    @PostMapping("/sort")
    public ResponseEntity<String> sort() {
        return ResponseEntity.ok("NOT_IMPLEMENTED");
    }

    @GetMapping("/pending")
    public ResponseEntity<List<Map<String, Object>>> getPending() {
        return ResponseEntity.ok(fileOrganizerService.listPendingFiles());
    }

    @PostMapping("/categorize")
    public ResponseEntity<String> categorize(@RequestParam String fileName,
                                             @RequestParam String path) throws Exception {
        fileOrganizerService.moveToFinalFolder(fileName, path);
        return ResponseEntity.ok("SUCCESS");
    }

    @GetMapping("/tree")
    public ResponseEntity<Map<String, Object>> getTree() throws IOException {
        return ResponseEntity.ok(fileOrganizerService.getFileTree());
    }

    // Add to DocumentController.java
    @GetMapping("/children")
    public ResponseEntity<List<Map<String, Object>>> getChildren(@RequestParam(defaultValue = "/") String path) throws IOException {
        return ResponseEntity.ok(fileOrganizerService.getChildren(path));
    }


    // Explicitly using Map<String, Object> to ensure compatibility with
    // the List return from the service
    @GetMapping("/suggestions")
    public ResponseEntity<Map<String, Object>> getSuggestions(@RequestParam String fileName) throws IOException, TikaException, SAXException {
        return ResponseEntity.ok(fileOrganizerService.getAiSuggestionForFile(fileName));
    }
}