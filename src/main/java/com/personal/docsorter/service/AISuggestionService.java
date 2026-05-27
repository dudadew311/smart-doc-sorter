package com.personal.docsorter.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value; // Add this import
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.*;

@Service
public class AISuggestionService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${OLLAMA_URL:http://localhost:11434/api/generate}")
    private String ollamaUrl;

    @Value("${AI_MODEL_NAME:llama3}")
    private String modelName;

    public AISuggestionService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, Object> getSuggestion(String fileContent, String currentTree) {
        try {
            String prompt = "You are a professional filing assistant. Current structure: " + currentTree +
                    ". Analyze the content and suggest a folder path. " +
                    "Return ONLY a JSON object: {\"path\": \"Folder/Sub\", \"confidence\": 0.95, \"alternatives\": [\"Alt1\", \"Alt2\"]}. " +
                    "Content: " + fileContent;

            // Use dynamic fields here
            Map<String, Object> request = Map.of("model", modelName, "prompt", prompt, "stream", false);
            Map response = restTemplate.postForObject(ollamaUrl, request, Map.class);
            String aiString = (String) response.get("response");

            int start = aiString.indexOf("{");
            int end = aiString.lastIndexOf("}");

            if (start == -1 || end == -1 || start >= end) {
                throw new RuntimeException("AI response did not contain valid JSON");
            }

            Map<String, Object> result = objectMapper.readValue(aiString.substring(start, end + 1), Map.class);
            return result;
        } catch (Exception e) {
            throw new RuntimeException("AI Service is currently unreachable. Please try again later.");
        }
    }
}