// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    refreshDashboard();
    loadExplorer();

    // Event delegation for the pending file list
    document.getElementById('pendingPane').addEventListener('click', (e) => {
        const item = e.target.closest('.pending-item');
        if (item) {
            const fileName = item.getAttribute('data-filename');
            loadSuggestion(fileName);
        }
    });
});

// --- DASHBOARD CORE ---
async function refreshDashboard() {
    const res = await fetch('/api/v1/documents/pending');
    const files = await res.json();
    const fileList = document.getElementById('fileList');

    fileList.innerHTML = files.map(file => `
        <div class="pending-item" data-filename="${file}">
            <span>📄 ${file}</span>
        </div>
    `).join('');

    // Always update the tree when the dashboard refreshes
    loadExplorer();
}

// --- EXPLORER PANE ---
async function loadExplorer() {
    try {
        const res = await fetch('/api/v1/documents/tree');
        const data = await res.json();
        const explorerPane = document.getElementById('explorerPane');

        explorerPane.innerHTML = `<h2>Explorer</h2>` + renderTree(data);
        attachTreeListeners();
    } catch (err) {
        console.error("Explorer error:", err);
    }
}

function renderTree(node, depth = 0, currentPath = "") {
    const isDir = node.isDirectory;
    const nodePath = currentPath ? `${currentPath}/${node.name}` : node.name;

    // Arrow for toggle, Label for selection
    const arrow = isDir ? `<span class="toggle" onclick="toggleFolder(event)">▶</span> ` : "  ";
    const icon = isDir ? "📁 " : "📄 ";

    let html = `
        <div class="tree-node" style="padding-left: ${depth * 20}px;">
            ${arrow}
            <span class="tree-label" onclick="selectFolder('${nodePath}')" style="cursor: pointer;">
                ${icon}${node.name}
            </span>
        </div>`;

    if (isDir && node.children && node.children.length > 0) {
        // Start as 'block' (expanded)
        html += `<div class="tree-children" style="display: block;">` +
                node.children.map(child => renderTree(child, depth + 1, nodePath)).join('') +
                `</div>`;
    }
    return html;
}

function toggleFolder(event) {
    event.stopPropagation(); // Prevents this click from triggering selectFolder()
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
    pane.innerHTML = `
        <h2>Suggestions</h2>
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

        // Manual Custom Input
        html += `
            <div style="margin-top: 20px;">
                <h3>Or enter custom path:</h3>
                <input type="text" id="customPath" placeholder="e.g., Projects/2026/Work">
                <button onclick="applyCustom('${fileName}')" style="padding: 12px; font-size: 1rem;">
                    Apply Custom Path
                </button>
            </div>
        `;
        pane.innerHTML = html;
    } catch (err) {
        pane.innerHTML = `<h2>Error</h2><p>Could not load suggestions.</p>`;
    }
}

function selectFolder(path) {
    const input = document.getElementById('customPath');
    if (input) {
        input.value = path;
    } else {
        alert("Please select a file first to load the custom path input.");
    }
}

// --- ACTIONS ---
async function categorizeFile(fileName, fullPath) {
    const formData = new URLSearchParams();
    formData.append('fileName', fileName);
    formData.append('path', fullPath);

    await fetch('/api/v1/documents/categorize', { method: 'POST', body: formData });
    refreshDashboard();
}

function applyCustom(fileName) {
    const customPath = document.getElementById('customPath').value;
    if (customPath) {
        categorizeFile(fileName, customPath);
    } else {
        alert("Please enter a valid path.");
    }
}