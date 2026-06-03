const fs = require('fs');

// 1. Update style.css
let styleText = fs.readFileSync('style.css', 'utf8');

// Add .btn-cancel after .btn-sign:disabled
styleText = styleText.replace(/\.btn-sign:disabled\s*\{\s*background:\s*var\(--glass-border\);\s*color:\s*var\(--text-muted\);\s*cursor:\s*not-allowed;\s*\}/, 
`.btn-sign:disabled {
    background: var(--glass-border);
    color: var(--text-muted);
    cursor: not-allowed;
}

.btn-cancel {
    padding: 6px 12px;
    border: none;
    border-radius: 6px;
    background: var(--danger, #ef4444);
    color: white;
    cursor: pointer;
    font-size: 0.85em;
    font-weight: 500;
    transition: all 0.2s ease;
}
.btn-cancel:hover {
    background: #dc2626;
}`);

// Change mobile style for td-actions button
styleText = styleText.replace(/\.table-container td\.td-actions button\s*\{\s*flex:\s*1;\s*padding:\s*10px;\s*\}/,
`.table-container td.td-actions button {
        flex: 1;
        padding: 12px;
        font-size: 1.1rem;
        border-radius: 8px;
        font-weight: 600;
    }`);

fs.writeFileSync('style.css', styleText);

// 2. Update app.js to reset search input and agent-select
let appText = fs.readFileSync('app.js', 'utf8');

if (!appText.includes('agentSelect.value = "";')) {
    appText = appText.replace('function init() {', 'function init() {\n    if(document.getElementById("agent-select")) document.getElementById("agent-select").value = "";\n    if(document.getElementById("search-input")) document.getElementById("search-input").value = "";\n    if(document.getElementById("page-size-select")) document.getElementById("page-size-select").value = "50";');
}
if (!appText.includes('if(document.getElementById("search-input")) document.getElementById("search-input").value = "";')) {
    appText = appText.replace('function showDashboard() {', 'function showDashboard() {\n    if(document.getElementById("search-input")) document.getElementById("search-input").value = "";\n    if(document.getElementById("page-size-select")) document.getElementById("page-size-select").value = "50";\n    currentPage = 1;\n    currentTab = 0;');
}

fs.writeFileSync('app.js', appText);

// 3. Update index.html autocomplete
let htmlText = fs.readFileSync('index.html', 'utf8');
htmlText = htmlText.replace(/<select/g, '<select autocomplete="off"');
htmlText = htmlText.replace(/<input/g, '<input autocomplete="off"');

// 4. Bump versions
htmlText = htmlText.replace(/\?v=1\.0\.7/g, '?v=1.0.8');
fs.writeFileSync('index.html', htmlText);

let pkgText = fs.readFileSync('../package.json', 'utf8');
pkgText = pkgText.replace(/"version": "1\.0\.7"/, '"version": "1.0.8"');
fs.writeFileSync('../package.json', pkgText);

console.log("Done updates");
