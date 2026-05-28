// --- STATE MANAGEMENT ---
let stagedFiles = [];

function getExpandedFolders() {
    return JSON.parse(localStorage.getItem('expandedFolders') || '[]');
}

function saveExpandedFolder(path) {
    let expanded = getExpandedFolders();
    if (!expanded.includes(path)) {
        expanded.push(path);
        localStorage.setItem('expandedFolders', JSON.stringify(expanded));
    }
}

function removeExpandedFolder(path) {
    let expanded = getExpandedFolders();
    expanded = expanded.filter(p => p !== path);
    localStorage.setItem('expandedFolders', JSON.stringify(expanded));
}

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    loadExplorer();

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const clearStagedBtn = document.getElementById('clearStagedBtn');

    // FIX: Add e.stopPropagation() to ensure the click doesn't bubble incorrectly
        dropZone.addEventListener('click', (e) => {
            // Only trigger if the click target is the dropZone itself or its paragraph
            if (e.target === dropZone || e.target.tagName === 'P') {
                fileInput.click();
            }
        });

    // FIX: Check if files exist to prevent double-processing or re-opening
        fileInput.addEventListener('change', (e) => {
            e.stopPropagation(); // Stop the event from bubbling up to the dropZone
            if (e.target.files && e.target.files.length > 0) {
                addFilesToStaging(e.target.files);
                fileInput.value = ''; // Reset the input field
            }
        });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#2563eb';
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.style.borderColor = '#cbd5e1';
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';
        const items = e.dataTransfer.items;
        if (items) {
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry();
                if (item) traverseEntry(item);
            }
        }
    });

    document.getElementById('collapseAllBtn').addEventListener('click', () => {
        localStorage.removeItem('expandedFolders');
        loadExplorer();
    });

    uploadAllBtn.addEventListener('click', async () => {
        for (const item of stagedFiles) {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('fullPath', item.fullPath);
            await fetch('/api/v1/documents/upload', { method: 'POST', body: formData });
        }
        resetStaging();
        refreshDashboard();
    });

    clearStagedBtn.addEventListener('click', () => resetStaging());
});

// --- HELPER FUNCTIONS ---

async function traverseEntry(entry, path = "") {
    if (entry.isFile) {
        entry.file(file => {
            const fullPath = path + file.name;
            stagedFiles.push({ file, fullPath });
            renderStaging();
        });
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries(entries => {
            entries.forEach(e => traverseEntry(e, path + entry.name + "/"));
        });
    }
}

function addFilesToStaging(files) {
    Array.from(files).forEach(file => {
        stagedFiles.push({ file: file, fullPath: file.name });
    });
    renderStaging();
}

function renderStaging() {
    const stagingList = document.getElementById('stagingList');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const clearStagedBtn = document.getElementById('clearStagedBtn');
    stagingList.innerHTML = '';
    stagedFiles.forEach((item) => {
        const li = document.createElement('li');
        li.textContent = item.fullPath;
        stagingList.appendChild(li);
    });
    if (stagedFiles.length > 0) {
        uploadAllBtn.classList.remove('hidden');
        clearStagedBtn.classList.remove('hidden');
    } else {
        uploadAllBtn.classList.add('hidden');
        clearStagedBtn.classList.add('hidden');
    }
}

function resetStaging() {
    stagedFiles = [];
    renderStaging();
}

async function refreshDashboard() {
    try {
        const res = await fetch('/api/v1/documents/pending');
        const items = await res.json();
        const fileList = document.getElementById('fileList');
        fileList.innerHTML = items.map(item => `
            <div class="pending-item" data-name="${item.name}" style="cursor: pointer; padding: 8px; border-bottom: 1px solid #eee;">
                <span>${item.isDirectory ? '📁' : '📄'} ${item.name}</span>
            </div>
        `).join('');
        document.querySelectorAll('.pending-item').forEach(item => {
            item.addEventListener('click', () => loadSuggestion(item.getAttribute('data-name')));
        });
    } catch (err) { console.error(err); }
}

async function loadExplorer() {
    const content = document.getElementById('explorerContent');
    content.innerHTML = '';
    const rootContainer = document.createElement('div');
    content.appendChild(rootContainer);
    await fetchChildren('/', rootContainer);
}

async function fetchChildren(path, containerElement) {
    try {
        const res = await fetch(`/api/v1/documents/children?path=${encodeURIComponent(path)}`);
        const files = await res.json();
        const ul = document.createElement('ul');
        ul.style.listStyle = 'none';
        ul.style.paddingLeft = '20px';
        const expandedFolders = getExpandedFolders();

        files.forEach(file => {
            const li = document.createElement('li');
            const isExpanded = expandedFolders.includes(file.path);
            const arrow = document.createElement('span');
            arrow.style.cursor = 'pointer';
            arrow.innerText = file.isDirectory ? (isExpanded ? '▼ ' : '▶ ') : '  ';
            arrow.onclick = () => toggleDir(arrow, file.path);
            const label = document.createElement('span');
            label.style.cursor = 'pointer';
            label.innerText = (file.isDirectory ? "📁 " : "📄 ") + file.name;
            label.onclick = () => selectFolder(file.path);
            li.appendChild(arrow);
            li.appendChild(label);
            const childrenContainer = document.createElement('div');
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
            li.appendChild(childrenContainer);
            ul.appendChild(li);
            if (isExpanded) fetchChildren(file.path, childrenContainer);
        });
        containerElement.innerHTML = '';
        containerElement.appendChild(ul);
    } catch (err) { console.error(err); }
}

