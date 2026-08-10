
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
let currentTab = 0; // 0: ChÆ°a kÃ½, 1: ÄÃ£ kÃ½
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
const chkLanhDao = document.getElementById('chk-lanh-dao');
const chkLanhDaoContainer = document.getElementById('lanh-dao-checkbox-container');
const chkAllRoles = document.getElementById('chk-all-roles');
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
    if (!data.success && data.message && (data.message.includes('khÃ´ng kháº£ dá»¥ng') || data.message.includes('máº¥t káº¿t ná»‘i'))) {
        showToast('Máº¥t káº¿t ná»‘i vá»›i MÃ¡y kÃ½ sá»‘. Äang Ä‘Äƒng xuáº¥t...', 'error');
        setTimeout(forceLogout, 1500);
        throw new Error('Agent disconnected');
    }
    if (data.success && data.data && data.data.error === 'UNAUTHORIZED') {
        showToast('PhiÃªn Ä‘Äƒng nháº­p Ä‘Ã£ háº¿t háº¡n. Vui lÃ²ng Ä‘Äƒng nháº­p láº¡i.', 'error');
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
                showToast('MÃ¡y kÃ½ sá»‘ cá»§a báº¡n Ä‘Ã£ ngáº¯t káº¿t ná»‘i!', 'error');
                setTimeout(forceLogout, 1500);
                // Continue to update the dropdown for the login screen
            }
        }
        
        agentSelect.innerHTML = '';
        if (data.data.length === 0) {
            agentSelect.innerHTML = '<option value="">-- ChÆ°a cÃ³ mÃ¡y kÃ½ sá»‘ nÃ o Ä‘ang báº­t --</option>';
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
        agentSelect.innerHTML = '<option value="">Lá»—i táº£i danh sÃ¡ch Agent</option>';
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
    
    let captchaToken = '';
    if (window.turnstileRequired && window.turnstileWidgetId !== null) {
        try {
            captchaToken = turnstile.getResponse(window.turnstileWidgetId);
            if (!captchaToken) {
                if(loginError) loginError.textContent = 'Vui lÃ²ng xÃ¡c nháº­n Captcha (Chá»‘ng Spam)!';
                return;
            }
        } catch (e) {
            console.error('Turnstile error:', e);
        }
    }
    
    const deviceToken = localStorage.getItem('kyso_device_token') || '';

    if(loginError) loginError.textContent = '';
    
    // Hiá»ƒn thá»‹ Waitform (Loading Overlay) trÆ°á»›c khi gá»­i Request
    if(loadingTitle) loadingTitle.textContent = 'Äang xá»­ lÃ½...';
    if(loadingDesc) loadingDesc.textContent = 'Äang kiá»ƒm tra thÃ´ng tin Ä‘Äƒng nháº­p.';
    if(loadingOverlay) loadingOverlay.classList.remove('hidden');
    
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, captchaToken, deviceToken })
        });
        const data = await res.json();
        
        if (data.requireOtp) {
            // Hiá»ƒn thá»‹ form OTP
            document.getElementById('login-form').style.display = 'none';
            document.getElementById('otp-form').style.display = 'block';
            document.getElementById('otp-phone').textContent = data.phoneMasked || '*******86';
            window.tempOtpToken = data.tempToken;
            window.otpUsername = username;
            
            // XoÃ¡ tráº¯ng form sau khi Ä‘Ã£ bá»‹ che khuáº¥t
            usernameInput.value = '';
            passwordInput.value = '';
            return;
        }

        if (data.success) {
            // XoÃ¡ tráº¯ng form
            usernameInput.value = '';
            passwordInput.value = '';
            processLoginSuccess(data);
        } else {
            if(loginError) loginError.textContent = data.message || 'ÄÄƒng nháº­p tháº¥t báº¡i!';
            // Chá»‰ clear máº­t kháº©u náº¿u sai
            passwordInput.value = '';
            // Reset turnstile widget if login fails
            if (window.turnstileRequired && window.turnstileWidgetId !== null && window.turnstile) {
                turnstile.reset(window.turnstileWidgetId);
            }
        }
    } catch (err) {
        if(loginError) loginError.textContent = 'Lá»—i káº¿t ná»‘i Ä‘áº¿n mÃ¡y chá»§!';
    } finally {
        // Táº¯t Waitform
        if(loadingOverlay) loadingOverlay.classList.add('hidden');
    }
}

function processLoginSuccess(data) {
    if (data.deviceToken) {
        localStorage.setItem('kyso_device_token', data.deviceToken);
    }
    currentUser = { ...data.user };
    if(data.data?.selectedAgent) currentUser.activeAgentId = data.data.selectedAgent;
    else if(data.selectedAgent) currentUser.activeAgentId = data.selectedAgent;
    else if(data.user.activeAgentId) currentUser.activeAgentId = data.user.activeAgentId;
    
    localStorage.setItem('kyso_user', JSON.stringify(currentUser));
    
    // Äáº£m báº£o Reset Form
    document.getElementById('login-form').style.display = 'block';
    const otpForm = document.getElementById('otp-form');
    if (otpForm) otpForm.style.display = 'none';
    const otpCodeInput = document.getElementById('otp-code');
    if (otpCodeInput) otpCodeInput.value = '';

    showDashboard();
}

async function handleVerifyOtp() {
    const otpCode = document.getElementById('otp-code').value;
    const otpError = document.getElementById('otp-error');
    if (!otpCode || otpCode.length < 6) {
        otpError.textContent = 'Vui lÃ²ng nháº­p Ä‘á»§ 6 sá»‘ OTP.';
        return;
    }

    otpError.textContent = '';
    const btnVerify = document.getElementById('btn-verify-otp');
    btnVerify.disabled = true;

    try {
        const res = await fetch('/api/verify-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tempToken: window.tempOtpToken, otp: otpCode })
        });
        const data = await res.json();
        
        if (data.success) {
            processLoginSuccess(data);
        } else {
            otpError.textContent = data.message || 'MÃ£ OTP khÃ´ng chÃ­nh xÃ¡c!';
            btnVerify.disabled = false;
        }
    } catch (e) {
        otpError.textContent = 'Lá»—i káº¿t ná»‘i mÃ¡y chá»§!';
        btnVerify.disabled = false;
    }
}

