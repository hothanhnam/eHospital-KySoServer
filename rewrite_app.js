const fs = require('fs');
const path = require('path');

const publicDir = path.join(__dirname, 'public');
let appJs = fs.readFileSync(path.join(publicDir, 'app.js'), 'utf8');

// 1. Add new variables for the filters
appJs = appJs.replace(
    /const docTypeSelect = document.getElementById\('doc-type-select'\);/,
    `const phongBanSelect = document.getElementById('phong-ban-select');
const quyenKySelect = document.getElementById('quyen-ky-select');
const docTypeSelect = document.getElementById('doc-type-select');`
);

// 2. Fetch filters on load
appJs = appJs.replace(
    /async function loadDocumentTypes\(\) \{/,
    `async function loadFilters() {
    try {
        const res = await callAgent('get-filters', {
            uid: currentUser.uid,
            reqId: 'req-' + Date.now()
        });
        if (res && res.data) {
            if (res.data.phongBan) {
                phongBanSelect.innerHTML = '<option value="">-- Tất cả --</option>' + 
                    res.data.phongBan.map(p => \`<option value="\${p.MaPhongBan}">\${p.TenPhongBan}</option>\`).join('');
            }
            if (res.data.quyenKy) {
                quyenKySelect.innerHTML = '<option value="">-- Tất cả --</option>' + 
                    res.data.quyenKy.map(q => \`<option value="\${q.MaQuyenKy}">\${q.TenQuyenKy}</option>\`).join('');
                if (res.data.quyenKy.length > 0) {
                    quyenKySelect.value = res.data.quyenKy[0].MaQuyenKy; // Auto select first
                }
            }
        }
    } catch (err) {
        console.error("Lỗi tải bộ lọc:", err);
    }
}

async function loadDocumentTypes() {`
);

// 3. Call loadFilters in showDashboard
appJs = appJs.replace(
    /loadDocumentTypes\(\);/,
    `loadFilters().then(() => loadDocumentTypes());`
);

// 4. Send roleName in get-patients-by-document
appJs = appJs.replace(
    /reportId: docTypeSelect.value \? parseInt\(docTypeSelect.value\) : 0,/,
    `reportId: docTypeSelect.value ? parseInt(docTypeSelect.value) : 0,
            roleName: quyenKySelect.value || '',
            phongBan: phongBanSelect.value || '',`
);

// 5. Update pagination logic (the screenshot shows 1 - 1/1 bản ghi)
appJs = appJs.replace(
    /document.getElementById\('page-info'\).innerText = `Hiển thị \${startIdx \+ 1} - \${Math.min\(endIdx, totalItems\)}\/\${totalItems} bản ghi`;/,
    `document.getElementById('page-info').innerText = \`Hiển thị \${startIdx + 1} - \${Math.min(endIdx, totalItems)}/\${totalItems} bản ghi\`;`
);

// 6. Fix render table to match exactly: STT, Bệnh Nhân, Năm Sinh, Giới Tính, Số Bệnh Án, Trạng Thái, Thao Tác
appJs = appJs.replace(
    /<td><strong>\${doc.TenBenhNhan \|\| ''}<\/strong><\/td>\s*<td>\${doc.NamSinh \|\| ''}<\/td>\s*<td>\${doc.TenPhieu \|\| ''}<\/td>\s*<td>\${doc.DocumentInstance_Id}<\/td>/,
    `<td><strong>\${doc.TenBenhNhan || ''}</strong></td>
            <td>\${doc.NamSinh || doc.Tuoi || ''}</td>
            <td>\${doc.GioiTinh || ''}</td>
            <td>\${doc.BenhAn_Id || doc.TiepNhan_Id || ''}</td>`
);

// 7. Render status badge style
appJs = appJs.replace(
    /const statusHtml = \`<span class="badge" style="background: var\(--\${doc.SignStatus === 1 \? 'success' : 'warning'}\); color: white;">\${statusText}<\/span>\`;/,
    `const statusClass = doc.SignStatus === 1 ? 'status-da-ky' : 'status-chua-ky';
        const statusHtml = \`<span class="status-badge \${statusClass}">\${statusText}</span>\`;`
);

fs.writeFileSync(path.join(publicDir, 'app.js'), appJs);
console.log("Written app.js modifications");
