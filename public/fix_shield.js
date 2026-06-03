const fs = require('fs');

let html = fs.readFileSync('index.html', 'utf8');

html = html.replace(/<svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"><\/path><\/svg>/g, '');

html = html.replace(/<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"><\/path><\/svg>/g, '');

html = html.replace(/\?v=1\.0\.9/g, '?v=1.0.10');

fs.writeFileSync('index.html', html);

let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.9"/, '"version": "1.0.10"');
fs.writeFileSync('../package.json', pkg);

console.log("Done removing shields");
