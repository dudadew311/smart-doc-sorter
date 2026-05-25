package com.personal.docsorter.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@Service
public class AISuggestionService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String OLLAMA_URL = "http://localhost:11434/api/generate";

    public Map<String, Object> getSuggestion(String fileContent, String currentTree) {
        try {
            String prompt = "You are a professional filing assistant. Current structure: " + currentTree +
                    ". Analyze the content and suggest a folder path. " +
                    "Return ONLY a JSON object: {\"path\": \"Folder/Sub\", \"confidence\": 0.95, \"alternatives\": [\"Alt1\", \"Alt2\"]}. " +
                    "Content: " + fileContent;

            Map<String, Object> request = Map.of("model", "llama3", "prompt", prompt, "stream", false);
            Map response = restTemplate.postForObject(OLLAMA_URL, request, Map.class);
            String aiString = (String) response.get("response");

            int start = aiString.indexOf("{");
            int end = aiString.lastIndexOf("}");
            return objectMapper.readValue(aiString.substring(start, end + 1), Map.class);
        } catch (Exception e) {
            return Map.of("path", "UNCATEGORIZED", "confidence", 0.0, "alternatives", List.of());
        }
    }
}