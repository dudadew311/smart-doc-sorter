package com.personal.docsorter.controller;

import com.personal.docsorter.service.FileOrganizerService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
// Change the import here:
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Map;

import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(DocumentController.class)
public class DocumentControllerTest {

    @Autowired
    private MockMvc mockMvc;

    // Updated annotation
    @MockitoBean
    private FileOrganizerService fileOrganizerService;

    @Test
    public void testGetPendingFiles() throws Exception {
        when(fileOrganizerService.listPendingFiles()).thenReturn(List.of("doc1.pdf", "doc2.txt"));

        mockMvc.perform(get("/api/v1/documents/pending"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("doc1.pdf"))
                .andExpect(jsonPath("$[1]").value("doc2.txt"));
    }

    @Test
    public void testGetSuggestions() throws Exception {
        String fileName = "test.pdf";
        Map<String, Object> mockResponse = Map.of(
                "options", List.of("Work/Docs"),
                "autoMoved", false
        );

        when(fileOrganizerService.getAiSuggestionForFile(fileName)).thenReturn(mockResponse);

        mockMvc.perform(get("/api/v1/documents/suggestions")
                        .param("fileName", fileName))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.options[0]").value("Work/Docs"))
                .andExpect(jsonPath("$.autoMoved").value(false));
    }

    @Test
    public void testCategorize() throws Exception {
        String fileName = "test.pdf";
        String path = "Work/Docs";

        mockMvc.perform(post("/api/v1/documents/categorize")
                        .param("fileName", fileName)
                        .param("path", path))
                .andExpect(status().isOk())
                .andExpect(content().string("SUCCESS"));

        verify(fileOrganizerService, times(1)).moveToFinalFolder(fileName, path);
    }
}
