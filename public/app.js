
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

// app.js - Logic Frontend cho KySoServer Web Portal

let currentUser = null;
let documentTypes = [];
let patientsList = [];
let currentTab = 0; // 0: Chưa ký, 1: Đã ký
let currentPage = 1;
let pageSize = parseInt(localStorage.getItem('kyso_pageSize') || '10');
let currentDocTypeIndex = -1;
let totalItems = 0;
let currentLoadToken = 0;

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userGreeting = document.getElementById('user-greeting');
const btnLogout = document.getElementById('btn-logout');
const btnRefresh = document.getElementById('btn-refresh');
const docsBody = document.getElementById('docs-body');
const loadingOverlay = document.getElementById('loading-overlay');
const loadingTitle = document.getElementById('loading-title');
const loadingDesc = document.getElementById('loading-desc');
const agentSelect = document.getElementById('agent-select');
const btnRefreshAgents = document.getElementById('btn-refresh-agents');

const phongBanSelect = document.getElementById('phong-ban-select');
const quyenKySelect = document.getElementById('quyen-ky-select');
const docTypeSelect = document.getElementById('doc-type-select');
const dateFrom = document.getElementById('date-from');
const dateTo = document.getElementById('date-to');
const tabBtns = document.querySelectorAll('.tab-btn');
const btnBatchSign = document.getElementById('btn-batch-sign');
const batchCount = document.getElementById('batch-count');
const badgeChuaKy = document.getElementById('badge-chua-ky');
const badgeDaKy = document.getElementById('badge-da-ky');

function init() {
    if(document.getElementById("agent-select")) document.getElementById("agent-select").value = "";
    if(document.getElementById("search-input")) document.getElementById("search-input").value = "";
    if(document.getElementById("page-size-select")) document.getElementById("page-size-select").value = pageSize.toString();
    const storedUser = localStorage.getItem('kyso_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    } else {
        fetchAgents();
    }
}


async function callAgent(type, payload) {
    const res = await fetch('/api/agent/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            agentId: currentUser.activeAgentId,
            type: type,
            payload: Object.assign({ uid: currentUser.uid || currentUser.id, nhanVienId: currentUser.nhanVienId || currentUser.nhanVien_Id || 0 }, payload)
        })
    });
    const data = await res.json();
    
    // Auto logout if agent is missing/disconnected or session expired
    if (!data.success && data.message && (data.message.includes('không khả dụng') || data.message.includes('mất kết nối'))) {
        showToast('Mất kết nối với Máy ký số. Đang đăng xuất...', 'error');
        setTimeout(forceLogout, 1500);
        throw new Error('Agent disconnected');
    }
    if (data.success && data.data && data.data.error === 'UNAUTHORIZED') {
        showToast('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'error');
        setTimeout(forceLogout, 1500);
        throw new Error('Unauthorized');
    }
    return data;
}

function forceLogout() {
    currentUser = null;
    localStorage.removeItem('kyso_user');
    loginView.classList.add('active');
    dashboardView.classList.remove('active');
    
    if(document.getElementById('username')) document.getElementById('username').value = '';
    if(document.getElementById('password')) document.getElementById('password').value = '';
    if(loginForm) loginForm.reset();
    if(loginError) loginError.textContent = '';
    
    // Ensure the agent list is refreshed when returning to the login page
    fetchAgents();
}

async function fetchAgents() {
    try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        
        if (currentUser && currentUser.activeAgentId) {
            if (!data.data.includes(currentUser.activeAgentId)) {
                showToast('Máy ký số của bạn đã ngắt kết nối!', 'error');
                setTimeout(forceLogout, 1500);
                // Continue to update the dropdown for the login screen
            }
        }
        
        agentSelect.innerHTML = '';
        if (data.data.length === 0) {
            agentSelect.innerHTML = '<option value="">-- Chưa có máy ký số nào đang bật --</option>';
        } else {
            data.data.forEach(agentId => {
                const opt = document.createElement('option');
                opt.value = agentId;
                opt.textContent = agentId;
                agentSelect.appendChild(opt);
            });
            agentSelect.selectedIndex = 0;
        }
    } catch (err) {
        agentSelect.innerHTML = '<option value="">Lỗi tải danh sách Agent</option>';
    }
}
if (btnRefreshAgents) {
    btnRefreshAgents.addEventListener('click', fetchAgents);
}

