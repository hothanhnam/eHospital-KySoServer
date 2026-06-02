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

// --- Initialization ---
function init() {
    // Check if already logged in (localStorage)
    const storedUser = localStorage.getItem('kyso_user');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        showDashboard();
    }
}

// --- Login Logic ---
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    loginError.textContent = '';
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await res.json();
        if (data.success) {
            currentUser = data.user;
            localStorage.setItem('kyso_user', JSON.stringify(currentUser));
            showDashboard();
        } else {
            loginError.textContent = data.message;
        }
    } catch (err) {
        loginError.textContent = 'Lỗi kết nối đến máy chủ!';
    }
});

btnLogout.addEventListener('click', () => {
    currentUser = null;
    localStorage.removeItem('kyso_user');
    loginView.classList.add('active');
    dashboardView.classList.remove('active');
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
            <td>#${doc.id}</td>
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
        // Gửi lệnh xuống Server, truyền ID của Agent (Ở đây giả lập agentId = username)
        const res = await fetch('/api/sign/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                agentId: currentUser.username, // Assumes the SignCoreVD agent connects with username
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
                alert(`Đã gửi lệnh ký tới USB Token thành công! Vui lòng kiểm tra Agent dưới máy tính.`);
                loadDocuments(); // Refresh to see "Đang xử lý" status
            } else {
                alert(`Lỗi: ${data.error}`);
            }
        }, 1000);
        
    } catch (err) {
        loadingOverlay.classList.add('hidden');
        alert('Có lỗi xảy ra khi kết nối tới Server!');
    }
}

// Chạy Init
init();
