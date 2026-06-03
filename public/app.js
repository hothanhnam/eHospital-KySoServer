// app.js - Logic Frontend cho KySoServer Web Portal

// State
let currentUser = null;
let documents = [];

// DOM Elements
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

// --- Initialization ---
function init() {
    // Check if already logged in (localStorage)
    const storedUser = localStorage.getItem('kyso_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    } else {
        fetchAgents();
    }
}

// --- Fetch Active Agents ---
async function fetchAgents() {
    try {
        const res = await fetch('/api/agents');
        const data = await res.json();
        
        agentSelect.innerHTML = '';
        if (data.data.length === 0) {
            const opt = document.createElement('option');
            opt.value = '';
            opt.textContent = '-- Chưa có máy ký số nào đang bật --';
            agentSelect.appendChild(opt);
        } else {
            data.data.forEach(agentId => {
                const opt = document.createElement('option');
                opt.value = agentId;
                opt.textContent = agentId; // Bỏ chữ "Máy: "
                agentSelect.appendChild(opt);
            });
            // Tự động chọn Agent đầu tiên
            agentSelect.selectedIndex = 0;
        }
    } catch (err) {
        agentSelect.innerHTML = '<option value="">Lỗi tải danh sách Agent</option>';
    }
}

btnRefreshAgents.addEventListener('click', fetchAgents);

// --- Realtime SSE for Agent Updates ---
const evtSource = new EventSource('/api/events');
evtSource.addEventListener('agents_update', () => {
    // Chỉ auto-refresh nếu người dùng đang ở trang đăng nhập
    if (loginView.classList.contains('active')) {
        fetchAgents();
    }
});

