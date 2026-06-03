const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');
let appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

if (!appJs.includes("phongBanSelect.addEventListener('change'")) {
    appJs += `
phongBanSelect.addEventListener('change', loadDocumentTypes);
quyenKySelect.addEventListener('change', loadDocumentTypes);
dateFrom.addEventListener('change', loadDocumentTypes);
dateTo.addEventListener('change', loadDocumentTypes);
`;
    fs.writeFileSync(path.join(publicDir, 'app.js'), appJs);
    console.log('Added event listeners for filters');
}
