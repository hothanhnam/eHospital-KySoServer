// app.js - Logic Frontend cho KySoServer Web Portal

let currentUser = null;
let documentTypes = [];
let patientsList = [];
let currentTab = 0; // 0: Chưa ký, 1: Đã ký
let currentPage = 1;
let pageSize = 10;
let currentDocTypeIndex = 0;
let totalItems = 0;

const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userGreeting = document.getElementById('user-greeting');
const btnLogout = document.getElementById('btn-logout');
const btnRefresh = document.getElementById('btn-refresh');
const docsBody = document.getElementById('docs-body');
const loadingOverlay = document.getElementById('loading-overlay');
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
btnRefreshAgents.addEventListener('click', fetchAgents);

const evtSource = new EventSource('/api/events');
evtSource.addEventListener('agents_update', () => {
    fetchAgents();
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedAgent = agentSelect.value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    loginError.textContent = '';
    
    if (!selectedAgent) {
        loginError.textContent = 'Vui lòng chọn Máy ký số!';
        return;
    }
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, agentId: selectedAgent })
        });
        const data = await res.json();
        if (data.success) {
            currentUser = { ...data.user, activeAgentId: selectedAgent };
            localStorage.setItem('kyso_user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            loginError.textContent = data.message;
        }
    } catch (err) {
        loginError.textContent = 'Lỗi kết nối đến máy chủ!';
    }
});

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

function showConfirm(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    document.getElementById('confirm-msg').textContent = message;
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

btnLogout.addEventListener('click', () => {
    showConfirm('Bạn có chắc chắn muốn thoát phiên làm việc hiện tại?', async () => {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: currentUser.uid || currentUser.id, agentId: currentUser.activeAgentId })
            });
        } catch (err) {}
        currentUser = null;
        localStorage.removeItem('kyso_user');
        loginView.classList.add('active');
        dashboardView.classList.remove('active');
    });
});

