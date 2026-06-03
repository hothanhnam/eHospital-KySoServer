const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');
let appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

// Define callAgent if it doesn't exist
if (!appJs.includes('async function callAgent')) {
    appJs = appJs.replace('async function fetchAgents() {', `
async function callAgent(type, payload) {
    const res = await fetch('/api/agent/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentId: currentUser.activeAgentId,
            type: type,
            payload: payload
        })
    });
    return await res.json();
}

async function fetchAgents() {`);
}

// Fix loadFilters which mistakenly used currentUser.uid directly without payload
appJs = appJs.replace(
    /const res = await callAgent\('get-filters', \{\s*uid: currentUser\.uid,\s*reqId: 'req-' \+ Date\.now\(\)\s*\}\);/,
    `const res = await callAgent('get-filters', {});`
);

// We need to implement pagination as well!
appJs = appJs.replace(
    /let currentDocTypeIndex = 0;/,
    `let currentDocTypeIndex = 0;
let totalItems = 0;`
);

appJs = appJs.replace(
    /if \(patientsList.length === 0\) {/,
    `
    totalItems = patientsList.length;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pagedList = patientsList.slice(startIdx, endIdx);
    
    document.getElementById('page-info').innerText = \`Hiển thị \${totalItems > 0 ? startIdx + 1 : 0} - \${Math.min(endIdx, totalItems)}/\${totalItems} bản ghi\`;
    document.getElementById('current-page-num').innerText = currentPage;
    
    if (patientsList.length === 0) {`
);

appJs = appJs.replace(
    /patientsList\.forEach\(\(doc, idx\) => \{/,
    `pagedList.forEach((doc, i) => {
        const idx = startIdx + i;`
);

// Pagination button listeners
if (!appJs.includes("btn-prev-page")) {
    appJs += `

document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});
document.getElementById('btn-next-page').addEventListener('click', () => {
    if (currentPage * pageSize < totalItems) {
        currentPage++;
        renderTable();
    }
});
`;
}

fs.writeFileSync(path.join(publicDir, 'app.js'), appJs);
console.log('Fixed callAgent and pagination');
