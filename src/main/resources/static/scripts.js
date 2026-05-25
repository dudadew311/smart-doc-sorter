// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    loadExplorer();

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const stagingList = document.getElementById('stagingList');
    const uploadAllBtn = document.getElementById('uploadAllBtn');
    const clearStagedBtn = document.getElementById('clearStagedBtn');

    // UI Trigger
    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => addFilesToStaging(e.target.files));

    // Drag and Drop
    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.style.borderColor = '#2563eb'; });
    dropZone.addEventListener('dragleave', () => { dropZone.style.borderColor = '#cbd5e1'; });
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.style.borderColor = '#cbd5e1';
        addFilesToStaging(e.dataTransfer.files);
    });

    // Upload All
    uploadAllBtn.addEventListener('click', async () => {
        for (const file of stagedFiles) {
            const formData = new FormData();
            formData.append('file', file);
            await fetch('/api/v1/documents/upload', { method: 'POST', body: formData });
        }
        resetStaging();
        refreshDashboard();
    });

    // Clear
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
    try {
        const res = await fetch('/api/v1/documents/tree');
        const data = await res.json();
        const explorerPane = document.getElementById('explorerPane');
        explorerPane.innerHTML = `<h2>File Explorer</h2>` + renderTree(data);
    } catch (err) { console.error(err); }
}

function renderTree(node, depth = 0, currentPath = "") {
    const isDir = node.isDirectory;
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;
    const arrow = isDir ? `<span class="toggle" onclick="toggleFolder(event)">▶</span> ` : "  ";
    const icon = isDir ? "📁 " : "📄 ";

    let html = `
        <div class="tree-node" style="padding-left: ${depth * 20}px;">
            ${arrow}
            <span class="tree-label" onclick="selectFolder('${nodePath}')" style="cursor: pointer;">${icon}${node.name}</span>
        </div>`;

    if (isDir && node.children && node.children.length > 0) {
        html += `<div class="tree-children" style="display: block;">` +
                node.children.map(child => renderTree(child, depth + 1, nodePath)).join('') + `</div>`;
    }
    return html;
}

function toggleFolder(event) {
    event.stopPropagation();
    const arrow = event.target;
    const children = arrow.closest('.tree-node').nextElementSibling;
    if (children && children.classList.contains('tree-children')) {
        const isHidden = children.style.display === 'none';
        children.style.display = isHidden ? 'block' : 'none';
        arrow.innerText = isHidden ? '▶' : '▼';
    }
}

// --- SUGGESTION PANE ---
async function loadSuggestion(fileName) {
    const pane = document.getElementById('suggestionsPane');

    // Hourglass Loading State
    pane.innerHTML = `
        <h2>Suggestions for ${fileName}</h2>
        <div style="display: flex; align-items: center; padding: 20px;">
            <div class="hourglass" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 20px; height: 20px; animation: spin 1s linear infinite; margin-right: 10px;"></div>
            <p>AI is thinking...</p>
        </div>
        <style>@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>
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
    const customPath = document.getElementById('customPath').value;
    if (customPath) categorizeFile(fileName, customPath);
    else alert("Please enter a valid path.");
}