const evtSource = new EventSource('/api/events');
evtSource.addEventListener('agents_update', () => {
    fetchAgents();
});

async function handleLogin() {
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const username = usernameInput.value;
    const password = passwordInput.value;
    
    // Clear the form fields immediately upon submit
    usernameInput.value = '';
    passwordInput.value = '';
    
    if(loginError) loginError.textContent = '';
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = { ...data.user };
            if(data.data?.selectedAgent) currentUser.activeAgentId = data.data.selectedAgent;
            else if(data.selectedAgent) currentUser.activeAgentId = data.selectedAgent;
            else if(data.user.activeAgentId) currentUser.activeAgentId = data.user.activeAgentId;
            
            localStorage.setItem('kyso_user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            if(loginError) loginError.textContent = data.message || 'Đăng nhập thất bại!';
        }
    } catch (err) {
        if(loginError) loginError.textContent = 'Lỗi kết nối đến máy chủ!';
    }
}

const btnLogin = document.getElementById('btn-login');
if(btnLogin) btnLogin.addEventListener('click', handleLogin);

const usernameInputEl = document.getElementById('username');
const passwordInputEl = document.getElementById('password');
if(usernameInputEl) usernameInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });
if(passwordInputEl) passwordInputEl.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleLogin(); });

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.innerHTML = '<div class="toast-content">' + message + '</div>';
    container.appendChild(toast);
    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function showConfirm(message, onConfirm, title = 'Xác nhận thao tác', okText = 'Xác nhận') {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    if (titleEl) titleEl.textContent = title;
    document.getElementById('confirm-msg').innerHTML = message;
    document.getElementById('btn-confirm-ok').textContent = okText;
    modal.classList.remove('hidden');
    
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnOk = document.getElementById('btn-confirm-ok');
    
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    newBtnCancel.addEventListener('click', () => modal.classList.add('hidden'));
    newBtnOk.addEventListener('click', () => {
        modal.classList.add('hidden');
        onConfirm();
    });
}

function showPrompt(title, message, onConfirm) {
    const modal = document.getElementById('prompt-modal');
    document.getElementById('prompt-title').textContent = title;
    document.getElementById('prompt-msg').innerHTML = message;
    
    const inputEl = document.getElementById('prompt-input');
    inputEl.value = '';
    const errorEl = document.getElementById('prompt-error');
    errorEl.textContent = '';
    
    modal.classList.remove('hidden');
    inputEl.focus();
    
    const btnCancel = document.getElementById('btn-prompt-cancel');
    const btnOk = document.getElementById('btn-prompt-ok');
    
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    newBtnOk.addEventListener('click', () => {
        onConfirm(inputEl.value, (errorMsg) => {
            if(errorMsg) {
                errorEl.textContent = errorMsg;
                inputEl.value = '';
                inputEl.focus();
            } else {
                modal.classList.add('hidden');
            }
        });
    });
    
    inputEl.addEventListener('keydown', (e) => {
        if(e.key === 'Enter') newBtnOk.click();
    });
    
    newBtnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
}

btnLogout.addEventListener('click', () => {
    showConfirm('Bạn có chắc chắn muốn thoát phiên làm việc hiện tại?', async () => {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: currentUser.uid || currentUser.id, agentId: currentUser.activeAgentId })
            });
        } catch (err) {}
        forceLogout();
    }, 'Xác nhận Đăng xuất', 'Đăng xuất');
});

function showDashboard() {
    loginView.classList.remove('active');
    dashboardView.classList.add('active');
    userGreeting.textContent = 'Xin chào, ' + currentUser.name;
    
    // Reset tab to "Chưa ký" (0)
    currentTab = 0;
    tabBtns.forEach(b => {
        if(b.dataset.tab === "0") b.classList.add('active');
        else b.classList.remove('active');
    });
    
    // Set date default to today
    const today = new Date().toISOString().split('T')[0];
    if(dateFrom) dateFrom.value = today;
    if(dateTo) dateTo.value = today;
    
    loadFilters().then(() => loadDocumentTypes());
}

