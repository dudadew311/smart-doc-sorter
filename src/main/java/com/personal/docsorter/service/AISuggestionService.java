package com.personal.docsorter.service;

import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;
import java.util.Map;
import com.fasterxml.jackson.databind.ObjectMapper;

@Service
public class AISuggestionService {
    private final RestTemplate restTemplate = new RestTemplate();
    private final ObjectMapper objectMapper = new ObjectMapper(); // Add this
    private final String OLLAMA_URL = "http://localhost:11434/api/generate";

    public Map<String, String> getSuggestion(String fileContent) {
        Map response = null; // Declare it here
        try {
            String prompt = "Analyze this content. Return ONLY a raw JSON object with keys 'category' and 'subfolder'. No other text. Content: " + fileContent;

            Map<String, Object> request = Map.of("model", "llama3", "prompt", prompt, "stream", false);
            response = restTemplate.postForObject(OLLAMA_URL, request, Map.class); // Assign it here

            String aiString = (String) response.get("response");

            int start = aiString.indexOf("{");
            int end = aiString.lastIndexOf("}");
            if (start != -1 && end != -1) {
                aiString = aiString.substring(start, end + 1);
            }

            return objectMapper.readValue(aiString, Map.class);

        } catch (Exception e) {
            // Now 'response' is reachable here
            if (response != null) {
                System.err.println("AI Response failed to parse. Raw response was: " + response.get("response"));
            } else {
                System.err.println("AI Request failed entirely: " + e.getMessage());
            }
            return Map.of("category", "UNCATEGORIZED", "subfolder", "MISC");
        }
    }
}
