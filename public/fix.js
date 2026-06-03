const fs = require('fs');
let text = fs.readFileSync('app.js', 'utf8');

text = text.replace(/`<button class="btn-sign" onclick="openSignPreview\('\$\{docIdForAction\}'\)">.*?<\/button>`/g, '`<button class="btn-sign" onclick="openSignPreview(\'${docIdForAction}\')">Ký số</button>`');

text = text.replace(/`<button class="btn-cancel" onclick="openPreview\('\$\{docIdForAction\}'\)">.*?<\/button>`/g, '`<button class="btn-cancel" onclick="openPreview(\'${docIdForAction}\')">Huỷ ký</button>`');

fs.writeFileSync('app.js', text);
console.log("Done");