async function loadFilters() {
    try {
        const res = await callAgent('get-filters', {});
        const agentData = res?.data?.data;
        if (agentData) {
            if (agentData.phongBan) {
                phongBanSelect.innerHTML = '<option value="">-- Tất cả --</option>' + 
                    agentData.phongBan.map(p => `<option value="${p.MaPhongBan}">${p.TenPhongBan}</option>`).join('');
            }
            if (agentData.quyenKy) {
                quyenKySelect.innerHTML = '<option value="">-- Tất cả --</option>' + 
                    agentData.quyenKy.map(q => `<option value="${q.MaQuyenKy}">${q.TenQuyenKy}</option>`).join('');
                quyenKySelect.value = ""; // Auto select 'Tất cả'
            }
        }
    } catch (err) {
        console.error("Lỗi tải bộ lọc:", err);
    }
}

async function loadDocumentTypes() {
    if (loadingTitle) loadingTitle.textContent = 'Đang xử lý...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lòng chờ trong giây lát.';
    loadingOverlay.classList.remove('hidden');
    try {
        const res = await callAgent('get-document-types', {
            fromDate: dateFrom.value, 
            toDate: dateTo.value,
            deptId: phongBanSelect.value ? parseInt(phongBanSelect.value) : 0,
            roleName: quyenKySelect.value || ''
        });
        const data = res;
        if (data.success && data.data && data.data.data) {
            documentTypes = data.data.data;
            if(docTypeSelect) {
                const prevSelection = currentDocTypeIndex;
                docTypeSelect.innerHTML = '<option value="-1">-- Tất cả loại giấy tờ --</option>';
                documentTypes.forEach((dt, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = (dt.TenGiayTo || dt.TenLoaiBaoCao || 'Tài liệu') + ' (Chưa ký: ' + (dt.SoLuong_ChuaKy || dt.CountChuaKy || 0) + ' / Đã ký: ' + (dt.SoLuong_DaKy || dt.CountDaKy || 0) + ')';
                    docTypeSelect.appendChild(opt);
                });
                if (prevSelection >= 0 && prevSelection < documentTypes.length) {
                    docTypeSelect.value = prevSelection;
                    currentDocTypeIndex = prevSelection;
                } else {
                    docTypeSelect.value = "-1";
                    currentDocTypeIndex = -1;
                }
            }
            updateBadges();
            loadPatients();
        } else {
            showToast('Không tải được danh sách loại tài liệu', 'error');
            loadingOverlay.classList.add('hidden');
        }
    } catch (err) {
        showToast('Lỗi kết nối tới Agent', 'error');
        loadingOverlay.classList.add('hidden');
    }
}

if(btnRefresh) btnRefresh.addEventListener('click', loadDocumentTypes);

// Auto refresh on filter change
if(dateFrom) dateFrom.addEventListener('change', loadDocumentTypes);
if(dateTo) dateTo.addEventListener('change', loadDocumentTypes);
if(phongBanSelect) phongBanSelect.addEventListener('change', loadDocumentTypes);
if(quyenKySelect) quyenKySelect.addEventListener('change', loadDocumentTypes);

if(docTypeSelect) {
    docTypeSelect.addEventListener('change', (e) => {
        currentDocTypeIndex = e.target.value;
        loadPatients();
    });
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
        tabBtns.forEach(b => b.classList.remove('active'));
        e.target.closest('button').classList.add('active');
        currentTab = parseInt(e.target.closest('button').dataset.tab);
        loadDocumentTypes();
    });
});