function handleCancelOtp() {
    document.getElementById('otp-form').style.display = 'none';
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('otp-code').value = '';
    document.getElementById('otp-error').textContent = '';
    window.tempOtpToken = null;
    
    // Reset turnstile
    if (window.turnstileRequired && window.turnstileWidgetId !== null && window.turnstile) {
        turnstile.reset(window.turnstileWidgetId);
    }
}

const btnVerifyOtp = document.getElementById('btn-verify-otp');
if (btnVerifyOtp) btnVerifyOtp.addEventListener('click', handleVerifyOtp);

const btnCancelOtp = document.getElementById('btn-cancel-otp');
if (btnCancelOtp) btnCancelOtp.addEventListener('click', handleCancelOtp);

const otpCodeInput = document.getElementById('otp-code');
if (otpCodeInput) otpCodeInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleVerifyOtp(); });

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

function showConfirm(message, onConfirm, title = 'XÃ¡c nháº­n thao tÃ¡c', okText = 'XÃ¡c nháº­n') {
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

function showPrompt(title, message, onConfirm, inputType = 'password', placeholder = '******') {
    const modal = document.getElementById('prompt-modal');
    modal.style.zIndex = '9999';
    document.getElementById('prompt-title').textContent = title;
    document.getElementById('prompt-msg').innerHTML = message;
    
    const inputEl = document.getElementById('prompt-input');
    inputEl.type = inputType;
    inputEl.placeholder = placeholder;
    if (inputType === 'text') {
        inputEl.style.letterSpacing = 'normal';
    } else {
        inputEl.style.letterSpacing = '5px';
    }
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
    showConfirm('Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n thoÃ¡t phiÃªn lÃ m viá»‡c hiá»‡n táº¡i?', async () => {
        try {
            await fetch('/api/logout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: currentUser.uid || currentUser.id, agentId: currentUser.activeAgentId })
            });
        } catch (err) {}
        forceLogout();
    }, 'XÃ¡c nháº­n ÄÄƒng xuáº¥t', 'ÄÄƒng xuáº¥t');
});

function showDashboard() {
    loginView.classList.remove('active');
    dashboardView.classList.add('active');
    userGreeting.textContent = 'Xin chÃ o, ' + currentUser.name;
    
    const adminDropdown = document.getElementById('admin-dropdown-container');
    if (currentUser.isAdmin) {
        if(adminDropdown) adminDropdown.style.display = 'block';
    } else {
        if(adminDropdown) adminDropdown.style.display = 'none';
    }
    
    // Reset tab to "ChÆ°a kÃ½" (0)
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
                phongBanSelect.innerHTML = '<option value="">-- Táº¥t cáº£ --</option>' + 
                    agentData.phongBan.map(p => `<option value="${p.MaPhongBan}">${p.TenPhongBan}</option>`).join('');
            }
            if (agentData.quyenKy) {
                quyenKySelect.innerHTML = '<option value="">-- Táº¥t cáº£ --</option>' + 
                    agentData.quyenKy.map(q => `<option value="${q.MaQuyenKy}">${q.TenQuyenKy}</option>`).join('');
                const lanhDaoOpt = Array.from(quyenKySelect.options).find(o => o.text.trim().toLowerCase() === "ban lÃ£nh Ä‘áº¡o bá»‡nh viá»‡n");
                if (chkLanhDaoContainer) {
                    if (lanhDaoOpt) {
                        chkLanhDaoContainer.style.display = 'flex';
                        if (chkLanhDao && chkLanhDao.checked) {
                            quyenKySelect.value = lanhDaoOpt.value;
                        } else {
                            quyenKySelect.value = "";
                        }
                    } else {
                        chkLanhDaoContainer.style.display = 'none';
                        if(chkLanhDao) chkLanhDao.checked = false;
                        quyenKySelect.value = "";
                    }
                } else {
                    quyenKySelect.value = "";
                }
            }
        }
    } catch (err) {
        console.error("Lá»—i táº£i bá»™ lá»c:", err);
    }
}

