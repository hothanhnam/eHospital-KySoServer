const fs = require('fs');

let css = fs.readFileSync('style.css', 'utf8');

// Ensure login-box has position: relative
if (!css.includes('position: relative;') || !css.match(/\.login-box\s*\{[^}]*position:\s*relative/)) {
    css = css.replace(/\.login-box\s*\{/, '.login-box {\n    position: relative;');
}

// Fix nav-user theme-toggle
css = css.replace(/\.header-right\s*\.theme-toggle\s*\{[^}]*\}/, `.nav-user .theme-toggle {
    position: relative;
    top: 0;
    right: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    margin-right: 15px;
}
.nav-user {
    display: flex;
    align-items: center;
}`);

fs.writeFileSync('style.css', css);

let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.12"/, '"version": "1.0.13"');
fs.writeFileSync('../package.json', pkg);

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\?v=1\.0\.12/g, '?v=1.0.13');
fs.writeFileSync('index.html', html);

console.log("Done fixing css layout");
