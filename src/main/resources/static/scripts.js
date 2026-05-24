// src/main/resources/static/scripts.js
let stagedFiles = [];
const dropZone = document.getElementById('dropZone');
const fileNameDisplay = document.getElementById('fileNameDisplay');

// Handle Drag & Drop
dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', (e) => { dropZone.classList.remove('dragover'); });
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
        handleFileSelect(e.dataTransfer.files); // Pass the FileList directly
    }
});

// Handle File Picker & Drag-and-Drop uniformly
function handleFileSelect(files) {
    stagedFiles = Array.from(files);
    fileNameDisplay.textContent = "Staged: " + stagedFiles.length + " file(s)";
}

async function processUpload() {
    if (stagedFiles.length === 0) { alert("Please select files first!"); return; }

    // 1. Upload files
    for (const file of stagedFiles) {
        const formData = new FormData();
        formData.append('file', file);
        await fetch('/api/v1/documents/upload', { method: 'POST', body: formData });
    }

    // 2. Trigger sort
    await fetch('/api/v1/documents/sort', { method: 'POST' });

    // 3. Immediately refresh to see if anything landed in PENDING
    await loadPendingFiles();

    stagedFiles = [];
    fileNameDisplay.textContent = "Upload complete. Check below for files needing attention.";
}

async function loadPendingFiles() {
    const res = await fetch('/api/v1/documents/pending');
    const files = await res.json();

    const listDiv = document.getElementById('pendingFileList');
    listDiv.innerHTML = ''; // Clear old list

    if (files.length > 0) {
        document.getElementById('pendingSection').style.display = 'block';

        // Create a dropdown so you can pick which file to categorize
        const select = document.createElement('select');
        select.id = 'fileSelector';
        files.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            select.appendChild(opt);
        });
        listDiv.appendChild(select);
    } else {
        document.getElementById('pendingSection').style.display = 'none';
    }
}

// Call this on window load
window.onload = loadPendingFiles;

async function submitCategorization() {
    // Point to the selector we just created in loadPendingFiles
    const fileName = document.getElementById('fileSelector').value;
    const category = document.getElementById('catSelect').value;
    const subfolder = document.getElementById('newSubclass').value;

    await fetch(`/api/v1/documents/categorize?fileName=${fileName}&category=${category}&subfolder=${subfolder}`, {
        method: 'POST'
    });

    alert("File moved successfully!");
    location.reload(); // Quickest way to clean up the UI
}