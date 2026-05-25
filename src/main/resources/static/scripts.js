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
        addFilesToStaging(e.dataTransfer.files);
    });

    uploadAllBtn.addEventListener('click', async () => {
        for (const file of stagedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            await fetch('/api/v1/documents/upload', { method: 'POST', body: formData });
        }
        resetStaging();
        refreshDashboard();
    });

    clearStagedBtn.addEventListener('click', () => resetStaging());
});

let stagedFiles = [];

function addFilesToStaging(files) {
    const stagingList = document.getElementById('stagingList');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const clearStagedBtn = document.getElementById('clearStagedBtn');

    Array.from(files).forEach(file => {
        stagedFiles.push(file);
        const li = document.createElement('li');
        li.textContent = file.name;
        stagingList.appendChild(li);
    });

    if (stagedFiles.length > 0) {
        uploadAllBtn.style.display = 'block';
        clearStagedBtn.style.display = 'block';
    }
}

function resetStaging() {
    stagedFiles = [];
    document.getElementById('stagingList').innerHTML = '';
    document.getElementById('uploadAllBtn').style.display = 'none';
    document.getElementById('clearStagedBtn').style.display = 'none';
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
        const files = await res.json();
        const fileList = document.getElementById('fileList');

        fileList.innerHTML = files.map(file => `
            <div class="pending-item" data-filename="${file}" style="cursor: pointer; padding: 5px; border-bottom: 1px solid #eee;">
                <span>📄 ${file}</span>
            </div>
        `).join('');

        document.querySelectorAll('.pending-item').forEach(item => {
            item.addEventListener('click', () => loadSuggestion(item.getAttribute('data-filename')));
        });
    } catch (err) { console.error(err); }
    loadExplorer();
}

// --- EXPLORER PANE ---
async function loadExplorer() {
    const explorerPane = document.getElementById('explorerPane');
    explorerPane.innerHTML = '<h2>File Explorer</h2>';
    const rootContainer = document.createElement('div');
    explorerPane.appendChild(rootContainer);
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
    pane.innerHTML = `
        <h2>Suggestions for ${fileName}</h2>
        <div style="display: flex; align-items: center; padding: 20px;">
            <div class="hourglass"></div>
            <p>AI is thinking...</p>
        </div>
    `;

    try {
        const res = await fetch(`/api/v1/documents/suggestions?fileName=${encodeURIComponent(fileName)}`);
        const data = await res.json();

        let html = `<h2>Suggestions for ${fileName}</h2>`;
        data.options.forEach(path => {
            html += `<button onclick="categorizeFile('${fileName}', '${path}')">${path}</button>`;
        });

        html += `
            <div style="margin-top: 20px;">
                <h3>Or enter custom path:</h3>
                <input type="text" id="customPath" placeholder="e.g., Projects/2026/Work">
                <button onclick="applyCustom('${fileName}')" style="padding: 12px; font-size: 1rem;">Apply Custom Path</button>
            </div>
        `;
        pane.innerHTML = html;
    } catch (err) {
        pane.innerHTML = `<h2>Error</h2><p>Could not load suggestions.</p>`;
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
    refreshDashboard();
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