async function loadDocumentTypes() {
    if (loadingTitle) loadingTitle.textContent = 'Äang xá»­ lÃ½...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lÃ²ng chá» trong giÃ¢y lÃ¡t.';
    loadingOverlay.classList.remove('hidden');
    try {
        const res = await callAgent('get-document-types', {
            fromDate: dateFrom.value, 
            toDate: dateTo.value,
            deptId: phongBanSelect.value ? parseInt(phongBanSelect.value) : 0,
            roleName: quyenKySelect.value || '',
            allRoles: chkAllRoles ? chkAllRoles.checked : false
        });
        const data = res;
        if (data.success && data.data && data.data.data) {
            documentTypes = data.data.data;
            if(docTypeSelect) {
                const prevSelection = currentDocTypeIndex;
                docTypeSelect.innerHTML = '<option value="-1">-- Táº¥t cáº£ loáº¡i giáº¥y tá» --</option>';
                documentTypes.forEach((dt, idx) => {
                    const opt = document.createElement('option');
                    opt.value = idx;
                    opt.textContent = (dt.TenGiayTo || dt.TenLoaiBaoCao || 'TÃ i liá»‡u') + ' (ChÆ°a kÃ½: ' + (dt.SoLuong_ChuaKy || dt.CountChuaKy || 0) + ' / ÄÃ£ kÃ½: ' + (dt.SoLuong_DaKy || dt.CountDaKy || 0) + ')';
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
            showToast('KhÃ´ng táº£i Ä‘Æ°á»£c danh sÃ¡ch loáº¡i tÃ i liá»‡u', 'error');
            loadingOverlay.classList.add('hidden');
        }
    } catch (err) {
        showToast('Lá»—i káº¿t ná»‘i tá»›i Agent', 'error');
        loadingOverlay.classList.add('hidden');
    }
}

if(btnRefresh) btnRefresh.addEventListener('click', loadDocumentTypes);

// Auto refresh on filter change removed - controlled by btn-search
if(quyenKySelect) {
    quyenKySelect.addEventListener('change', () => {
        if (quyenKySelect.options[quyenKySelect.selectedIndex]?.text.trim().toLowerCase() !== "ban lÃ£nh Ä‘áº¡o bá»‡nh viá»‡n") {
            if(chkLanhDao) chkLanhDao.checked = false;
        } else {
            if(chkLanhDao) chkLanhDao.checked = true;
        }
    });
}
if(chkAllRoles) {
    // chkAllRoles.addEventListener('change', loadDocumentTypes);
}

if(chkLanhDao) {
    chkLanhDao.addEventListener('change', () => {
        if (chkLanhDao.checked) {
            let found = false;
            for(let i = 0; i < quyenKySelect.options.length; i++) {
                if (quyenKySelect.options[i].text.trim().toLowerCase() === "ban lÃ£nh Ä‘áº¡o bá»‡nh viá»‡n") {
                    quyenKySelect.selectedIndex = i;
                    found = true;
                    break;
                }
            }
            if (!found) quyenKySelect.value = "";
        } else {
            quyenKySelect.value = "";
        }
    });
}

if(docTypeSelect) {
    docTypeSelect.addEventListener('change', (e) => {
        currentDocTypeIndex = e.target.value;
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
    if (loadingTitle) loadingTitle.textContent = 'Äang xá»­ lÃ½...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lÃ²ng chá» trong giÃ¢y lÃ¡t.';
    loadingOverlay.classList.remove('hidden');
    
    currentLoadToken++;
    const myToken = currentLoadToken;
    
    let dt = null;
    let ids = '';
    
    try {
        if (currentDocTypeIndex == -1) {
            // "Táº¥t cáº£ loáº¡i giáº¥y tá»" -> Fetch 1 láº§n duy nháº¥t báº±ng reportId = 0 Ä‘á»ƒ C# Agent tá»± xá»­ lÃ½ gom nhÃ³m, trÃ¡nh quÃ¡ táº£i WS
            const data = await callAgent('get-patients-by-document', {
                documentInstanceIDs: '',
                reportId: 0,
                roleName: quyenKySelect.value || '',
                deptId: phongBanSelect.value ? parseInt(phongBanSelect.value) : 0,
                fromDate: dateFrom.value,
                toDate: dateTo.value,
                signStatus: currentTab,
                allRoles: chkAllRoles ? chkAllRoles.checked : false
            });
            if (myToken !== currentLoadToken) return; // Bá» qua náº¿u cÃ³ request má»›i hÆ¡n
            
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
                signStatus: currentTab,
                allRoles: chkAllRoles ? chkAllRoles.checked : false
            });
            if (myToken !== currentLoadToken) return; // Bá» qua náº¿u cÃ³ request má»›i hÆ¡n
            
            if (data.success && data.data && data.data.data) {
                patientsList = data.data.data;
                // GÃ¡n tÃªn trá»±c tiáº¿p tá»« loáº¡i giáº¥y tá» Ä‘ang chá»n
                for (const p of patientsList) {
                    p.ResolvedDocName = dt.TenGiayTo || dt.TenLoaiBaoCao || 'TÃ i liá»‡u';
                }
                renderTable();
            } else {
                patientsList = [];
                renderTable();
            }
        }
    } catch (err) {
        showToast('Lá»—i táº£i danh sÃ¡ch há»“ sÆ¡', 'error');
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
    
    document.getElementById('page-info').innerText = `Hiá»ƒn thá»‹ ${totalItems > 0 ? startIdx + 1 : 0} - ${Math.min(endIdx, totalItems)}/${totalItems} báº£n ghi`;
    document.getElementById('current-page-num').innerText = currentPage;
    
    if (filteredList.length === 0) {
        docsBody.innerHTML = '<tr><td colspan="8" style="text-align:center">KhÃ´ng cÃ³ tÃ i liá»‡u nÃ o</td></tr>';
        return;
    }
    
    pagedList.forEach((doc, i) => {
        const idx = startIdx + i;
        const tr = document.createElement('tr');
        const statusHtml = currentTab === 0 ? '<span class="status-badge status-pending">ChÆ°a kÃ½</span>' : '<span class="status-badge status-signed">ÄÃ£ kÃ½</span>';
        
        const docIdForAction = doc.DocumentInstance_Id || doc.Document_Id || '';
        
        let actionBtn = currentTab === 0 
            ? `<div style="display: flex; gap: 5px; justify-content: center;">
                 <button class="btn-sign" onclick="openSignPreview('${docIdForAction}')" style="padding: 5px 10px; font-size: 0.8rem;">KÃ½</button>
               </div>`
            : `<div style="display: flex; gap: 5px; justify-content: center;">
                 <button class="btn-secondary" onclick="openPreview('${docIdForAction}')" style="padding: 5px 10px; font-size: 0.8rem;">Xem</button>
                 <button class="btn-cancel" onclick="cancelSignDocument('${docIdForAction}')" style="padding: 5px 10px; font-size: 0.8rem;">Huá»· kÃ½</button>
               </div>`;
            
        let docName = doc.ResolvedDocName || 'TÃ i liá»‡u (KhÃ¡c)';
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
                docName = matchingDoc.TenGiayTo || matchingDoc.TenLoaiBaoCao || 'TÃ i liá»‡u';
                doc.ResolvedDocName = docName;
                doc.ResolvedRoleName = matchingDoc.RoleName;
            }
        }
            
        tr.innerHTML = `
            <td data-label="STT">${idx + 1}</td>
            <td data-label="Bá»‡nh NhÃ¢n"><strong>${doc.TenBenhNhan || ''}</strong></td>
            <td data-label="Loáº¡i Giáº¥y Tá»"><span style="font-size: 0.9em; color: var(--primary); background: rgba(14,165,233,0.1); padding: 4px 8px; border-radius: 6px;">${docName}</span></td>
            <td data-label="NÄƒm Sinh">${doc.NamSinh || doc.Tuoi || ''}</td>
            <td data-label="Giá»›i TÃ­nh">${doc.GioiTinh || ''}</td>
            <td data-label="Sá»‘ TN / Sá»‘ BA">${doc.SoBenhAn || doc.SoVaoVien || doc.MaYTe || doc.BenhAn_Id || doc.TiepNhan_Id || doc.SoTiepNhan || ''}</td>
            <td data-label="Tráº¡ng ThÃ¡i">${statusHtml}</td>
            <td data-label="Thao TÃ¡c" class="td-actions">${actionBtn}</td>
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
    btn.innerHTML = 'Äang xá»­ lÃ½...';
    btn.disabled = true;
    
    try {
        let finalBase64 = currentPdfBase64;
        
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
        console.error('Lá»—i táº£i PDF:', err);
        showToast('CÃ³ lá»—i xáº£y ra khi xá»­ lÃ½ file', 'error');
    }
    
    btn.innerHTML = originalText;
    btn.disabled = false;
});

window.signDocument = async function(docId) {
    document.getElementById('pdf-modal').classList.add('hidden');
    document.body.classList.remove('modal-open');
    
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin tÃ i liá»‡u Ä‘á»ƒ kÃ½', 'error');
        return;
    }
    
    if (loadingTitle) loadingTitle.textContent = 'Äang xá»­ lÃ½ KÃ½...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lÃ²ng kiá»ƒm tra mÃ n hÃ¬nh mÃ¡y tÃ­nh cá»§a báº¡n Ä‘á»ƒ thao tÃ¡c.';
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
            showToast('KÃ½ thÃ nh cÃ´ng!', 'success');
            await new Promise(r => setTimeout(r, 1500));
            await loadDocumentTypes();
        } else {
            showToast(data.message || data?.data?.message || 'Lá»—i kÃ½ sá»‘', 'error');
        }
    } catch(err) {
        showToast('Lá»—i khi kÃ½', 'error');
    }
    loadingOverlay.classList.add('hidden');
}

window.openPreview = async function(docId) {
    await openSignPreview(docId, false);
}

window.cancelSignDocument = async function(docId) {
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('KhÃ´ng tÃ¬m tháº¥y tÃ i liá»‡u', 'error');
        return;
    }
    const docName = doc.Report_Name || doc.Document_Name || 'TÃ i liá»‡u';
    const patientName = doc.TenBenhNhan || 'Bá»‡nh nhÃ¢n';

    showConfirm(`Báº¡n cÃ³ cháº¯c cháº¯n muá»‘n Há»¦Y KÃ <b>${docName}</b> cá»§a bá»‡nh nhÃ¢n <b>${patientName}</b>?`, async () => {
        if (loadingTitle) loadingTitle.textContent = 'Äang xá»­ lÃ½ Há»§y kÃ½...';
        if (loadingDesc) loadingDesc.textContent = 'Vui lÃ²ng chá» trong giÃ¢y lÃ¡t.';
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
                showToast('ÄÃ£ há»§y kÃ½ thÃ nh cÃ´ng!', 'success');
                await new Promise(r => setTimeout(r, 1500));
                await loadDocumentTypes();
            } else {
                showToast(data.message || data?.data?.message || 'Lá»—i khi há»§y kÃ½', 'error');
            }
        } catch (err) {
            showToast('Lá»—i há»‡ thá»‘ng khi há»§y kÃ½', 'error');
        }
        loadingOverlay.classList.add('hidden');
    }, 'XÃ¡c nháº­n Há»§y kÃ½', 'Há»§y kÃ½');
}

async function applyWatermark(base64) {
    if (!window.PDFLib) return base64;
    try {
        const { PDFDocument, rgb, degrees } = window.PDFLib;
        const pdfDoc = await PDFDocument.load(base64);
        const pages = pdfDoc.getPages();
        
        let fullnameRaw = currentUser?.name || 'User';
        let usernameRaw = currentUser?.username || currentUser?.uid || currentUser?.id || currentUser?.nhanVienId || 'Unknown';
        
        const removeAccents = (str) => {
            if(!str) return '';
            return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/Ä‘/g, 'd').replace(/Ä/g, 'D');
        };
        
        let fullname = removeAccents(String(fullnameRaw));
        let username = removeAccents(String(usernameRaw));
        
        const now = new Date();
        const timeStr = `${String(now.getDate()).padStart(2,'0')}/${String(now.getMonth()+1).padStart(2,'0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
        const watermarkText = `${fullname}_${username}_${timeStr}`;
        
        for (const page of pages) {
            const { width, height } = page.getSize();
            // Spread watermarks evenly across the page
            for (let x = 30; x < width; x += 250) {
                for (let y = 30; y < height; y += 250) {
                    page.drawText(watermarkText, {
                        x: x,
                        y: y,
                        size: 16,
                        color: rgb(0.6, 0.6, 0.6),
                        opacity: 0.2,
                        rotate: degrees(45)
                    });
                }
            }
        }
        return await pdfDoc.saveAsBase64({ dataUri: false });
    } catch (e) {
        console.error('Lá»—i táº¡o watermark:', e);
        return base64;
    }
}

window.openSignPreview = async function(docId, isSigning = true) {
    const doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) {
        showToast('KhÃ´ng tÃ¬m tháº¥y tÃ i liá»‡u', 'error');
        return;
    }
    const docName = doc.Report_Name || doc.Document_Name || 'TÃ i liá»‡u';
    
    if (loadingTitle) loadingTitle.textContent = 'Äang táº£i báº£n xem trÆ°á»›c...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lÃ²ng chá» trong giÃ¢y lÃ¡t.';
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
                container.innerHTML = '<div style="padding: 20px; text-align: center;">Äang xá»­ lÃ½ PDF...</div>';
                
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
                    container.innerHTML = '<div style="color:red; padding: 20px; text-align: center;">Lá»—i hiá»ƒn thá»‹ PDF</div>';
                });
            } else {
                // Fallback if pdf.js fails to load
                container.style.display = 'none';
                viewer.style.display = 'block';
                viewer.src = 'data:application/pdf;base64,' + currentPdfBase64 + '#toolbar=0';
            }
            
            // Hiá»‡n modal
            document.getElementById('pdf-modal').classList.remove('hidden');
            document.body.classList.add('modal-open');
            
            // Xử lý nút Ký số & Hủy ký
            const btnSign = document.getElementById('btn-pdf-sign');
            const btnCancelSign = document.getElementById('btn-pdf-cancel-sign');
            const btnSignpad = document.getElementById('btn-pdf-signpad');
            
            if(btnSignpad) btnSignpad.style.display = 'none';
            
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
            showToast(data?.data?.message || 'KhÃ´ng thá»ƒ xem trÆ°á»›c tÃ i liá»‡u', 'error');
        }
    } catch (err) {
        showToast('Lá»—i khi táº£i file xem trÆ°á»›c', 'error');
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

// Duplicates removed
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
const btnSearch = document.getElementById('btn-search');

if(gridSearch) {
    gridSearch.addEventListener('input', () => {
        if(btnClearSearch) btnClearSearch.style.display = gridSearch.value ? 'block' : 'none';
    });
    gridSearch.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            currentPage = 1;
            loadDocumentTypes();
        }
    });
}
if(btnClearSearch) {
    btnClearSearch.addEventListener('click', () => {
        if(gridSearch) gridSearch.value = '';
        btnClearSearch.style.display = 'none';
        currentPage = 1;
        loadDocumentTypes();
    });
}
if(btnSearch) {
    btnSearch.addEventListener('click', () => {
        currentPage = 1;
        loadDocumentTypes();
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

// Config Modal Logic
const configModal = document.getElementById('config-modal');
const configAlert = document.getElementById('config-alert');

async function openConfigModal() {
    if (configModal) configModal.classList.remove('hidden');
    configAlert.classList.add('hidden');
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (data.success && data.data) {
            document.getElementById('cfg-url').value = data.data.url || '';
            document.getElementById('cfg-fallbackUrl').value = data.data.fallbackUrl || '';
            document.getElementById('cfg-maTruong').value = data.data.maTruong || '';
            document.getElementById('cfg-username').value = data.data.username || '';
            document.getElementById('cfg-password').value = data.data.password || '';
        } else {
            showConfigAlert(data.message || 'KhÃ´ng thá»ƒ táº£i cáº¥u hÃ¬nh', 'error');
        }
    } catch (err) {
        console.error(err);
        showConfigAlert('Lá»—i káº¿t ná»‘i tá»›i mÃ¡y chá»§', 'error');
    }
}

function closeConfigModal() {
    if (configModal) configModal.classList.add('hidden');
}

function showConfigAlert(message, type) {
    configAlert.textContent = message;
    configAlert.className = `alert ${type}`;
    configAlert.classList.remove('hidden');
    setTimeout(() => {
        configAlert.classList.add('hidden');
    }, 5000);
}

document.getElementById('btn-close-config')?.addEventListener('click', closeConfigModal);
document.getElementById('btn-config-cancel')?.addEventListener('click', closeConfigModal);

document.getElementById('configFormModal')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSave = document.getElementById('btn-config-save');
    btnSave.disabled = true;
    btnSave.textContent = 'Äang lÆ°u...';
    
    const configData = {
        url: document.getElementById('cfg-url').value,
        fallbackUrl: document.getElementById('cfg-fallbackUrl').value,
        maTruong: document.getElementById('cfg-maTruong').value,
        username: document.getElementById('cfg-username').value,
        password: document.getElementById('cfg-password').value
    };

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeConfigModal();
        } else {
            showConfigAlert(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showConfigAlert('Lá»—i káº¿t ná»‘i tá»›i mÃ¡y chá»§', 'error');
    } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'LÆ°u Cáº¥u HÃ¬nh';
    }
});

