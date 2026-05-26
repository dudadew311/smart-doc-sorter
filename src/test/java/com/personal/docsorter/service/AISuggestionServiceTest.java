package com.personal.docsorter.service;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.web.client.RestTemplate;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@SpringBootTest
public class AISuggestionServiceTest {

    @Autowired
    private AISuggestionService aiSuggestionService;

    @MockitoBean // Use the new Spring Boot 3.4+ annotation
    private RestTemplate restTemplate;

    @Test
    public void testServiceParsesValidResponseSuccessfully() {
        // Mock a successful JSON response from Ollama
        Map<String, Object> mockResponse = Map.of("response", "{\"path\": \"Work/Docs\", \"confidence\": 0.95}");
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class)))
                .thenReturn(mockResponse);

        Map<String, Object> result = aiSuggestionService.getSuggestion("content", "tree");

        assertEquals("Work/Docs", result.get("path"));
        assertEquals(0.95, result.get("confidence"));
    }
}