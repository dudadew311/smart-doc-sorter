package com.personal.docsorter.controller;

import com.personal.docsorter.service.StorageService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Path;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/documents")
public class DocumentController {

    private final StorageService storageService;

    // Constructor injection: Spring automatically connects our service to this controller
    public DocumentController(StorageService storageService) {
        this.storageService = storageService;
    }

    @PostMapping("/upload")
    public ResponseEntity<Map<String, String>> uploadDocument(@RequestParam("file") MultipartFile file) {
        Path stagedPath = storageService.storeInStaging(file);

        return ResponseEntity.ok(Map.of(
                "status", "SUCCESS",
                "message", "Document staged successfully.",
                "fileName", stagedPath.getFileName().toString()
        ));
    }
}