document.getElementById('btn-test-sms')?.addEventListener('click', () => {
    showPrompt('Kiá»ƒm tra SMS', 'Nháº­p sá»‘ Ä‘iá»‡n thoáº¡i (VD: 098... hoáº·c 8498...):', async (phone, setError) => {
        if (!phone) {
            return setError('Vui lÃ²ng nháº­p sá»‘ Ä‘iá»‡n thoáº¡i');
        }
        
        const btnTest = document.getElementById('btn-test-sms');
        const oldText = btnTest.textContent;
        btnTest.disabled = true;
        btnTest.textContent = 'Äang gá»­i...';

        let captchaToken = '';
        if (window.turnstileRequired && window.turnstileTestWidgetId !== null && window.turnstile) {
            try {
                captchaToken = turnstile.getResponse(window.turnstileTestWidgetId);
                if (!captchaToken) {
                    btnTest.disabled = false;
                    btnTest.textContent = oldText;
                    return setError('Vui lÃ²ng xÃ¡c nháº­n Captcha trÆ°á»›c khi Test SMS!');
                }
            } catch (e) {}
        }

        const configData = {
            url: document.getElementById('cfg-url').value,
            fallbackUrl: document.getElementById('cfg-fallbackUrl').value,
            maTruong: document.getElementById('cfg-maTruong').value,
            username: document.getElementById('cfg-username').value,
            password: document.getElementById('cfg-password').value,
            phone: phone,
            captchaToken: captchaToken
        };

        try {
            const res = await fetch('/api/test-sms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(configData)
            });
            const data = await res.json();
            
            if (data.success) {
                showToast('Gá»­i tin nháº¯n test thÃ nh cÃ´ng!', 'success');
                setError(null);
                setError(data.message || 'Lá»—i gá»­i tin nháº¯n');
            }
            if (window.turnstileRequired && window.turnstileTestWidgetId !== null && window.turnstile) {
                turnstile.reset(window.turnstileTestWidgetId);
            }
        } catch (err) {
            setError('Lá»—i káº¿t ná»‘i tá»›i mÃ¡y chá»§');
        } finally {
            btnTest.disabled = false;
            btnTest.textContent = oldText;
        }
    }, 'text', 'Nháº­p SÄT táº¡i Ä‘Ã¢y...');
});

