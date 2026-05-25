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
        console.error("Failed to load explorer:", err);
    }
}

function renderTree(node) {
    const isDir = node.isDirectory;
    const icon = isDir ? "📁 " : "📄 ";

    let html = `<div class="tree-node" style="cursor: ${isDir ? 'pointer' : 'default'};">
                    ${icon} <strong>${node.name}</strong>
                </div>`;

    if (isDir && node.children) {
        html += `<div class="tree-children" style="margin-left: 20px;">` +
                node.children.map(renderTree).join('') +
                `</div>`;
    }
    return html;
}

function attachTreeListeners() {
    document.querySelectorAll('.tree-node').forEach(node => {
        node.addEventListener('click', (e) => {
            const children = node.nextElementSibling;
            if (children && children.classList.contains('tree-children')) {
                children.style.display = (children.style.display === 'none') ? 'block' : 'none';
            }
        });
    });
}

// --- SUGGESTION PANE ---
async function loadSuggestion(fileName) {
    const pane = document.getElementById('suggestionsPane');
    pane.innerHTML = `<h2>Suggestions</h2><div class="hourglass"></div> Thinking...`;

    try {
        const res = await fetch(`/api/v1/documents/suggestions?fileName=${encodeURIComponent(fileName)}`);
        const data = await res.json();

        let html = `<h2>Suggestions for ${fileName}</h2>`;

        // Render AI suggestions
        data.options.forEach(path => {
            html += `<button onclick="categorizeFile('${fileName}', '${path}')">${path}</button><br>`;
        });

        // Restore Custom Folder Input
        html += `
            <hr>
            <h3>Or enter custom path:</h3>
            <input type="text" id="customPath" placeholder="e.g., Projects/2026/Work">
            <button onclick="applyCustom('${fileName}')">Apply Custom Path</button>
        `;
        pane.innerHTML = html;
    } catch (err) {
        pane.innerHTML = `<h2>Error</h2><p>Could not load suggestions.</p>`;
    }
}

function applyCustom(fileName) {
    const customPath = document.getElementById('customPath').value;
    if (customPath) {
        categorizeFile(fileName, customPath);
    } else {
        alert("Please enter a path (e.g., FolderA/FolderB).");
    }
}

function applyCustom(fileName) {
    const cat = document.getElementById('customCat').value;
    const sub = document.getElementById('customSub').value;
    if (cat && sub) {
        categorizeFile(fileName, cat, sub);
    } else {
        alert("Please enter both a Category and a Subfolder.");
    }
}