function updateBadges() {
    if (currentDocTypeIndex == -1) {
        let countChuaKy = 0;
        let countDaKy = 0;
        documentTypes.forEach(dt => {
            countChuaKy += (dt.SoLuong_ChuaKy || dt.CountChuaKy || 0);
            countDaKy += (dt.SoLuong_DaKy || dt.CountDaKy || 0);
        });
        if(badgeChuaKy) badgeChuaKy.textContent = countChuaKy;
        if(badgeDaKy) badgeDaKy.textContent = countDaKy;
    } else if (documentTypes.length > 0 && currentDocTypeIndex >= 0) {
        const dt = documentTypes[currentDocTypeIndex];
        if(badgeChuaKy) badgeChuaKy.textContent = dt.SoLuong_ChuaKy || dt.CountChuaKy || 0;
        if(badgeDaKy) badgeDaKy.textContent = dt.SoLuong_DaKy || dt.CountDaKy || 0;
    }
}

async function loadPatients() {
    currentPage = 1;
    updateBadges();
    if (loadingTitle) loadingTitle.textContent = 'Đang xử lý...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lòng chờ trong giây lát.';
    loadingOverlay.classList.remove('hidden');
    
    currentLoadToken++;
    const myToken = currentLoadToken;
    
    let dt = null;
    let ids = '';
    
    try {
        if (currentDocTypeIndex == -1) {
            // "Tất cả loại giấy tờ" -> Fetch 1 lần duy nhất bằng reportId = 0 để C# Agent tự xử lý gom nhóm, tránh quá tải WS
            const data = await callAgent('get-patients-by-document', {
                documentInstanceIDs: '',
                reportId: 0,
                roleName: quyenKySelect.value || '',
                deptId: phongBanSelect.value ? parseInt(phongBanSelect.value) : 0,
                fromDate: dateFrom.value,
                toDate: dateTo.value,
                signStatus: currentTab
            });
            if (myToken !== currentLoadToken) return; // Bỏ qua nếu có request mới hơn
            
            if (data.success && data.data && data.data.data) {
                patientsList = data.data.data;
            } else {
                patientsList = [];
            }
            renderTable();
        } else {
            const dt = documentTypes[currentDocTypeIndex];
            if (!dt) {
                loadingOverlay.classList.add('hidden');
                return;
            }
            const ids = currentTab === 0 ? (dt.ListID_ChuaKy || '') : (dt.ListID_DaKy || '');
            if(!ids || ids.trim() === '') {
                patientsList = [];
                renderTable();
                loadingOverlay.classList.add('hidden');
                return;
            }
            
            const data = await callAgent('get-patients-by-document', {
                documentInstanceIDs: ids,
                reportId: dt.Report_Id || 0,
                roleName: dt.RoleName || quyenKySelect.value || '',
                fromDate: dateFrom.value,
                toDate: dateTo.value,
                signStatus: currentTab
            });
            if (myToken !== currentLoadToken) return; // Bỏ qua nếu có request mới hơn
            
            if (data.success && data.data && data.data.data) {
                patientsList = data.data.data;
                // Gán tên trực tiếp từ loại giấy tờ đang chọn
                for (const p of patientsList) {
                    p.ResolvedDocName = dt.TenGiayTo || dt.TenLoaiBaoCao || 'Tài liệu';
                }
                renderTable();
            } else {
                patientsList = [];
                renderTable();
            }
        }
    } catch (err) {
        showToast('Lỗi tải danh sách hồ sơ', 'error');
    }
    loadingOverlay.classList.add('hidden');
}