function showDashboard() {
    loginView.classList.remove('active');
    dashboardView.classList.add('active');
    userGreeting.textContent = 'Xin chào, ' + currentUser.name;
    
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
                docTypeSelect.innerHTML = '<option value="-1">-- Tất cả loại giấy tờ --</option>';
                documentTypes.forEach((dt, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = (dt.TenGiayTo || dt.TenLoaiBaoCao || 'Tài liệu') + ' (Chưa ký: ' + (dt.SoLuong_ChuaKy || dt.CountChuaKy || 0) + ' / Đã ký: ' + (dt.SoLuong_DaKy || dt.CountDaKy || 0) + ')';
                    docTypeSelect.appendChild(opt);
                });
                docTypeSelect.value = "-1";
                currentDocTypeIndex = -1;
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
        loadPatients();
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
    updateBadges();
    loadingOverlay.classList.remove('hidden');
    
    let dt = null;
    let ids = '';
    
    try {
        if (currentDocTypeIndex == -1) {
            // "Tất cả loại giấy tờ" -> Fetch từng loại để đảm bảo lọc đúng Khoa/Phòng và Quyền ký
            let allPatients = [];
            const promises = [];
            const seen = new Set();
            
            for (let i = 0; i < documentTypes.length; i++) {
                const dt = documentTypes[i];
                const ids = currentTab === 0 ? (dt.ListID_ChuaKy || '') : (dt.ListID_DaKy || '');
                
                if (ids && ids.trim() !== '') {
                    const req = callAgent('get-patients-by-document', {
                        documentInstanceIDs: ids,
                        reportId: dt.Report_Id || 0,
                        roleName: dt.RoleName || quyenKySelect.value || '',
                        fromDate: dateFrom.value,
                        toDate: dateTo.value,
                        signStatus: currentTab
                    }).then(data => {
                        if (data.success && data.data && data.data.data) {
                            for (const p of data.data.data) {
                                const key = p.DocumentInstance_Id || p.Document_Id;
                                if (key && !seen.has(key)) {
                                    seen.add(key);
                                    allPatients.push(p);
                                }
                            }
                        }
                    }).catch(err => console.error(err));
                    promises.push(req);
                }
            }
            
            await Promise.all(promises);
            patientsList = allPatients;
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
            if (data.success && data.data && data.data.data) {
                patientsList = data.data.data;
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
    if(document.getElementById('chk-select-all')) document.getElementById('chk-select-all').checked = false;
    
    
    totalItems = patientsList.length;
    const startIdx = (currentPage - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const pagedList = patientsList.slice(startIdx, endIdx);
    
    document.getElementById('page-info').innerText = `Hiển thị ${totalItems > 0 ? startIdx + 1 : 0} - ${Math.min(endIdx, totalItems)}/${totalItems} bản ghi`;
    document.getElementById('current-page-num').innerText = currentPage;
    
    if (patientsList.length === 0) {
        docsBody.innerHTML = '<tr><td colspan="8" style="text-align:center">Không có tài liệu nào</td></tr>';
        return;
    }
    
    pagedList.forEach((doc, i) => {
        const idx = startIdx + i;
        const tr = document.createElement('tr');
        const statusHtml = currentTab === 0 ? '<span class="status-badge status-pending">Chưa ký</span>' : '<span class="status-badge status-signed">Đã ký</span>';
        
        let chkHtml = currentTab === 0 ? '<input type="checkbox" class="chk-item" value="' + doc.DocumentInstance_Id + '" style="transform: scale(1.2); cursor: pointer;" onclick="event.stopPropagation(); window.updateBatchSignState()">' : '';
        
        let actionBtn = currentTab === 0 
            ? `<button class="btn-sign" onclick="signDocument('${doc.DocumentInstance_Id}')">Ký số</button>`
            : `<button class="btn-sign" onclick="previewDocument('${doc.DocumentInstance_Id}')">Xem</button>`;
            
        let docName = 'Tài liệu (Khác)';
        if (documentTypes) {
            const matchingDoc = documentTypes.find(d => d.Report_Id == doc.Report_Id);
            if (matchingDoc) {
                docName = matchingDoc.TenGiayTo || matchingDoc.TenLoaiBaoCao || 'Tài liệu';
            }
        }
            
        tr.innerHTML = `
            <td style="text-align:center">${chkHtml}</td>
            <td>${idx + 1}</td>
            <td><strong>${doc.TenBenhNhan || ''}</strong></td>
            <td><span style="font-size: 0.9em; color: var(--primary); background: rgba(14,165,233,0.1); padding: 4px 8px; border-radius: 6px;">${docName}</span></td>
            <td>${doc.NamSinh || doc.Tuoi || ''}</td>
            <td>${doc.GioiTinh || ''}</td>
            <td>${doc.BenhAn_Id || doc.TiepNhan_Id || ''}</td>
            <td>${statusHtml}</td>
            <td>${actionBtn}</td>
        `;
        docsBody.appendChild(tr);
    });
}

window.updateBatchSignState = function() {
    const chkItems = document.querySelectorAll('.chk-item');
    const checked = document.querySelectorAll('.chk-item:checked');
    const chkSelectAll = document.getElementById('chk-select-all');
    if (chkSelectAll && chkItems.length > 0) {
        chkSelectAll.checked = (checked.length === chkItems.length);
    }
    if (batchCount) batchCount.textContent = checked.length;
    if (btnBatchSign) btnBatchSign.style.display = checked.length > 0 ? 'block' : 'none';
};

document.body.addEventListener('click', (e) => {
    if (e.target.id === 'chk-select-all') {
        const isChecked = e.target.checked;
        document.querySelectorAll('.chk-item').forEach(chk => chk.checked = isChecked);
        window.updateBatchSignState();
    }
    
    if (e.target.id === 'btn-batch-sign' || e.target.closest('#btn-batch-sign')) {
        const checked = document.querySelectorAll('.chk-item:checked');
        if (checked.length === 0) return;
        const ids = Array.from(checked).map(chk => chk.value);
        
        showConfirm('Bạn có chắc chắn muốn ký hàng loạt ' + ids.length + ' tài liệu đã chọn?', async () => {
            loadingOverlay.classList.remove('hidden');
            let successCount = 0;
            let failCount = 0;
            
            for (const id of ids) {
                try {
                    const data = await callAgent('sign-document', { documentInstanceID: id });
                    if (data.success && data.data && data.data.success) {
                        successCount++;
                    } else failCount++;
                } catch (err) {
                    failCount++;
                }
            }
            
            loadingOverlay.classList.add('hidden');
            showToast('Đã ký xong. Thành công: ' + successCount + ', Thất bại: ' + failCount, successCount > 0 ? 'success' : 'error');
            loadDocumentTypes(); 
        });
    }
});

window.signDocument = async function(docId) {
    loadingOverlay.classList.remove('hidden');
    try {
        const data = await callAgent('sign-document', { documentInstanceID: docId });
        if (data.success && data.data && data.data.success) {
            showToast('Đã ký thành công!', 'success');
            loadDocumentTypes();
        } else {
            showToast('Lỗi ký số: ' + (data.data?.message || ''), 'error');
        }
    } catch(err) {
        showToast('Lỗi kết nối tới Agent', 'error');
    }
    loadingOverlay.classList.add('hidden');
}

window.previewDocument = function(docId) {
    showToast('Chức năng xem trước PDF chưa được implement mock up', 'warning');
}

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

phongBanSelect.addEventListener('change', loadDocumentTypes);
quyenKySelect.addEventListener('change', loadDocumentTypes);
dateFrom.addEventListener('change', loadDocumentTypes);
dateTo.addEventListener('change', loadDocumentTypes);
