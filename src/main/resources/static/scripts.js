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
            const listContainer = document.getElementById('fileList');
            listContainer.innerHTML = files.map(f => `
                <div class="pending-item">
                    <span>${f}</span>
                    <button onclick="categorizeFile('${f}', 'ACADEMIC', 'PAPERS')">Sort to Academic</button>
                </div>
            `).join('');
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

// Initial load on page start
document.addEventListener('DOMContentLoaded', refreshDashboard);

const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');

// Click to upload
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

// Drag and drop handlers
dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

async function handleFiles(files) {
    const formData = new FormData();
    formData.append('file', files[0]);

    await fetch('/api/v1/documents/upload', {
        method: 'POST',
        body: formData
    });

    // Refresh the dashboard after upload
    refreshDashboard();
}

async function categorizeFile(fileName, category, subfolder) {
    const formData = new URLSearchParams();
    formData.append('fileName', fileName);
    formData.append('category', category);
    formData.append('subfolder', subfolder);

    await fetch('/api/v1/documents/categorize', {
        method: 'POST',
        body: formData
    });

    // Refresh to update both the Pending list and the Explorer tree
    refreshDashboard();
}