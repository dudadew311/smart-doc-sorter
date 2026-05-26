// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    loadExplorer();

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const clearStagedBtn = document.getElementById('clearStagedBtn');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => addFilesToStaging(e.target.files));

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#2563eb'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#cbd5e1'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';

        const items = e.dataTransfer.items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i].webkitGetAsEntry();
            if (item) traverseEntry(item);
        }
    });
    document.getElementById('collapseAllBtn').addEventListener('click', () => {
            localStorage.removeItem('expandedFolders'); // Clear state
            loadExplorer(); // Re-render tree
        });

    uploadAllBtn.addEventListener('click', async () => {
        for (const item of stagedFiles) {
            const formData = new FormData();
            formData.append('file', item.file);
            formData.append('fullPath', item.fullPath);
            await fetch('/api/v1/documents/upload', { method: 'POST', body: formData });
        }
        resetStaging();

        // Debug: Check if the server actually sees the new files
        const response = await fetch('/api/v1/documents/pending');
        const data = await response.json();
        console.log("Pending files on server:", data);

        refreshDashboard();
    });

    clearStagedBtn.addEventListener('click', () => resetStaging());
});

async function traverseEntry(entry, path = "") {
    if (entry.isFile) {
        entry.file(file => {
            const fullPath = path + file.name;
            stagedFiles.push({ file, fullPath });
            renderStaging(); // Now this function exists
        });
    } else if (entry.isDirectory) {
        const reader = entry.createReader();
        reader.readEntries(entries => {
            entries.forEach(e => traverseEntry(e, path + entry.name + "/"));
        });
    }
}

let stagedFiles = [];

function addFilesToStaging(files) {
    Array.from(files).forEach(file => {
        // Use consistent object structure
        stagedFiles.push({ file: file, fullPath: file.name });
    });
    renderStaging(); // Centralized rendering
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

    // Use classList for visibility consistency
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
    renderStaging(); // Clears the list
}

// --- STATE MANAGEMENT (Persistence) ---
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

// --- DASHBOARD CORE ---
async function refreshDashboard() {
    try {
        const res = await fetch('/api/v1/documents/pending');
        const items = await res.json(); // Now receiving {name: "...", isDirectory: boolean}
        const fileList = document.getElementById('fileList');

        fileList.innerHTML = items.map(item => `
            <div class="pending-item" data-name="${item.name}" style="cursor: pointer; padding: 8px; border-bottom: 1px solid #eee;">
                <span>${item.isDirectory ? '📁' : '📄'} ${item.name}</span>
            </div>
        `).join('');

        // Attach click listeners to every item
        document.querySelectorAll('.pending-item').forEach(item => {
            item.addEventListener('click', () => {
                const fileName = item.getAttribute('data-name');
                loadSuggestion(fileName); // This function fetches AI suggestions
            });
        });
    } catch (err) { console.error('Error refreshing dashboard:', err); }
}

// --- EXPLORER PANE ---
async function loadExplorer() {
    const content = document.getElementById('explorerContent');
    content.innerHTML = ''; // Clear existing
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
            li.className = 'tree-node';

            const isExpanded = expandedFolders.includes(file.path);
            const arrow = file.isDirectory ? `<span class="toggle" style="cursor:pointer;" onclick="toggleDir(this, '${file.path}')">${isExpanded ? '▼' : '▶'}</span> ` : "  ";

            li.innerHTML = `${arrow}<span onclick="selectFolder('${file.path}')" style="cursor:pointer;">${file.isDirectory ? "📁 " : "📄 "}${file.name}</span>`;

            const childrenContainer = document.createElement('div');
            childrenContainer.style.display = isExpanded ? 'block' : 'none';
            li.appendChild(childrenContainer);

            ul.appendChild(li);

            // Auto-load if previously expanded
            if (isExpanded) {
                fetchChildren(file.path, childrenContainer);
            }
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
        arrowElement.innerText = '▼';
        saveExpandedFolder(path);
    } else {
        container.style.display = 'none';
        arrowElement.innerText = '▶';
        removeExpandedFolder(path);
    }
}

// --- SUGGESTION PANE ---
async function loadSuggestion(fileName) {
    const pane = document.getElementById('suggestionsPane');

    // 1. Move the hourglass BELOW the text
    pane.innerHTML = `
            <div class="loading-state" style="text-align: center;">
                <h2>Getting suggestion for: ${fileName}...</h2>
                <div class="spinner"></div>
            </div>
        `;

    try {
        const res = await fetch(`/api/v1/documents/suggestions?fileName=${encodeURIComponent(fileName)}`);
        const data = await res.json();

        // 2. Removed the confidence percentage line
        let html = `<h2>Suggestions for ${fileName}</h2>`;

        // Render Primary Recommendation
        html += `<button onclick="categorizeFile('${fileName}', '${data.path}')">Move to: ${data.path}</button>`;

        // Render Alternatives
        if (data.alternatives && data.alternatives.length > 0) {
            html += `<h3>Alternatives:</h3>`;
            data.alternatives.forEach(alt => {
                html += `<button class="alt-btn" onclick="categorizeFile('${fileName}', '${alt}')">${alt}</button>`;
            });
        }

        // Custom path fallback
        html += `
            <div style="margin-top: 20px;">
                <h3>Custom Destination:</h3>
                <input type="text" id="customPath" placeholder="e.g., Archive/2026">

                <div style="display: flex; gap: 10px;">
                    <button onclick="applyCustom('${fileName}')" style="flex: 2;">Apply Path</button>
                    <button onclick="deleteFile('${fileName}')" style="flex: 1; background-color: #ef4444;">Delete From Pending</button>
                </div>
            </div>
        `;
        pane.innerHTML = html;

    } catch (err) {
        pane.innerHTML = `<h2>Error</h2><p>Could not load suggestions for ${fileName}.</p>`;
    }
}

function selectFolder(path) {
    const input = document.getElementById('customPath');
    if (input) input.value = path;
}

// --- ACTIONS ---
async function categorizeFile(fileName, fullPath) {
    const formData = new URLSearchParams();
    formData.append('fileName', fileName);
    formData.append('path', fullPath);

    await fetch('/api/v1/documents/categorize', { method: 'POST', body: formData });

    // Refresh both the pending list and the file explorer
    refreshDashboard();
    loadExplorer(); // This function should be defined in your scripts.js to re-fetch/re-render the tree

    document.getElementById('suggestionsPane').innerHTML = `<h2>AI Suggestions</h2><p>Select a file to see suggestions.</p>`;
}

function applyCustom(fileName) {
    const customPathInput = document.getElementById('customPath');
    let customPath = customPathInput.value.trim();

    if (customPath) {
        if (customPath.startsWith('/')) {
            customPath = customPath.substring(1);
        }
        categorizeFile(fileName, customPath);
    } else {
        alert("Please enter a valid path.");
    }
}

async function deleteFile(fileName) {
    if (!confirm(`Are you sure you want to delete ${fileName}?`)) return;

    await fetch(`/api/v1/documents/delete?fileName=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
    });

    refreshDashboard(); // Update the pending list
    document.getElementById('suggestionsPane').innerHTML = `<h2>AI Suggestions</h2><p>File removed. Select another file.</p>`;
}