package com.personal.docsorter.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AISuggestionService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final String OLLAMA_URL = "http://localhost:11434/api/generate";

    // Changed return type to List<String> to match your goal
    public List<String> getSuggestion(String fileContent, String currentTree) {
        try {
            String prompt = "You are a filing assistant. Current folder structure: " + currentTree +
                    ". Suggest 3 paths for this file content. Return ONLY a JSON list of strings, e.g. [\"Path1\", \"Path2\"]. " +
                    "Content: " + fileContent;

            Map<String, Object> request = Map.of("model", "llama3", "prompt", prompt, "stream", false);
            Map response = restTemplate.postForObject(OLLAMA_URL, request, Map.class);
            String aiString = (String) response.get("response");

            int start = aiString.indexOf("[");
            int end = aiString.lastIndexOf("]");
            return objectMapper.readValue(aiString.substring(start, end + 1), List.class);
        } catch (Exception e) {
            return List.of("UNCATEGORIZED");
        }
    }
}