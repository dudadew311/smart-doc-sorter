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
    public void testServiceReturnsDefaultOnFailure() {
        // Force the mock to throw an exception to verify the catch block
        when(restTemplate.postForObject(anyString(), any(), eq(Map.class)))
                .thenThrow(new RuntimeException("Connection Failed"));

        Map<String, Object> result = aiSuggestionService.getSuggestion(null, "");

        assertEquals("UNCATEGORIZED", result.get("path"));
        assertEquals(0.0, result.get("confidence"));
    }
}