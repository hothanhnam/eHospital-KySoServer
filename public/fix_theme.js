const fs = require('fs');

// 1. UPDATE index.html
let html = fs.readFileSync('index.html', 'utf8');

// Texts
html = html.replace(/<h2>SignCore Portal<\/h2>/g, '<div style="margin-bottom:10px;"><img src="https://vinhduchospital.com/wp-content/uploads/2023/04/Logo_Benh-Vien.png" style="height: 60px; object-fit: contain;" alt="Logo Bệnh Viện"></div>');
html = html.replace(/<p class="subtitle">Hệ thống Ký số Y tế Tập trung<\/p>/g, '<p class="subtitle">Hệ thống Ký số Từ xa</p>');
html = html.replace(/<label>Chọn máy ký số \(Agent\)<\/label>/g, '<label>Máy chủ</label>');
html = html.replace(/<span>SignCore Portal<\/span>/g, '<img src="https://vinhduchospital.com/wp-content/uploads/2023/04/Logo_Benh-Vien.png" style="height: 35px; object-fit: contain;" alt="Logo">');

// Theme toggles
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

// Insert into login box top right (we can just put it absolute inside login-box)
html = html.replace(/<div class="login-box">/, '<div class="login-box">\n            ' + toggleBtn);
// Insert into header
html = html.replace(/<div class="header-right">/, '<div class="header-right">\n                    ' + toggleBtn);

html = html.replace(/\?v=1\.0\.8/g, '?v=1.0.9');
fs.writeFileSync('index.html', html);


// 2. UPDATE app.js
let app = fs.readFileSync('app.js', 'utf8');
if(!app.includes('function toggleTheme()')) {
    const themeCode = `
// Theme management
let currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
updateThemeIcon();

function toggleTheme() {
    currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', currentTheme);
    localStorage.setItem('theme', currentTheme);
    updateThemeIcon();
}

function updateThemeIcon() {
    document.querySelectorAll('#theme-icon').forEach(icon => {
        if (currentTheme === 'light') {
            // Moon icon for light mode (to switch to dark)
            icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
        } else {
            // Sun icon for dark mode (to switch to light)
            icon.innerHTML = '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>';
        }
    });
}
`;
    app = themeCode + '\n' + app;
}
fs.writeFileSync('app.js', app);


// 3. UPDATE style.css
let css = fs.readFileSync('style.css', 'utf8');

const themeVars = `
  --input-bg: rgba(255, 255, 255, 0.05);
  --input-border: rgba(255, 255, 255, 0.1);
  --input-focus: rgba(255, 255, 255, 0.1);
  --table-border: rgba(255, 255, 255, 0.05);
  --table-hover: rgba(255, 255, 255, 0.02);
  --modal-bg: rgba(15, 23, 42, 0.95);
  --modal-border: rgba(255, 255, 255, 0.1);
  --overlay-bg: rgba(0, 0, 0, 0.6);
  --card-bg: rgba(15, 23, 42, 0.6);
}

[data-theme="light"] {
  --bg-gradient-1: #f8fafc;
  --bg-gradient-2: #e2e8f0;
  --glass-bg: rgba(255, 255, 255, 0.85);
  --glass-border: rgba(0, 0, 0, 0.1);
  --text-main: #0f172a;
  --text-muted: #475569;
  
  --input-bg: rgba(0, 0, 0, 0.03);
  --input-border: rgba(0, 0, 0, 0.1);
  --input-focus: rgba(0, 0, 0, 0.08);
  --table-border: rgba(0, 0, 0, 0.05);
  --table-hover: rgba(0, 0, 0, 0.02);
  --modal-bg: rgba(255, 255, 255, 0.95);
  --modal-border: rgba(0, 0, 0, 0.1);
  --overlay-bg: rgba(255, 255, 255, 0.6);
  --card-bg: rgba(255, 255, 255, 0.8);
}
`;

css = css.replace(/--warning: #f59e0b;\s*\}/, '--warning: #f59e0b;\n' + themeVars);

// Replace hardcoded values
css = css.replace(/color:\s*white;/g, 'color: var(--text-main);');
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.05\)/g, 'var(--input-bg)');
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, 'var(--input-border)');
css = css.replace(/rgba\(255,\s*255,\s*255,\s*0\.02\)/g, 'var(--table-hover)');
css = css.replace(/rgba\(0,\s*0,\s*0,\s*0\.6\)/g, 'var(--overlay-bg)');
css = css.replace(/rgba\(15,\s*23,\s*42,\s*0\.6\)/g, 'var(--card-bg)');
css = css.replace(/rgba\(15,\s*23,\s*42,\s*0\.9\)/g, 'var(--modal-bg)');
css = css.replace(/rgba\(15,\s*23,\s*42,\s*0\.85\)/g, 'var(--modal-bg)');

// Add theme toggle button style
if(!css.includes('.theme-toggle')) {
    css += `
.theme-toggle {
    cursor: pointer;
    position: absolute;
    top: 20px;
    right: 20px;
    color: var(--text-main);
    opacity: 0.7;
    transition: all 0.3s ease;
}
.theme-toggle:hover {
    opacity: 1;
    transform: scale(1.1);
}
.header-right .theme-toggle {
    position: relative;
    top: 0;
    right: 0;
    margin-right: 15px;
}
`;
}

// Special overrides for light mode buttons so they stay white text
css += `
.btn-sign, .btn-cancel, .btn-batch-action, .btn-danger {
    color: white !important;
}
`;

fs.writeFileSync('style.css', css);

// 4. Update package.json
let pkg = fs.readFileSync('../package.json', 'utf8');
pkg = pkg.replace(/"version": "1\.0\.8"/, '"version": "1.0.9"');
fs.writeFileSync('../package.json', pkg);

console.log("Done theme updates");
