package com.personal.docsorter.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service
public class AISuggestionService {
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${GROQ_API_KEY:}")
    private String groqApiKey;
    private final String groqUrl = "https://api.groq.com/openai/v1/chat/completions";

    public AISuggestionService(RestTemplate restTemplate) {
        this.restTemplate = restTemplate;
    }

    public Map<String, Object> getSuggestion(String fileContent, String currentTree) {
        try {
            // 1. Parse into a JsonNode tree first
            JsonNode rootNode = objectMapper.readTree(currentTree);

            // 2. Call the RECURSIVE method, NOT the string version
            // We start with an empty path and depth 0
            String cleanHierarchy = getCleanDocumentsHierarchy(rootNode, "", 0);

            if (cleanHierarchy.length() > 10000) {
                cleanHierarchy = cleanHierarchy.substring(0, 10000);
            }

//            System.out.println("DEBUG: Hierarchy being sent to AI (Tree Format): \n" + cleanHierarchy);
            String systemPrompt = "You are a filing assistant. " +
                    "Analyze the path structure to determine the most logical folder for the content. " +
                    "You MUST return a JSON object with two fields: 'path' (string) and 'alternatives' (a list of 3 strings). " +
                    "If there are multiple logical folders, put them in 'alternatives'. " +
                    "Return ONLY JSON: {\"path\": \"Documents/Path\", \"alternatives\": [\"Alt1\", \"Alt2\", \"Alt3\"]}";
            String userPrompt = "Hierarchy:\n" + cleanHierarchy + "\nContent: " + fileContent +
                    "\nReturn ONLY JSON: {\"path\": \"Documents/Full/Path/To/Folder\", \"alternatives\": []}";

            Map<String, Object> request = Map.of(
                    "model", "llama-3.3-70b-versatile",
                    "messages", List.of(
                            Map.of("role", "system", "content", systemPrompt),
                            Map.of("role", "user", "content", userPrompt)
                    )
            );

            // --- ADD THIS BLOCK ---
            HttpHeaders headers = new HttpHeaders();
            headers.setBearerAuth(groqApiKey);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(request, headers);

            Map<String, Object> response = restTemplate.postForObject(groqUrl, entity, Map.class);

//            System.out.println("DEBUG: Raw Groq Response Map: " + response);
            // Extract the JSON content from the Groq response
            List<Map<String, Object>> choices = (List<Map<String, Object>>) response.get("choices");
            Map<String, Object> message = (Map<String, Object>) choices.get(0).get("message");
            String content = (String) message.get("content");

//            System.out.println("DEBUG: AI Content String: " + content);
            // Parse the string 'content' into your return Map
            return objectMapper.readValue(content, Map.class);
            // ----------------------

        } catch (Exception e) {
            e.printStackTrace();
            return Map.of("path", "Unsorted", "alternatives", Collections.emptyList());
        }
    }

    private String getCleanDocumentsHierarchy(JsonNode node, String path, int depth) {
        if (depth > 4) return "";

        StringBuilder sb = new StringBuilder();
        String name = node.has("name") ? node.get("name").asText() : "";

        if (node.has("isDirectory") && node.get("isDirectory").asBoolean()) {
            // Build the path. If it's the root "target" node, set path to empty
            String currentPath;
            if (name.equals("target")) {
                currentPath = "";
            } else {
                currentPath = path.isEmpty() ? name : path + "/" + name;
            }

            // Only add to the list if it's NOT the root "target" folder itself
            if (!currentPath.isEmpty()) {
                sb.append(currentPath).append("\n");
            }

            if (node.has("children")) {
                for (JsonNode child : node.get("children")) {
                    sb.append(getCleanDocumentsHierarchy(child, currentPath, depth + 1));
                }
            }
        }
        return sb.toString();
    }

    private void traverseTree(JsonNode node, String currentPath, int depth, List<String> paths) {
        if (depth > 4) return;

        String name = node.has("name") ? node.get("name").asText() : "";
        // Only append if it's not the root node name already
        String newPath = (depth == 0) ? name : currentPath + "/" + name;

        if (node.has("isDirectory") && node.get("isDirectory").asBoolean()) {
            // ONLY add if it is a directory that explicitly contains "Documents" in the path
            if (newPath.contains("Documents")) {
                paths.add(newPath);
            }

            if (node.has("children")) {
                for (JsonNode child : node.get("children")) {
                    traverseTree(child, newPath, depth + 1, paths);
                }
            }
        }
    }
}