// Config Login Modal Logic
const configLoginModal = document.getElementById('config-login-modal');

async function openConfigLoginModal() {
    if (configLoginModal) {
        configLoginModal.classList.remove('hidden');
        try {
            const res = await fetch('/api/config-login');
            const data = await res.json();
            if (data.success && data.data) {
                document.getElementById('cfg-enableOtp').checked = !!data.data.enableOtp;
                const elGroup = document.getElementById('cfg-enableGroupLogin');
                if (elGroup) elGroup.checked = !!data.data.enableGroupLogin;
                const elDomain = document.getElementById('cfg-internetDomain');
                if (elDomain) elDomain.value = data.data.internetDomain || '';
            }
        } catch (err) {
            console.error(err);
        }
    }
}

function closeConfigLoginModal() {
    if (configLoginModal) {
        configLoginModal.classList.add('hidden');
    }
}

document.getElementById('config-login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSave = e.target.querySelector('button[type="submit"]');
    if(btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Äang lÆ°u...';
    }
    
    const configData = {
        enableOtp: document.getElementById('cfg-enableOtp').checked,
        enableGroupLogin: document.getElementById('cfg-enableGroupLogin') ? document.getElementById('cfg-enableGroupLogin').checked : false,
        internetDomain: document.getElementById('cfg-internetDomain') ? document.getElementById('cfg-internetDomain').value : ''
    };

    try {
        const res = await fetch('/api/config-login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        const data = await res.json();

        if (data.success) {
            showToast(data.message, 'success');
            closeConfigLoginModal();
        } else {
            showToast(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showToast('Lá»—i káº¿t ná»‘i tá»›i mÃ¡y chá»§', 'error');
    } finally {
        if(btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'LÆ°u Cáº¥u HÃ¬nh';
        }
    }
});

// --- Turnstile Config Logic ---
const turnstileModal = document.getElementById('turnstile-modal');
const turnstileAlert = document.getElementById('turnstile-alert');

function openTurnstileModal() {
    if (turnstileModal) {
        turnstileModal.classList.remove('hidden');
        turnstileAlert.classList.add('hidden');
        
        fetch('/api/turnstile-config')
            .then(res => res.json())
            .then(data => {
                if(data.success && data.data) {
                    document.getElementById('cfg-turnstile-enabled').checked = data.data.enabled;
                    document.getElementById('cfg-turnstile-sitekey').value = data.data.siteKey || '';
                    document.getElementById('cfg-turnstile-secretkey').value = data.data.secretKey || '';
                }
            })
            .catch(err => console.error(err));
    }
}

document.getElementById('btn-close-turnstile')?.addEventListener('click', () => {
    turnstileModal?.classList.add('hidden');
});

document.getElementById('configTurnstileForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSave = e.target.querySelector('button[type="submit"]');
    if(btnSave) {
        btnSave.disabled = true;
        btnSave.textContent = 'Äang lÆ°u...';
    }
    
    const configData = {
        enabled: document.getElementById('cfg-turnstile-enabled').checked,
        siteKey: document.getElementById('cfg-turnstile-sitekey').value,
        secretKey: document.getElementById('cfg-turnstile-secretkey').value
    };

    try {
        const res = await fetch('/api/turnstile-config', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configData)
        });
        const data = await res.json();
        if (data.success) {
            turnstileAlert.className = 'alert alert-success';
            turnstileAlert.textContent = data.message + ' (Táº£i láº¡i trang Ä‘á»ƒ Ã¡p dá»¥ng)';
            turnstileAlert.classList.remove('hidden');
        } else {
            turnstileAlert.className = 'alert alert-error';
            turnstileAlert.textContent = data.message;
            turnstileAlert.classList.remove('hidden');
        }
    } catch (err) {
        turnstileAlert.className = 'alert alert-error';
        turnstileAlert.textContent = 'Lá»—i káº¿t ná»‘i tá»›i mÃ¡y chá»§';
        turnstileAlert.classList.remove('hidden');
    } finally {
        if(btnSave) {
            btnSave.disabled = false;
            btnSave.textContent = 'LÆ°u Cáº¥u HÃ¬nh';
        }
    }
});