function renderTable() {
    docsBody.innerHTML = '';
    
    if(btnBatchSign) btnBatchSign.style.display = 'none';
    const chkSelectAll = document.getElementById('chk-select-all');
    if(chkSelectAll) {
        chkSelectAll.checked = false;
        chkSelectAll.style.display = currentTab === 0 ? 'inline-block' : 'none';
    }
    
    const searchInput = document.getElementById('grid-search');
    const query = (searchInput?.value || '').toLowerCase().trim();
    
    const filteredList = patientsList.filter(doc => {
        if (!query) return true;
        const searchStr = `${doc.TenBenhNhan || ''} ${doc.SoBenhAn || ''} ${doc.TiepNhan_Id || ''} ${doc.BenhAn_Id || ''} ${doc.MaYTe || ''} ${doc.SoVaoVien || ''} ${doc.SoTiepNhan || ''} ${doc.NamSinh || ''} ${doc.Tuoi || ''}`.toLowerCase();
        return searchStr.includes(query);
    });
    
    totalItems = filteredList.length;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pagedList = filteredList.slice(startIdx, endIdx);
    
    document.getElementById('page-info').innerText = `Hiển thị ${totalItems > 0 ? startIdx + 1 : 0} - ${Math.min(endIdx, totalItems)}/${totalItems} bản ghi`;
    document.getElementById('current-page-num').innerText = currentPage;
    
    if (filteredList.length === 0) {
        docsBody.innerHTML = '<tr><td colspan="8" style="text-align:center">Không có tài liệu nào</td></tr>';
        return;
    }
    
    pagedList.forEach((doc, i) => {
        const idx = startIdx + i;
        const tr = document.createElement('tr');
        const statusHtml = currentTab === 0 ? '<span class="status-badge status-pending">Chưa ký</span>' : '<span class="status-badge status-signed">Đã ký</span>';
        
        const docIdForAction = doc.DocumentInstance_Id || doc.Document_Id || '';
        
        let actionBtn = currentTab === 0 
            ? `<button class="btn-sign" onclick="openSignPreview('${docIdForAction}')">Ký</button>`
            : `<div style="display: flex; gap: 5px; justify-content: center;">
                 <button class="btn-secondary" onclick="openPreview('${docIdForAction}')" style="padding: 5px 10px; font-size: 0.8rem;">Xem</button>
                 <button class="btn-cancel" onclick="cancelSignDocument('${docIdForAction}')" style="padding: 5px 10px; font-size: 0.8rem;">Huỷ ký</button>
               </div>`;
            
        let docName = doc.ResolvedDocName || 'Tài liệu (Khác)';
        if (!doc.ResolvedDocName && documentTypes) {
            let rId = doc.Report_Id;
            let rName = doc.RoleName;
            
            if (rId === undefined) {
                const key = Object.keys(doc).find(k => k.toLowerCase() === 'report_id');
                if (key) rId = doc[key];
            }
            if (rName === undefined) {
                const key = Object.keys(doc).find(k => k.toLowerCase() === 'rolename');
                if (key) rName = doc[key];
            }
            
            let matchingDoc = documentTypes.find(d => d.Report_Id == rId && (rName ? d.RoleName == rName : true));
            if (!matchingDoc) matchingDoc = documentTypes.find(d => d.Report_Id == rId);
            if (matchingDoc) {
                docName = matchingDoc.TenGiayTo || matchingDoc.TenLoaiBaoCao || 'Tài liệu';
                doc.ResolvedDocName = docName;
                doc.ResolvedRoleName = matchingDoc.RoleName;
            }
        }
            
        tr.innerHTML = `
            <td data-label="STT">${idx + 1}</td>
            <td data-label="Bệnh Nhân"><strong>${doc.TenBenhNhan || ''}</strong></td>
            <td data-label="Loại Giấy Tờ"><span style="font-size: 0.9em; color: var(--primary); background: rgba(14,165,233,0.1); padding: 4px 8px; border-radius: 6px;">${docName}</span></td>
            <td data-label="Năm Sinh">${doc.NamSinh || doc.Tuoi || ''}</td>
            <td data-label="Giới Tính">${doc.GioiTinh || ''}</td>
            <td data-label="Số TN / Số BA">${doc.SoBenhAn || doc.SoVaoVien || doc.MaYTe || doc.BenhAn_Id || doc.TiepNhan_Id || doc.SoTiepNhan || ''}</td>
            <td data-label="Trạng Thái">${statusHtml}</td>
            <td data-label="Thao Tác" class="td-actions">${actionBtn}</td>
        `;
        docsBody.appendChild(tr);
    });
}

let currentPdfBase64 = null;
let currentPdfDocName = null;
let currentZoomLevel = 100;

function updateZoom() {
    const zoomSpan = document.getElementById('zoom-level');
    if(zoomSpan) zoomSpan.textContent = currentZoomLevel + '%';
    const canvases = document.querySelectorAll('#pdf-viewer-container canvas');
    canvases.forEach(canvas => {
        canvas.style.width = currentZoomLevel + '%';
    });
}

