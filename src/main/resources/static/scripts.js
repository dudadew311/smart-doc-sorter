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

    pane.innerHTML = `
        <div class="loading-spinner" style="text-align: center; margin-top: 20px;">
            <div class="spinner"></div> <p>Analyzing ${fileName}...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/v1/documents/suggestions?fileName=${encodeURIComponent(fileName)}`);
        if (!res.ok) throw new Error('Failed to fetch suggestion');

        const data = await res.json();

        // 1. Main suggestion button (no confidence %)
        let mainSuggestionHtml = `
            <button onclick="categorizeFile('${escapedFileName}', '${data.path}')" class="btn-suggest">
                ${data.path}
            </button>
        `;

        // 2. Alternates section
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

        pane.innerHTML = `
            <h2>Suggestion for: ${fileName}</h2>
            ${mainSuggestionHtml}
            ${alternatesHtml}

            <div class="mt-20" style="display: flex; flex-direction: column; gap: 10px;">
                <input type="text" id="customPath" placeholder="Custom path...">
                <div style="display: flex; gap: 10px;">
                    <button onclick="applyCustom('${escapedFileName}')" style="flex-grow: 1;">Apply Path</button>
                    <button onclick="deleteFile('${escapedFileName}')" class="btn-danger">Delete from Pending</button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error(err);
        pane.innerHTML = `<p style="color: red;">Error: Could not retrieve AI suggestion.</p>`;
    }
}

function selectFolder(path) {
    const input = document.getElementById('customPath');
    if (input) input.value = path;
}