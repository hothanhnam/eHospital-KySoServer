const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');
let appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

// Ensure callAgent automatically adds uid
appJs = appJs.replace(
    /payload: payload/,
    `payload: Object.assign({ uid: currentUser.uid || currentUser.id }, payload)`
);

// Replace loadDocumentTypes fetch with callAgent
appJs = appJs.replace(
    /const res = await fetch\('\/api\/agent\/request', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*agentId: currentUser\.activeAgentId,\s*type: 'get-document-types',\s*payload: \{\s*fromDate: dateFrom\.value,\s*toDate: dateTo\.value,\s*deptId: phongBanSelect\.value \? parseInt\(phongBanSelect\.value\) : 0,\s*roleName: quyenKySelect\.value \|\| ''\s*\}\s*\}\)\s*\}\);/m,
    `const res = await callAgent('get-document-types', {
            fromDate: dateFrom.value, 
            toDate: dateTo.value,
            deptId: phongBanSelect.value ? parseInt(phongBanSelect.value) : 0,
            roleName: quyenKySelect.value || ''
        });`
);
appJs = appJs.replace(
    /const data = await res\.json\(\);/,
    `const data = res; // callAgent already does res.json()`
);

// Replace loadPatients fetch with callAgent
appJs = appJs.replace(
    /const res = await fetch\('\/api\/agent\/request', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*agentId: currentUser\.activeAgentId,\s*type: 'get-patients-by-document',\s*payload: \{\s*documentInstanceIDs: ids,\s*reportId: dt \? \(dt\.Report_Id \|\| 0\) : 0,\s*roleName: quyenKySelect\.value \|\| '',\s*fromDate: dateFrom\.value,\s*toDate: dateTo\.value,\s*signStatus: currentTab\s*\}\s*\}\)\s*\}\);\s*const data = await res\.json\(\);/m,
    `const data = await callAgent('get-patients-by-document', {
            documentInstanceIDs: ids,
            reportId: dt ? (dt.Report_Id || 0) : 0,
            roleName: quyenKySelect.value || '',
            fromDate: dateFrom.value,
            toDate: dateTo.value,
            signStatus: currentTab
        });`
);

// Replace batch sign fetch
appJs = appJs.replace(
    /const res = await fetch\('\/api\/agent\/request', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*agentId: currentUser\.activeAgentId,\s*type: 'sign-document',\s*payload: \{ documentInstanceID: id \}\s*\}\)\s*\}\);\s*const data = await res\.json\(\);/gm,
    `const data = await callAgent('sign-document', { documentInstanceID: id });`
);

// Replace individual sign fetch
appJs = appJs.replace(
    /const res = await fetch\('\/api\/agent\/request', \{\s*method: 'POST',\s*headers: \{ 'Content-Type': 'application\/json' \},\s*body: JSON\.stringify\(\{\s*agentId: currentUser\.activeAgentId,\s*type: 'sign-document',\s*payload: \{ documentInstanceID: docId \}\s*\}\)\s*\}\);\s*const data = await res\.json\(\);/m,
    `const data = await callAgent('sign-document', { documentInstanceID: docId });`
);

fs.writeFileSync(path.join(publicDir, 'app.js'), appJs);
console.log('Fixed missing uid payload by refactoring to use callAgent exclusively.');