document.getElementById('btn-zoom-in')?.addEventListener('click', () => {
    if (currentZoomLevel < 300) { currentZoomLevel += 25; updateZoom(); }
});
document.getElementById('btn-zoom-out')?.addEventListener('click', () => {
    if (currentZoomLevel > 50) { currentZoomLevel -= 25; updateZoom(); }
});

document.getElementById('btn-download-pdf')?.addEventListener('click', async () => {
    if (!currentPdfBase64) return;
    const btn = document.getElementById('btn-download-pdf');
    const originalText = btn.innerHTML;
    btn.innerHTML = 'Đang xử lý...';
    btn.disabled = true;
    
    try {
        let finalBase64 = currentPdfBase64;
        if (window.PDFLib) {
            const { PDFDocument, rgb, degrees } = window.PDFLib;
            const pdfDoc = await PDFDocument.load(currentPdfBase64);
            const pages = pdfDoc.getPages();
            
            let fullnameRaw = currentUser?.name || 'User';
            let usernameRaw = currentUser?.username || currentUser?.uid || currentUser?.id || currentUser?.nhanVienId || 'Unknown';
            
            // Remove Vietnamese accents to prevent pdf-lib WinAnsiEncoding error
            const removeAccents = (str) => {
                if(!str) return '';
                return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
            };
            
            let fullname = removeAccents(String(fullnameRaw));
            let username = removeAccents(String(usernameRaw));
            
            const now = new Date();
            const timeStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
            const watermarkText = `${fullname}_${username}_${timeStr}`;
            
            for (const page of pages) {
                const { width, height } = page.getSize();
                // Draw a large diagonal watermark in the center
                page.drawText(watermarkText, {
                    x: width / 2 - 250, // Approximate centering
                    y: height / 2 - 50,
                    size: 32,
                    color: rgb(0.6, 0.6, 0.6), // xám trắng
                    opacity: 0.3, // mờ
                    rotate: degrees(45)
                });
                
                // Draw at top
                page.drawText(watermarkText, {
                    x: width / 2 - 250,
                    y: height - 150,
                    size: 32,
                    color: rgb(0.6, 0.6, 0.6),
                    opacity: 0.3,
                    rotate: degrees(45)
                });
                
                // Draw at bottom
                page.drawText(watermarkText, {
                    x: width / 2 - 250,
                    y: 150,
                    size: 32,
                    color: rgb(0.6, 0.6, 0.6),
                    opacity: 0.3,
                    rotate: degrees(45)
                });
            }
            finalBase64 = await pdfDoc.saveAsBase64({ dataUri: false });
        }
        
        // Use Fetch to convert base64 to Blob, which is required for mobile browsers
        const res = await fetch('data:application/pdf;base64,' + finalBase64);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = objectUrl;
        link.download = (currentPdfDocName || 'Tai_lieu') + '.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
    } catch (err) {
        console.error('Lỗi tải PDF:', err);
        showToast('Có lỗi xảy ra khi xử lý file', 'error');
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
});

window.signDocument = async function(docId) {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('Không tìm thấy thông tin tài liệu để ký', 'error');
        return;
    }
    
    if (loadingTitle) loadingTitle.textContent = 'Đang gửi lệnh xuống Agent...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lòng kiểm tra màn hình máy tính của bạn để thao tác.';
    loadingOverlay.classList.remove('hidden');
    try {
        const data = await callAgent('sign-document', {
            documentId: doc.Document_Id,
            roleName: doc.ResolvedRoleName || doc.RoleName || quyenKySelect.value || '',
            filePath: doc.File_Path || '',
            reportCode: doc.Report_Code || '',
            reportParameter: doc.ReportParameter || ''
        });
        if (data.success && data.data && data.data.ok) {
            showToast('Đã gửi lệnh ký số thành công!', 'success');
            await new Promise(r => setTimeout(r, 1500));
            await loadDocumentTypes();
        } else {
            showToast(data.message || data?.data?.message || 'Lỗi ký số', 'error');
        }
    } catch(err) {
        showToast('Lỗi khi gửi lệnh ký số', 'error');
    }
    loadingOverlay.classList.add('hidden');
}

