const fs = require('fs');

// 1. Fix text in index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/Danh sách tài liệu chờ ký/g, 'Danh sách văn bản');
html = html.replace(/\?v=1\.0\.16/g, '?v=1.0.17');
fs.writeFileSync('index.html', html);

// 2. Fix CSS color for .btn-cancel inside .confirm-actions
let css = fs.readFileSync('style.css', 'utf8');
const fixColor = `
.confirm-actions .btn-cancel {
    background: transparent;
    border: 1px solid var(--glass-border);
    color: var(--text-main) !important;
}`;

css = css.replace(/\.confirm-actions\s*\.btn-cancel\s*\{[^}]*\}/, fixColor);
fs.writeFileSync('style.css', css);

// 3. Update package.json version
let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.16"/, '"version": "1.0.17"');
fs.writeFileSync('../package.json', pkg);

console.log("Done fixing text and modal button color");