// --- App Initialization (Turnstile Bootstrap) ---
window.appConfig = { turnstileEnabled: false, siteKey: '', isInternal: false };
window.turnstileRequired = false;
window.turnstileWidgetId = null;
window.turnstileTestWidgetId = null;

async function initApp() {
    try {
        const res = await fetch('/api/app-status');
        const data = await res.json();
        if (data.success) {
            window.appConfig = data.data;
            if (window.appConfig.turnstileEnabled && !window.appConfig.isInternal && window.appConfig.siteKey) {
                window.turnstileRequired = true;
                
                // Add Turnstile container for Test SMS in Config Modal
                const testSmsForm = document.getElementById('configFormModal');
                if (testSmsForm) {
                    const testContainer = document.createElement('div');
                    testContainer.id = 'turnstile-test-container';
                    testContainer.style.display = 'flex';
                    testContainer.style.justifyContent = 'center';
                    testContainer.style.marginBottom = '10px';
                    // Insert before the form buttons
                    testSmsForm.insertBefore(testContainer, testSmsForm.lastElementChild);
                }

                // Load Cloudflare Script
                const script = document.createElement('script');
                script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    if (window.turnstile) {
                        window.turnstileWidgetId = turnstile.render('#turnstile-container', {
                            sitekey: window.appConfig.siteKey,
                            theme: 'light'
                        });
                        
                        const testEl = document.getElementById('turnstile-test-container');
                        if (testEl) {
                            window.turnstileTestWidgetId = turnstile.render('#turnstile-test-container', {
                                sitekey: window.appConfig.siteKey,
                                theme: 'light'
                            });
                        }
                    }
                };
                document.head.appendChild(script);
            }
        }
    } catch (e) {
        console.error('Failed to load app config', e);
    }
}
initApp();

// ÄÃ³ng dropdown menu cá»§a Admin khi click ra ngoÃ i
document.addEventListener('click', function(event) {
    const dropdown = document.getElementById('admin-dropdown-menu');
    const button = document.getElementById('btn-admin-dropdown');
    if (dropdown && dropdown.classList.contains('show')) {
        if (!dropdown.contains(event.target) && (!button || !button.contains(event.target))) {
            dropdown.classList.remove('show');
        }
    }
});

