const fs = require('fs');
const path = require('path');
const publicDir = path.join(__dirname, 'public');
let appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

// Ensure callAgent automatically adds nhanVienId
appJs = appJs.replace(
    /payload: Object\.assign\(\{ uid: currentUser\.uid \|\| currentUser\.id \}, payload\)/,
    `payload: Object.assign({ uid: currentUser.uid || currentUser.id, nhanVienId: currentUser.nhanVienId || currentUser.nhanVien_Id || 0 }, payload)`
);

fs.writeFileSync(path.join(publicDir, 'app.js'), appJs);
console.log('Fixed missing nhanVienId payload by refactoring callAgent.');
