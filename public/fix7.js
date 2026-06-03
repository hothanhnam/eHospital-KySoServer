const fs = require('fs');

// Fix inline CSS in index.html
let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\.tabs-container\s*\{\s*display:\s*flex;\s*gap:\s*10px;\s*margin-bottom:\s*15px;\s*background:\s*rgba\(15,23,42,0\.6\);/, 
    '.tabs-container { display: flex; gap: 10px; margin-bottom: 15px; background: var(--card-bg);');
html = html.replace(/\?v=1\.0\.14/g, '?v=1.0.15');
fs.writeFileSync('index.html', html);


// Fix style.css for mobile font size
let css = fs.readFileSync('style.css', 'utf8');
const mobileFix = `
    .tab-btn {
        font-size: 0.9rem !important;
        padding: 6px 12px !important;
    }
`;

// Inject into existing @media (max-width: 768px)
css = css.replace(/@media\s*\(max-width:\s*768px\)\s*\{/, `@media (max-width: 768px) {${mobileFix}`);
fs.writeFileSync('style.css', css);

let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.14"/, '"version": "1.0.15"');
fs.writeFileSync('../package.json', pkg);

console.log("Done fixing tab issues");
