document.addEventListener('DOMContentLoaded', () => {
    fetchConfig();

    document.getElementById('configForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await saveConfig();
    });
});

function togglePassword() {
    const pwd = document.getElementById('password');
    const btn = document.querySelector('.toggle-password');
    if (pwd.type === 'password') {
        pwd.type = 'text';
        btn.textContent = 'Ẩn';
    } else {
        pwd.type = 'password';
        btn.textContent = 'Hiện';
    }
}

function showAlert(message, type) {
    const alertBox = document.getElementById('alertBox');
    alertBox.textContent = message;
    alertBox.className = `alert ${type}`;
    
    // Auto hide after 5 seconds
    setTimeout(() => {
        alertBox.className = 'alert';
    }, 5000);
}

function setLoading(isLoading) {
    const btn = document.getElementById('submitBtn');
    const spinner = document.getElementById('spinner');
    const btnText = document.getElementById('btnText');
    
    if (isLoading) {
        btn.disabled = true;
        spinner.style.display = 'inline-block';
        btnText.textContent = 'Đang lưu...';
    } else {
        btn.disabled = false;
        spinner.style.display = 'none';
        btnText.textContent = 'Lưu Cấu Hình';
    }
}

async function fetchConfig() {
    try {
        const res = await fetch('/api/config');
        const data = await res.json();
        
        if (data.success && data.data) {
            document.getElementById('url').value = data.data.url || '';
            document.getElementById('fallbackUrl').value = data.data.fallbackUrl || '';
            document.getElementById('maTruong').value = data.data.maTruong || '';
            document.getElementById('companyCode').value = data.data.companyCode || '';
            document.getElementById('username').value = data.data.username || '';
            document.getElementById('password').value = data.data.password || '';
            document.getElementById('smsType').value = data.data.smsType || 1;
        } else {
            showAlert(data.message || 'Không thể tải cấu hình', 'error');
        }
    } catch (err) {
        console.error(err);
        showAlert('Lỗi kết nối tới máy chủ', 'error');
    }
}

async function saveConfig() {
    setLoading(true);
    const configData = {
        url: document.getElementById('url').value,
        fallbackUrl: document.getElementById('fallbackUrl').value,
        maTruong: document.getElementById('maTruong').value,
        companyCode: document.getElementById('companyCode').value,
        username: document.getElementById('username').value,
        password: document.getElementById('password').value,
        smsType: parseInt(document.getElementById('smsType').value) || 1
    };

    try {
        const res = await fetch('/api/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(configData)
        });
        const data = await res.json();

        if (data.success) {
            showAlert(data.message, 'success');
        } else {
            showAlert(data.message, 'error');
        }
    } catch (err) {
        console.error(err);
        showAlert('Lỗi kết nối tới máy chủ', 'error');
    } finally {
        setLoading(false);
    }
}
