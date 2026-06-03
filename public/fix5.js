const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

const toggleBtn = `<div onclick="toggleTheme()" class="theme-toggle" title="Đổi giao diện">
    <svg id="theme-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="5"></circle>
        <line x1="12" y1="1" x2="12" y2="3"></line>
        <line x1="12" y1="21" x2="12" y2="23"></line>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
        <line x1="1" y1="12" x2="3" y2="12"></line>
        <line x1="21" y1="12" x2="23" y2="12"></line>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
        <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
</div>`;

if (!html.includes('id="theme-icon"')) {
    // Insert into login box
    html = html.replace(/<div class="glass-panel login-box">/, '<div class="glass-panel login-box">\n            ' + toggleBtn);
    // Insert into dashboard nav
    html = html.replace(/<div class="nav-user">/, '<div class="nav-user">\n                ' + toggleBtn);
}

html = html.replace(/\?v=1\.0\.11/g, '?v=1.0.12');

fs.writeFileSync('index.html', html);

let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.11"/, '"version": "1.0.12"');
fs.writeFileSync('../package.json', pkg);

console.log("Done inserting toggle");