// --- Login Logic ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const selectedAgent = agentSelect.value;
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    loginError.textContent = '';
    
    if (!selectedAgent) {
        if (agentSelect.options.length <= 1) {
            loginError.textContent = 'Không có agent nào đang hoạt động, vui lòng liên hệ quản trị để được xử lý!';
        } else {
            loginError.textContent = 'Vui lòng chọn Máy ký số!';
        }
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

// --- UI Components ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>`;
    } else if (type === 'warning') {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>`;
    } else {
        iconSvg = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
    }

    toast.innerHTML = `
        <div class="toast-icon">${iconSvg}</div>
        <div class="toast-content">${message}</div>
    `;
    
    container.appendChild(toast);
    
    // Trigger animation
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Remove after 3s
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

function showConfirm(message, onConfirm) {
    const modal = document.getElementById('confirm-modal');
    const msgEl = document.getElementById('confirm-msg');
    const btnCancel = document.getElementById('btn-confirm-cancel');
    const btnOk = document.getElementById('btn-confirm-ok');
    
    msgEl.textContent = message;
    modal.classList.remove('hidden');
    
    // Cleanup old listeners to prevent multiple triggers
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);
    
    newBtnCancel.addEventListener('click', () => {
        modal.classList.add('hidden');
    });
    
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
                // Fallback id if uid is missing (for old cached user data)
                body: JSON.stringify({ uid: currentUser.uid || currentUser.id, agentId: currentUser.activeAgentId })
            });
        } catch (err) {
            console.error('Lỗi khi logout:', err);
        }
        
        currentUser = null;
        localStorage.removeItem('kyso_user');
        loginView.classList.add('active');
        dashboardView.classList.remove('active');
        showToast('Đã đăng xuất thành công', 'success');
    });
});

// --- View Transition ---
function showDashboard() {
    loginView.classList.remove('active');
    dashboardView.classList.add('active');
    userGreeting.textContent = `Xin chào, ${currentUser.name}`;
    loadDocuments();
}

// --- Dashboard Logic ---
async function loadDocuments() {
    try {
        const res = await fetch('/api/documents');
        const data = await res.json();
        if (data.success) {
            documents = data.data;
            renderTable();
        }
    } catch (err) {
        console.error('Failed to load documents', err);
    }
}

btnRefresh.addEventListener('click', loadDocuments);

function renderTable() {
    docsBody.innerHTML = '';
    
    if (documents.length === 0) {
        docsBody.innerHTML = `<tr><td colspan="5" style="text-align:center">Không có tài liệu nào cần ký</td></tr>`;
        return;
    }
    
    documents.forEach(doc => {
        const tr = document.createElement('tr');
        
        // Status formatting
        let statusHtml = '';
        let btnDisabled = '';
        let btnText = 'Ký số';
        
        if (doc.status === 'pending') {
            statusHtml = `<span class="status-badge status-pending">Chờ ký</span>`;
        } else if (doc.status === 'signing') {
            statusHtml = `<span class="status-badge status-signing">Đang xử lý</span>`;
            btnDisabled = 'disabled';
            btnText = 'Đang xử lý...';
        } else if (doc.status === 'signed') {
            statusHtml = `<span class="status-badge status-signed">Đã ký</span>`;
            btnDisabled = 'disabled';
            btnText = 'Đã hoàn tất';
        }

        tr.innerHTML = `
            <td><input type="checkbox" class="chk-item" value="${doc.id}" style="transform: scale(1.2); cursor: pointer;" onclick="event.stopPropagation(); window.updateBatchSignState()"></td><td>#${doc.id}</td>
            <td><strong>${doc.title}</strong></td>
            <td>${doc.date}</td>
            <td>${statusHtml}</td>
            <td>
                <button class="btn-sign" onclick="signDocument('${doc.id}')" ${btnDisabled}>
                    ${btnText}
                </button>
            </td>
        `;
        docsBody.appendChild(tr);
    });
}

// --- Ký số (Trigger Agent) ---
window.signDocument = async function(docId) {
    const doc = documents.find(d => d.id === docId);
    if (!doc) return;
    
    // Show Loading Modal
    loadingOverlay.classList.remove('hidden');
    
    try {
        // Gửi lệnh xuống Server, truyền ID của Agent đã chọn lúc Login
        const res = await fetch('/api/sign/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentUser.activeAgentId, 
                docId: docId,
                payload: {
                    action: 'SIGN_DOCUMENT',
                    documentId: docId,
                    title: doc.title,
                    timestamp: new Date().toISOString()
                }
            })
        });
        
        const data = await res.json();
        
        // Dừng Loading Modal sau 2 giây mô phỏng (Trong thực tế sẽ dùng WebSocket để nhận kết quả từ Agent)
        setTimeout(() => {
            loadingOverlay.classList.add('hidden');
            if (data.success) {
                showToast(`Đã gửi lệnh ký tới USB Token thành công! Vui lòng kiểm tra màn hình máy tính.`, 'success');
                loadDocuments(); // Refresh to see "Đang xử lý" status
            } else {
                showToast(`Lỗi: ${data.error}`, 'error');
            }
        }, 1000);
        
    } catch (err) {
        loadingOverlay.classList.add('hidden');
        showToast('Có lỗi xảy ra khi kết nối tới Server!', 'error');
    }
}

// Chạy Init
init();

// --- Batch Sign Logic ---
window.updateBatchSignState = function() {
    const chkItems = document.querySelectorAll('.chk-item');
    const checked = document.querySelectorAll('.chk-item:checked');
    const chkSelectAll = document.getElementById('chk-select-all');
    const btnBatchSign = document.getElementById('btn-batch-sign');
    const batchCount = document.getElementById('batch-count');
    
    if (chkSelectAll && chkItems.length > 0) {
        chkSelectAll.checked = (checked.length === chkItems.length);
    }
    if (batchCount) batchCount.textContent = checked.length;
    if (btnBatchSign) btnBatchSign.style.display = checked.length > 0 ? 'block' : 'none';
};

document.addEventListener('DOMContentLoaded', () => {
    document.body.addEventListener('click', (e) => {
        if (e.target.id === 'chk-select-all') {
            const isChecked = e.target.checked;
            document.querySelectorAll('.chk-item').forEach(chk => {
                if(!chk.disabled) chk.checked = isChecked;
            });
            window.updateBatchSignState();
        }
        
        if (e.target.id === 'btn-batch-sign' || e.target.closest('#btn-batch-sign')) {
            const checked = document.querySelectorAll('.chk-item:checked');
            if (checked.length === 0) return;
            const ids = Array.from(checked).map(chk => chk.value);
            
            showConfirm(Bạn có chắc chắn muốn ký hàng loạt  + ids.length +  tài liệu đã chọn?, async () => {
                loadingOverlay.classList.remove('hidden');
                let successCount = 0;
                let failCount = 0;
                
                for (const id of ids) {
                    try {
                        const doc = documents.find(d => d.id == id);
                        const res = await fetch('/api/sign/request', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                agentId: currentUser.activeAgentId,
                                docId: id,
                                payload: {
                                    action: 'SIGN_DOCUMENT',
                                    documentId: id,
                                    title: doc ? doc.title : 'Tài liệu',
                                    timestamp: new Date().toISOString()
                                }
                            })
                        });
                        const data = await res.json();
                        if (data.success) successCount++;
                        else failCount++;
                    } catch (err) {
                        failCount++;
                    }
                }
                
                setTimeout(() => {
                    loadingOverlay.classList.add('hidden');
                    showToast(Đã gửi lệnh ký xong. Thành công:  + successCount + , Thất bại:  + failCount, successCount > 0 ? 'success' : 'error');
                    loadDocuments();
                }, 1000);
            });
        }
    });
});