// ==========================================
// SIGNPAD CANVAS LOGIC
// ==========================================
let signaturePadContext = null;
let signatureCanvas = null;
let isDrawingSignature = false;
let currentSignDocId = null;

function initSignpad() {
    signatureCanvas = document.getElementById('signature-canvas');
    if (!signatureCanvas) return;
    
    // Setup high resolution canvas for crisp drawing
    const rect = signatureCanvas.parentElement.getBoundingClientRect();
    signatureCanvas.width = rect.width * 2;
    signatureCanvas.height = rect.height * 2;
    signatureCanvas.style.width = rect.width + 'px';
    signatureCanvas.style.height = rect.height + 'px';
    
    signaturePadContext = signatureCanvas.getContext('2d');
    signaturePadContext.scale(2, 2);
    signaturePadContext.lineCap = 'round';
    signaturePadContext.lineJoin = 'round';
    signaturePadContext.lineWidth = 3;
    signaturePadContext.strokeStyle = '#000000';

    const getPos = (e) => {
        const rect = signatureCanvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return {
            x: clientX - rect.left,
            y: clientY - rect.top
        };
    };

    const startDraw = (e) => {
        e.preventDefault();
        isDrawingSignature = true;
        const pos = getPos(e);
        signaturePadContext.beginPath();
        signaturePadContext.moveTo(pos.x, pos.y);
        document.getElementById('signpad-placeholder').style.display = 'none';
    };

    const draw = (e) => {
        if (!isDrawingSignature) return;
        e.preventDefault();
        const pos = getPos(e);
        signaturePadContext.lineTo(pos.x, pos.y);
        signaturePadContext.stroke();
    };

    const endDraw = (e) => {
        if (!isDrawingSignature) return;
        e.preventDefault();
        isDrawingSignature = false;
    };

    signatureCanvas.addEventListener('mousemove', draw);
    signatureCanvas.addEventListener('mouseup', endDraw);
    signatureCanvas.addEventListener('mouseout', endDraw);

    signatureCanvas.addEventListener('touchstart', startDraw, { passive: false });
    signatureCanvas.addEventListener('touchmove', draw, { passive: false });
    signatureCanvas.addEventListener('touchend', endDraw, { passive: false });
    
    document.getElementById('btn-close-signpad').addEventListener('click', closeSignpad);
    document.getElementById('btn-cancel-signpad').addEventListener('click', closeSignpad);
    document.getElementById('btn-clear-signpad').addEventListener('click', clearSignpad);
    document.getElementById('btn-confirm-signpad').addEventListener('click', confirmSignpad);
}

function clearSignpad() {
    if(!signaturePadContext) return;
    const rect = signatureCanvas.getBoundingClientRect();
    signaturePadContext.clearRect(0, 0, rect.width, rect.height);
    document.getElementById('signpad-placeholder').style.display = 'block';
}

function closeSignpad() {
    document.getElementById('signpad-modal').classList.add('hidden');
}

window.openSignpad = function(docId) {
    currentSignDocId = docId;
    document.getElementById('signpad-modal').classList.remove('hidden');
    setTimeout(() => {
        if (!signaturePadContext) {
            initSignpad();
        }
        clearSignpad();
    }, 50);
};

async function confirmSignpad() {
    const isBlank = document.getElementById('signpad-placeholder').style.display !== 'none';
    if (isBlank) {
        showToast('Vui lòng vẽ chữ ký trước khi xác nhận!', 'error');
        return;
    }
    
    const base64Data = signatureCanvas.toDataURL('image/png');
    closeSignpad();
    
    let doc = patientsList.find(d => (d.DocumentInstance_Id || d.Document_Id) == currentSignDocId);
    if (!doc && typeof currentPatientDocs !== 'undefined') {
        doc = currentPatientDocs.find(d => (d.DocumentInstance_Id || d.Document_Id) == currentSignDocId);
    }
    if (!doc) {
        showToast('KhÃ´ng tÃ¬m tháº¥y thÃ´ng tin tÃ i liá»‡u', 'error');
        return;
    }
    
    if (loadingTitle) loadingTitle.textContent = 'Äang xá»­ lÃ½ KÃ½...';
    if (loadingDesc) loadingDesc.textContent = 'Äang Ä‘áº©y chá»¯ kÃ½ cá»§a báº¡n vÃ o vÄƒn báº£n, vui lÃ²ng Ä‘á»£i.';
    loadingOverlay.classList.remove('hidden');
    document.getElementById('pdf-modal').classList.add('hidden'); 
    
    try {
        const data = await callAgent('sign-document-pad', {
            documentId: doc.Document_Id,
            roleName: 'BenhNhan',
            filePath: doc.File_Path || '',
            reportCode: doc.Report_Code || '',
            reportParameter: doc.ReportParameter || '',
            imageBase64: base64Data
        });
        
        if (data.success && data.data && data.data.ok) {
            showToast('KÃ½ trá»±c tiáº¿p thÃ nh cÃ´ng!', 'success');
            await new Promise(r => setTimeout(r, 1500));
            await loadDocumentTypes();
        } else {
            showToast(data?.data?.message || 'Lá»—i khi kÃ½ vÄƒn báº£n', 'error');
        }
    } catch (err) {
        showToast('Lá»—i káº¿t ná»‘i khi kÃ½', 'error');
    }
    loadingOverlay.classList.add('hidden');
}




// ==========================================
// TABS & PATIENT SIGNING LOGIC
// ==========================================
let currentMainTab = 'nhan-vien';
let currentPatientDocs = [];

