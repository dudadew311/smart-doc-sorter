// Function to render the tree with icons and toggle functionality
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

// Function to activate the collapse/expand toggles
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

// The single "Source of Truth" for updating the dashboard
async function refreshDashboard() {
    // 1. Load Pending Files (Center Pane)
    fetch('/api/v1/documents/pending')
        .then(res => res.json())
        .then(files => {
            const container = document.getElementById('pendingPane');
            // We preserve the Drop Zone and list container structure
            container.innerHTML = `
                <h2>Pending</h2>
                <div id="dropZone" class="box">
                    <p>Drag & Drop files here or click to upload</p>
                    <input type="file" id="fileInput" style="display:none;" />
                </div>
                <div id="fileList">
                    ${files.map(f => `
                        <div class="file-item" onclick="loadSuggestion('${f}')" style="cursor:pointer; padding: 5px; border-bottom: 1px solid #eee;">
                            ${f}
                        </div>
                    `).join('')}
                </div>
            `;
            // Attach upload logic ONLY after the elements exist
            setupUploadListeners();
        });

    // 2. Load Explorer Tree (Right Pane)
    fetch('/api/v1/documents/tree')
        .then(res => res.json())
        .then(tree => {
            const container = document.getElementById('explorerPane');
            container.innerHTML = '<h2>Explorer</h2>' + renderTree(tree);
            attachTreeListeners();
        });
}

function setupUploadListeners() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    dropZone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

    dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
}

async function handleFiles(files) {
    const formData = new FormData();
    formData.append('file', files[0]);
    await fetch('/api/v1/documents/upload', { method: 'POST', body: formData });
    refreshDashboard();
}

async function categorizeFile(fileName, category, subfolder) {
    const formData = new URLSearchParams();
    formData.append('fileName', fileName);
    formData.append('category', category);
    formData.append('subfolder', subfolder);

    await fetch('/api/v1/documents/categorize', { method: 'POST', body: formData });
    refreshDashboard();
}

async function loadSuggestion(fileName) {
    const pane = document.getElementById('suggestionsPane');

    // 1. Give immediate feedback
    pane.innerHTML = '<h2>Suggestions for ' + fileName + '</h2><p class="loading-text"><i>AI is thinking...</i></p>';

    try {
        console.log("Requesting suggestion for:", fileName);
        const res = await fetch(`/api/v1/documents/suggestions?fileName=${encodeURIComponent(fileName.trim())}`);

        if (!res.ok) {
            pane.innerHTML = `<p style="color:red;">Error fetching suggestions.</p>`;
            return;
        }

        const data = await res.json();

        // 2. Populate the real data
        pane.innerHTML = `
            <h2>Suggestions for ${fileName}</h2>
            <p>Category: <strong>${data.category}</strong></p>
            <p>Folder: <strong>${data.subfolder}</strong></p>
            <button onclick="categorizeFile('${fileName}', '${data.category}', '${data.subfolder}')">
                Accept Suggestion
            </button>
        `;
    } catch (err) {
        pane.innerHTML = `<p style="color:red;">Failed to reach AI service.</p>`;
        console.error("Error:", err);
    }
}

// Initial load
document.addEventListener('DOMContentLoaded', refreshDashboard);