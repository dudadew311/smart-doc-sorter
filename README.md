# SmartFile Sorter

SmartFile Sorter is an AI-powered document organization assistant designed to streamline your digital workspace. By leveraging local LLMs, it automatically categorizes your files based on their content, moving them to your desired directory structure while allowing for manual oversight on ambiguous files.

## Core Workflow
* **Staging**: Drop files into the dashboard’s staging area; files remain in your browser until you choose to upload.
* **Pending**: Once uploaded, files land in a `PENDING` directory on the server.
* **AI Analysis**: The system extracts text content and uses a local Ollama-hosted LLM to suggest categorization paths.

## The Gatekeeper
* **AI Suggestions**: The system analyzes the file and provides a recommended path.
* **Manual Oversight**: You can either accept the suggested path or define a custom path if preferred.

## Tech Stack
* **Backend**: Spring Boot (Java 17+)
* **AI Engine**: Ollama (Llama 3)
* **Content Extraction**: Apache Tika
* **Frontend**: Native HTML/JS (No frameworks, high-speed responsiveness)
* **Containerization**: Docker / Docker Compose

## Setup Instructions

### Prerequisites
* Java 17 or higher
* Docker & Docker Compose
* Ollama installed and running locally

### Installation
1. **Clone the repository**:
   ```bash
   git clone [your-repo-url]
   cd smart-file-sorter
   ```
   
## Build the application:
```Bash
mvn clean package
```

## Configuration & Setup
* **Environment Variables:** Configure the application by setting these environment variables or adding them to your src/main/resources/application.properties:
* **app.storage.staging-dir:** Path for initial uploads (e.g., /mnt/nas/staging).
* **app.storage.target-dir:** Path for your final file library (e.g., /mnt/nas/documents).
* **Storage Preparation:** Ensure the application has read/write permissions to the configured paths. The app will automatically create a PENDING sub-folder upon startup.

## How to Use SmartFile Sorter

### Staging: 
Drag and drop documents into the **Pending Files** drop zone. When ready, click "Upload All Staged Files" to move them to the server's `PENDING` directory.

### Categorization:
* Click a file in the **Pending Files** list.
* Wait for the AI to analyze the content (indicated by the "AI is thinking..." hourglass).
* If confidence is high, the file is auto-sorted. Otherwise, choose a suggested path or enter a **Custom Path**.
* **File Explorer:** Navigate your existing file structure in the right-hand pane. Clicking a folder name will populate the "Custom Path" input for easy categorization.

### Deploying to TNAS (TOS 6.0)
Use the provided docker-compose.yml in your Docker Manager on your TerraMaster NAS. Ensure your data volumes are mapped to your existing file system to maintain persistent storage.