window.switchMainTab = function(tabName) {
    currentMainTab = tabName;
    document.querySelectorAll('.main-tab-btn').forEach(b => {
        if(b.dataset.mainTab === tabName) {
            b.classList.add('active');
            b.style.background = tabName === 'nhan-vien' ? 'var(--primary-color)' : 'var(--primary-color)';
            b.style.color = 'white';
        } else {
            b.classList.remove('active');
            b.style.background = 'transparent';
            b.style.color = 'var(--text-main)';
        }
    });
    
    document.querySelectorAll('.main-tab-content').forEach(c => {
        if(c.id === `tab-${tabName}`) {
            c.style.display = 'flex';
            c.classList.add('active');
        } else {
            c.style.display = 'none';
            c.classList.remove('active');
        }
    });
    
    // Auto focus search input when switching to patient tab
    if(tabName === 'benh-nhan') {
        const input = document.getElementById('patient-code-input');
        if(input) input.focus();
    }
};

window.searchPatientDocuments = async function() {
    const input = document.getElementById('patient-code-input');
    const code = input ? input.value.trim() : '';
    if(!code) {
        showToast('Vui lÃ²ng nháº­p MÃ£ Y Táº¿ / Sá»‘ há»“ sÆ¡ / Sá»‘ tiáº¿p nháº­n', 'error');
        return;
    }
    
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingDesc = document.getElementById('loading-desc');
    
    if (loadingTitle) loadingTitle.textContent = 'Äang tÃ¬m kiáº¿m...';
    if (loadingDesc) loadingDesc.textContent = 'Äang táº£i danh sÃ¡ch há»“ sÆ¡ chá» kÃ½ cá»§a bá»‡nh nhÃ¢n.';
    loadingOverlay.classList.remove('hidden');
    
    try {
        const res = await callAgent('get-patient-documents', { patientCode: code });
        if (res.success && res.data) {
            currentPatientDocs = res.data;
            renderPatientDocuments();
            if(currentPatientDocs.length === 0) {
                showToast('KhÃ´ng tÃ¬m tháº¥y tÃ i liá»‡u nÃ o chá» kÃ½ cho bá»‡nh nhÃ¢n nÃ y', 'info');
            } else {
                showToast(`TÃ¬m tháº¥y ${currentPatientDocs.length} tÃ i liá»‡u chá» kÃ½`, 'success');
            }
        } else {
            showToast(res.error || 'Lá»—i khi láº¥y danh sÃ¡ch tÃ i liá»‡u', 'error');
            currentPatientDocs = [];
            renderPatientDocuments();
        }
    } catch (err) {
        showToast('Lá»—i káº¿t ná»‘i Server', 'error');
        currentPatientDocs = [];
        renderPatientDocuments();
    }
    
    loadingOverlay.classList.add('hidden');
};

// Add Enter key listener to search input
setTimeout(() => {
    const input = document.getElementById('patient-code-input');
    if(input) {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchPatientDocuments();
            }
        });
    }
}, 1000);

window.renderPatientDocuments = function() {
    const tbody = document.getElementById('patient-documents-body');
    if(!tbody) return;
    
    if(currentPatientDocs.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; padding: 30px; color: var(--text-muted);">KhÃ´ng cÃ³ tÃ i liá»‡u nÃ o chá» kÃ½.</td></tr>`;
        return;
    }
    
    let html = '';
    currentPatientDocs.forEach(doc => {
        html += `
            <tr style="border-bottom: 1px solid var(--glass-border); transition: background 0.2s;">
                <td style="padding: 15px;">
                    <div style="font-weight: 600; color: var(--text-main); margin-bottom: 5px;">${doc.ResolvedDocName || 'TÃ i liá»‡u'}</div>
                    <div style="font-size: 0.85rem; color: var(--text-muted);">
                        ${doc.File_Path ? doc.File_Path.split('\\').pop() : ''}
                    </div>
                </td>
                <td style="padding: 15px; color: var(--text-muted);">
                    <span class="status-badge" style="background: rgba(239, 154, 154, 0.2); color: #c62828;">Chá» kÃ½</span>
                </td>
                <td style="padding: 15px; text-align: right;">
                    <button class="btn-primary" onclick="window.previewPatientFile(${doc.Document_Id || doc.DocumentInstance_Id})" style="padding: 8px 16px; font-size: 0.9rem; border-radius: 6px;">
                        Tiáº¿n hÃ nh kÃ½
                    </button>
                </td>
            </tr>
        `;
    });
    tbody.innerHTML = html;
};

window.previewPatientFile = async function(docId) {
    const doc = currentPatientDocs.find(d => (d.DocumentInstance_Id || d.Document_Id) == docId);
    if (!doc) return;
    
    const docName = doc.ResolvedDocName || 'TÃ i liá»‡u';
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingTitle = document.getElementById('loading-title');
    const loadingDesc = document.getElementById('loading-desc');
    
    if (loadingTitle) loadingTitle.textContent = 'Äang táº£i báº£n xem trÆ°á»›c...';
    if (loadingDesc) loadingDesc.textContent = 'Vui lÃ²ng chá» trong giÃ¢y lÃ¡t.';
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
            
            const uint8Array = base64ToUint8Array(currentPdfBase64);
            const loadingTask = pdfjsLib.getDocument({ data: uint8Array });
            
            loadingTask.promise.then(function(pdf) {
                currentPdfDoc = pdf;
                document.getElementById('pdf-modal').classList.remove('hidden');
                document.body.classList.add('modal-open');
                
                // Show ONLY Bá»‡nh nhÃ¢n kÃ½ btn
                const btnSign = document.getElementById('btn-pdf-sign');
                const btnCancelSign = document.getElementById('btn-pdf-cancel-sign');
                const btnSignpad = document.getElementById('btn-pdf-signpad');
                
                if (btnSign) btnSign.style.display = 'none';
                if (btnCancelSign) btnCancelSign.style.display = 'none';
                if (btnSignpad) {
                    btnSignpad.style.display = 'block';
                    btnSignpad.onclick = () => window.openSignpad(docId);
                }
                
                renderPdfPage(1);
            }).catch(function(error) {
                showToast('Lá»—i khi táº£i PDF: ' + error.message, 'error');
            });
        } else {
            showToast(data?.data?.message || 'KhÃ´ng thá»ƒ xem trÆ°á»›c tÃ i liá»‡u', 'error');
        }
    } catch (err) {
        showToast('Lá»—i káº¿t ná»‘i Server', 'error');
    }
    
    loadingOverlay.classList.add('hidden');
};