window.openPreview = async function(docId) {
    await openSignPreview(docId, false);
}

window.cancelSignDocument = async function(docId) {
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('Không tìm thấy tài liệu', 'error');
        return;
    }
    const docName = doc.Report_Name || doc.Document_Name || 'Tài liệu';
    const patientName = doc.TenBenhNhan || 'Bệnh nhân';

    showConfirm(`Bạn có chắc chắn muốn HỦY KÝ <b>${docName}</b> của bệnh nhân <b>${patientName}</b>?`, async () => {
        if (loadingTitle) loadingTitle.textContent = 'Đang gửi lệnh Hủy ký...';
        if (loadingDesc) loadingDesc.textContent = 'Vui lòng chờ trong giây lát.';
        loadingOverlay.classList.remove('hidden');
        document.getElementById('pdf-modal').classList.add('hidden'); // Close modal if open
        document.body.classList.remove('modal-open');
        
        try {
            const data = await callAgent('cancel-sign-document', {
                documentId: docId,
                roleName: doc.RoleName || currentRole || '',
                filePath: doc.File_Path || ''
            });
            
            if (data.success && data.data && data.data.ok) {
                showToast('Đã hủy ký thành công!', 'success');
                await new Promise(r => setTimeout(r, 1500));
                await loadDocumentTypes();
            } else {
                showToast(data.message || data?.data?.message || 'Lỗi khi hủy ký', 'error');
            }
        } catch (err) {
            showToast('Lỗi hệ thống khi hủy ký', 'error');
        }
        loadingOverlay.classList.add('hidden');
    }, 'Xác nhận Hủy ký', 'Hủy ký');
}

window.openSignPreview = async function(docId, isSigning = true) {
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('Không tìm thấy tài liệu', 'error');
        return;
    }
    const docName = doc.Report_Name || doc.Document_Name || 'Tài liệu';
    
    if (loadingTitle) loadingTitle.textContent = 'Đang tải bản xem trước...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lòng chờ trong giây lát.';
    loadingOverlay.classList.remove('hidden');
    
    try {
        const data = await callAgent('preview-file', {
            filePath: doc.File_Path || '',
            reportCode: doc.Report_Code || '',
            reportParameter: doc.ReportParameter || ''
        });
        
        if (data.success && data.data && data.data.data && data.data.data.base64) {
            currentPdfBase64 = data.data.data.base64;
            currentPdfDocName = docName;
            currentZoomLevel = 100;
            const zoomSpan = document.getElementById('zoom-level');
            if(zoomSpan) zoomSpan.textContent = '100%';
            
            const container = document.getElementById('pdf-viewer-container');
            const viewer = document.getElementById('pdf-viewer');
            
            // Force PDF.js for all platforms to allow custom Zoom and uniform UI
            if (window.pdfjsLib) {
                viewer.style.display = 'none';
                container.style.display = 'block';
                container.innerHTML = '<div style="padding: 20px; text-align: center;">Đang xử lý PDF...</div>';
                
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';
                const pdfData = atob(currentPdfBase64);
                const uint8Array = new Uint8Array(pdfData.length);
                for (let i = 0; i < pdfData.length; i++) {
                    uint8Array[i] = pdfData.charCodeAt(i);
                }
                
                pdfjsLib.getDocument({ data: uint8Array }).promise.then(function(pdf) {
                    container.innerHTML = '';
                    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                        const canvas = document.createElement('canvas');
                        canvas.style.display = 'block';
                        canvas.style.margin = '0 auto 10px auto';
                        canvas.style.width = '100%';
                        canvas.style.maxWidth = 'none';
                        canvas.style.height = 'auto';
                        canvas.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                        container.appendChild(canvas);
                        
                        pdf.getPage(pageNum).then(function(page) {
                            // Render at 2x scale for higher quality, then CSS scales down to width=100%
                            const viewport = page.getViewport({scale: 2.0});
                            canvas.height = viewport.height;
                            canvas.width = viewport.width;
                            const context = canvas.getContext('2d');
                            page.render({ canvasContext: context, viewport: viewport });
                        });
                    }
                }).catch(err => {
                    container.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">Lỗi hiển thị PDF</div>';
                });
            } else {
                // Fallback if pdf.js fails to load
                container.style.display = 'none';
                viewer.style.display = 'block';
                viewer.src = 'data:application/pdf;base64,' + currentPdfBase64 + '#toolbar=0';
            }
            
            // Hiện modal
            document.getElementById('pdf-modal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            
            // Xử lý nút Ký số & Hủy ký
            const btnSign = document.getElementById('btn-pdf-sign');
            const btnCancelSign = document.getElementById('btn-pdf-cancel-sign');
            
            if (isSigning) {
                btnSign.style.display = 'block';
                btnSign.onclick = () => window.signDocument(docId);
                btnCancelSign.style.display = 'none';
            } else {
                btnSign.style.display = 'none';
                btnCancelSign.style.display = 'block';
                btnCancelSign.onclick = () => window.cancelSignDocument(docId);
            }
        } else {
            showToast(data?.data?.message || 'Không thể xem trước tài liệu', 'error');
        }
    } catch (err) {
        showToast('Lỗi khi tải file xem trước', 'error');
    }
    loadingOverlay.classList.add('hidden');
}