async function toggleDir(arrowElement, path) {
    const container = arrowElement.parentElement.querySelector('div');
    if (container.style.display === 'none') {
        await fetchChildren(path, container);
        container.style.display = 'block';
        arrowElement.innerText = '▼ ';
        saveExpandedFolder(path);
    } else {
        container.style.display = 'none';
        arrowElement.innerText = '▶ ';
        removeExpandedFolder(path);
    }
}

async function loadSuggestion(fileName) {
    const pane = document.getElementById('suggestionsPane');
    const escapedFileName = fileName.replace(/'/g, "\\'");

    // 1. Render the UI container shell immediately so the delete button is instantly persistent
    pane.innerHTML = `
        <h2>AI Suggestion for: ${fileName}</h2>
        <div id="aiStatusArea">
            <div class="loading-spinner" style="text-align: center; margin-top: 20px;">
                <div class="spinner"></div> <p>Analyzing content with Groq...</p>
            </div>
        </div>

        <div class="mt-20" style="display: flex; flex-direction: column; gap: 10px;">
            <input type="text" id="customPath" placeholder="Custom path...">
            <div style="display: flex; gap: 10px;">
                <button onclick="applyCustom('${escapedFileName}')" style="flex-grow: 1;">Apply Path</button>
                <button id="activeDeleteBtn" class="btn-danger">Delete from Pending</button>
            </div>
        </div>
    `;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 30-second window

    // Bind the delete function immediately to the button, hooking into the active abort controller
    document.getElementById('activeDeleteBtn').onclick = () => deleteFile(escapedFileName, controller, timeoutId);

    try {
        const res = await fetch(`/api/v1/documents/suggestions?fileName=${encodeURIComponent(fileName)}`, {
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!res.ok) throw new Error('Failed to fetch suggestion');

        const data = await res.json();

        let mainSuggestionHtml = `
            <button onclick="categorizeFile('${escapedFileName}', '${data.path}')" class="btn-suggest">
                ${data.path}
            </button>
        `;

        let alternatesHtml = '';
        if (data.alternatives && Array.isArray(data.alternatives) && data.alternatives.length > 0) {
            alternatesHtml = `
                <div style="margin-top: 15px;">
                    <p style="font-weight: bold; margin-bottom: 5px;">Alternates:</p>
                    <div class="actions">
                        ${data.alternatives.map(alt => `
                            <button onclick="categorizeFile('${escapedFileName}', '${alt}')" class="btn-alt">
                                ${alt}
                            </button>
                        `).join('')}
                    </div>
                </div>
            `;
        }

        // 2. Only overwrite the status area to preserve input fields and bindings if the user hasn't clicked delete
        const statusArea = document.getElementById('aiStatusArea');
        if (statusArea) {
            statusArea.innerHTML = `
                ${mainSuggestionHtml}
                ${alternatesHtml}
            `;
        }
    } catch (err) {
        clearTimeout(timeoutId);
        console.error(err);

        const statusArea = document.getElementById('aiStatusArea');
        if (!statusArea) return; // Means item was deleted and UI reset completely

        if (err.name === 'AbortError') {
            statusArea.innerHTML = `
                <p style="color: #eab308; font-weight: bold; margin-bottom: 5px;">
                    ⚠️ Groq took too long to respond (exceeded 2 minutes).
                </p>
                <p style="font-size: 0.9rem; color: #64748b; margin-bottom: 15px;">
                    Please select a target destination folder using the file explorer or enter a custom path manually below:
                </p>
            `;
        } else {
            statusArea.innerHTML = `
                <p style="color: var(--danger);">Error: Could not retrieve AI suggestion from the service.</p>
            `;
        }
    }
}

function selectFolder(path) {
    const input = document.getElementById('customPath');
    if (input) {
        // Strip out the leading slash if it exists so the backend resolves it relatively
        const cleanedPath = path.startsWith('/') ? path.substring(1) : path;
        input.value = cleanedPath;
    }
}

// --- CORE UTILITY ACTIONS ---

async function categorizeFile(fileName, targetPath) {
    if (!targetPath || targetPath.trim() === "") {
        alert("Please select or enter a path first.");
        return;
    }
    try {
        const res = await fetch(`/api/v1/documents/categorize?fileName=${encodeURIComponent(fileName)}&path=${encodeURIComponent(targetPath)}`, {
            method: 'POST'
        });
        if (res.ok) {
            document.getElementById('suggestionsPane').innerHTML = `
                <h2>AI Suggestions</h2>
                <p style="color: #10b981; font-weight: bold;">✓ File successfully organized!</p>
            `;
            refreshDashboard();
            loadExplorer();
        } else {
            alert("Failed to organize file.");
        }
    } catch (err) {
        console.error(err);
    }
}

function applyCustom(fileName) {
    const input = document.getElementById('customPath');
    if (input) {
        categorizeFile(fileName, input.value);
    }
}

async function deleteFile(fileName, activeController = null, timeoutId = null) {
    if (!confirm(`Are you sure you want to delete "${fileName}" from pending storage?`)) return;

    // If the AI is actively running, abort its fetch promise connection immediately
    if (activeController) {
        console.log("Interrupting running AI request for deletion...");
        if (timeoutId) clearTimeout(timeoutId);
        activeController.abort();
    }

    try {
        const res = await fetch(`/api/v1/documents/delete?fileName=${encodeURIComponent(fileName)}`, {
            method: 'DELETE'
        });
        if (res.ok) {
            document.getElementById('suggestionsPane').innerHTML = `
                <h2>AI Suggestions</h2>
                <p style="color: #cbd5e1;">File deleted.</p>
            `;
            refreshDashboard();
        } else {
            alert("Failed to delete the file.");
        }
    } catch (err) {
        console.error(err);
    }
}