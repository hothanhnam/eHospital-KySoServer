const fs = require('fs');

let css = fs.readFileSync('style.css', 'utf8');

const rootVars = `:root {
    --primary: #0ea5e9;
    --primary-dark: #0284c7;
    --bg-gradient-1: #0f172a;
    --bg-gradient-2: #1e293b;
    --glass-bg: rgba(30, 41, 59, 0.7);
    --glass-border: rgba(255, 255, 255, 0.2);
    --text-main: #f8fafc;
    --text-muted: #94a3b8;
    --danger: #ef4444;
    --success: #10b981;
    --warning: #f59e0b;

    --input-bg: rgba(255, 255, 255, 0.05);
    --input-border: rgba(255, 255, 255, 0.25);
    --input-focus: rgba(255, 255, 255, 0.1);
    --table-border: rgba(255, 255, 255, 0.05);
    --table-hover: rgba(255, 255, 255, 0.02);
    --modal-bg: rgba(15, 23, 42, 0.95);
    --modal-border: rgba(255, 255, 255, 0.2);
    --overlay-bg: rgba(0, 0, 0, 0.6);
    --card-bg: rgba(15, 23, 42, 0.6);
}`;

const lightTheme = `[data-theme="light"] {
  --bg-gradient-1: #f8fafc;
  --bg-gradient-2: #e2e8f0;
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(0, 0, 0, 0.2);
  --text-main: #0f172a;
  --text-muted: #475569;
  
  --input-bg: rgba(255, 255, 255, 0.8);
  --input-border: rgba(0, 0, 0, 0.3);
  --input-focus: rgba(0, 0, 0, 0.15);
  --table-border: rgba(0, 0, 0, 0.1);
  --table-hover: rgba(0, 0, 0, 0.04);
  --modal-bg: rgba(255, 255, 255, 0.95);
  --modal-border: rgba(0, 0, 0, 0.2);
  --overlay-bg: rgba(255, 255, 255, 0.6);
  --card-bg: rgba(255, 255, 255, 0.9);
}`;

css = css.replace(/:root\s*\{[\s\S]*?\}\s*\[data-theme="light"\]\s*\{[\s\S]*?\}/, rootVars + '\n\n' + lightTheme);

fs.writeFileSync('style.css', css);

let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.10"/, '"version": "1.0.11"');
fs.writeFileSync('../package.json', pkg);

let html = fs.readFileSync('index.html', 'utf8');
html = html.replace(/\?v=1\.0\.10/g, '?v=1.0.11');
fs.writeFileSync('index.html', html);

console.log("Done fixing css");