document.getElementById('btn-close-pdf').addEventListener('click', () => {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    document.getElementById('pdf-viewer').src = '';
    const container = document.getElementById('pdf-viewer-container');
    if(container) container.innerHTML = '';
});

document.getElementById('btn-pdf-cancel').addEventListener('click', () => {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    document.getElementById('pdf-viewer').src = '';
    const container = document.getElementById('pdf-viewer-container');
    if(container) container.innerHTML = '';
});

init();


document.getElementById('btn-prev-page').addEventListener('click', () => {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
});
document.getElementById('btn-next-page').addEventListener('click', () => {
    if (currentPage * pageSize < totalItems) {
        currentPage++;
        renderTable();
    }
});

const pageSizeSelect = document.getElementById('page-size-select');
if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => {
        pageSize = parseInt(e.target.value) || 10;
        localStorage.setItem('kyso_pageSize', pageSize);
        currentPage = 1;
        renderTable();
    });
}

phongBanSelect.addEventListener('change', loadDocumentTypes);
quyenKySelect.addEventListener('change', loadDocumentTypes);
dateFrom.addEventListener('change', loadDocumentTypes);
dateTo.addEventListener('change', loadDocumentTypes);

let initialTouchDistance = 0;
let initialTouchZoom = 100;
const pdfContainer = document.getElementById('pdf-viewer-container');
pdfContainer?.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        initialTouchDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        initialTouchZoom = currentZoomLevel;
    }
}, {passive: false});
pdfContainer?.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const currentDistance = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        const scale = currentDistance / initialTouchDistance;
        let newZoom = initialTouchZoom * scale;
        if (newZoom < 50) newZoom = 50;
        if (newZoom > 400) newZoom = 400;
        currentZoomLevel = Math.round(newZoom);
        updateZoom();
    }
}, {passive: false});

const gridSearch = document.getElementById('grid-search');
const btnClearSearch = document.getElementById('btn-clear-search');
if(gridSearch) {
    gridSearch.addEventListener('input', () => {
        if(btnClearSearch) btnClearSearch.style.display = gridSearch.value ? 'block' : 'none';
        currentPage = 1;
        renderTable();
    });
}
if(btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
        if(gridSearch) gridSearch.value = '';
        btnClearSearch.style.display = 'none';
        currentPage = 1;
        renderTable();
    });
}

const btnMobileFilter = document.getElementById('btn-mobile-filter');
const filtersContainer = document.getElementById('filters-container');

function toggleMobileFilter() {
    if(filtersContainer) {
        filtersContainer.classList.toggle('show');
    }
}
if(btnMobileFilter) btnMobileFilter.addEventListener('click', toggleMobileFilter);
const btnRefreshMobile = document.getElementById('btn-refresh');
if(btnRefreshMobile) btnRefreshMobile.addEventListener('click', () => {
    if (filtersContainer && filtersContainer.classList.contains('show')) { toggleMobileFilter(); }
});
