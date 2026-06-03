// app.js - Logic Frontend cho KySoServer Web Portal

let currentUser = null;
let documentTypes = [];
let patientsList = [];
let currentTab = 0; // 0: Chưa ký, 1: Đã ký
let currentPage = 1;
let pageSize = 20;
let currentDocTypeIndex = 0;
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

function showConfirm(message, onConfirm, title = 'Xác nhận thao tác', okText = 'Xác nhận') {
    const modal = document.getElementById('confirm-modal');
    const titleEl = document.getElementById('confirm-title');
    if (titleEl) titleEl.textContent = title;
    document.getElementById('confirm-msg').textContent = message;
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
        fetchAgents();
    }, 'Xác nhận Đăng xuất', 'Đăng xuất');
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
        
        const docIdForAction = doc.DocumentInstance_Id || doc.Document_Id || '';
        let chkHtml = currentTab === 0 ? '<input type="checkbox" class="chk-item" value="' + docIdForAction + '" style="transform: scale(1.2); cursor: pointer;" onclick="event.stopPropagation(); window.updateBatchSignState()">' : '';
        
        let actionBtn = currentTab === 0 
            ? `<button class="btn-sign" onclick="openSignPreview('${docIdForAction}')">Ký số</button>`
            : `<button class="btn-cancel" onclick="openPreview('${docIdForAction}')">Huỷ ký</button>`;
            
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
            <td style="text-align:center" data-label="Chọn">${chkHtml}</td>
            <td data-label="STT">${idx + 1}</td>
            <td data-label="Bệnh Nhân"><strong>${doc.TenBenhNhan || ''}</strong></td>
            <td data-label="Loại Giấy Tờ"><span style="font-size: 0.9em; color: var(--primary); background: rgba(14,165,233,0.1); padding: 4px 8px; border-radius: 6px;">${docName}</span></td>
            <td data-label="Năm Sinh">${doc.NamSinh || doc.Tuoi || ''}</td>
            <td data-label="Giới Tính">${doc.GioiTinh || ''}</td>
            <td data-label="Số Bệnh Án">${doc.BenhAn_Id || doc.TiepNhan_Id || ''}</td>
            <td data-label="Trạng Thái">${statusHtml}</td>
            <td data-label="Thao Tác" class="td-actions">${actionBtn}</td>
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
            if (loadingTitle) loadingTitle.textContent = 'Đang xử lý ký hàng loạt...';
            if (loadingDesc) loadingDesc.textContent = 'Vui lòng kiểm tra màn hình máy tính của bạn để thao tác.';
            loadingOverlay.classList.remove('hidden');
            let successCount = 0;
            let failCount = 0;
            
            for (const id of ids) {
                try {
                    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == id);
                    if (!doc) continue;
                    
                    const data = await callAgent('sign-document', {
                        documentId: doc.Document_Id,
                        roleName: doc.ResolvedRoleName || doc.RoleName || quyenKySelect.value || '',
                        filePath: doc.File_Path || '',
                        reportCode: doc.Report_Code || '',
                        reportParameter: doc.ReportParameter || ''
                    });
                    if (data.success && data.data && data.data.ok) {
                        successCount++;
                    } else {
                        failCount++;
                        console.error('Lỗi ký số:', data.data?.message);
                    }
                } catch (err) {
                    failCount++;
                }
            }
            
            loadingOverlay.classList.add('hidden');
            showToast('Đã ký xong. Thành công: ' + successCount + ', Thất bại: ' + failCount, successCount > 0 ? 'success' : 'error');
            loadDocumentTypes(); 
        }, 'Xác nhận Ký số', 'Ký số');
    }
});

window.signDocument = async function(docId) {
    document.getElementById('pdf-modal').classList.add('hidden');
    
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
            showToast('Đã ký thành công!', 'success');
            loadDocumentTypes();
        } else {
            showToast(data.data?.message || 'Lỗi khi ký số', 'error');
        }
    } catch(err) {
        showToast('Lỗi kết nối tới Agent', 'error');
    }
    loadingOverlay.classList.add('hidden');
}

window.openPreview = async function(docId) {
    await fetchAndShowPdf(docId, false);
}

window.openSignPreview = async function(docId) {
    await fetchAndShowPdf(docId, true);
}

window.cancelSignDocument = async function(docId) {
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) return;

    showConfirm('Bạn có chắc chắn muốn HỦY KÝ tài liệu này?', async () => {
        if (loadingTitle) loadingTitle.textContent = 'Đang gửi lệnh Hủy ký...';
        if (loadingDesc) loadingDesc.textContent = 'Vui lòng chờ trong giây lát.';
        loadingOverlay.classList.remove('hidden');
        document.getElementById('pdf-modal').classList.add('hidden'); // Close modal if open
        
        try {
            const data = await callAgent('cancel-sign-document', {
                documentId: docId,
                roleName: doc.RoleName || currentRole || '',
                filePath: doc.File_Path || ''
            });
            
            if (data.success && data.data && data.data.ok) {
                showToast('Đã hủy ký thành công!', 'success');
                loadPatients();
            } else {
                showToast(data.message || data?.data?.message || 'Lỗi khi hủy ký', 'error');
            }
        } catch (err) {
            showToast('Lỗi khi kết nối với Agent để hủy ký', 'error');
        }
        loadingOverlay.classList.add('hidden');
    }, 'Xác nhận Hủy ký', 'Hủy ký');
}

async function fetchAndShowPdf(docId, isSigning) {
    // Tìm doc trong patientsList
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('Không tìm thấy thông tin tài liệu', 'error');
        return;
    }
    
    if (loadingTitle) loadingTitle.textContent = 'Đang tải tài liệu...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lòng chờ trong giây lát.';
    loadingOverlay.classList.remove('hidden');
    
    try {
        const data = await callAgent('preview-file', {
            filePath: doc.File_Path || '',
            reportCode: doc.Report_Code || '',
            reportParameter: doc.ReportParameter || ''
        });
        
        if (data.success && data.data && data.data.data && data.data.data.base64) {
            const pdfDataUri = 'data:application/pdf;base64,' + data.data.data.base64;
            document.getElementById('pdf-viewer').src = pdfDataUri;
            
            // Hiện modal
            document.getElementById('pdf-modal').classList.remove('hidden');
            
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
    document.getElementById('pdf-viewer').src = '';
});

document.getElementById('btn-pdf-cancel').addEventListener('click', () => {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.getElementById('pdf-viewer').src = '';
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
        pageSize = parseInt(e.target.value) || 20;
        currentPage = 1;
        renderTable();
    });
}

phongBanSelect.addEventListener('change', loadDocumentTypes);
quyenKySelect.addEventListener('change', loadDocumentTypes);
dateFrom.addEventListener('change', loadDocumentTypes);
dateTo.addEventListener('change', loadDocumentTypes);
