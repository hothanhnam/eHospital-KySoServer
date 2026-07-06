const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');
const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

// --- Encryption Utilities ---
const ENCRYPTION_KEY = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'vinhduc_netplus_secret', 'salt', 32);
const IV_LENGTH = 16;
const CONFIG_FILE = path.join(__dirname, 'netplus_config.dat');
const TURNSTILE_CONFIG_FILE = path.join(__dirname, 'turnstile_config.dat');

function encrypt(text) {
    let iv = crypto.randomBytes(IV_LENGTH);
    let cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text) {
    try {
        let textParts = text.split(':');
        let iv = Buffer.from(textParts.shift(), 'hex');
        let encryptedText = Buffer.from(textParts.join(':'), 'hex');
        let decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
        let decrypted = decipher.update(encryptedText);
        decrypted = Buffer.concat([decrypted, decipher.final()]);
        return decrypted.toString();
    } catch (e) {
        return null;
    }
}

const TRUSTED_DEVICES_FILE = path.join(__dirname, 'trusted_devices.dat');
const otpStore = new Map();
const otpRateLimit = new Map();

function getTrustedDevices() {
    try {
        if (fs.existsSync(TRUSTED_DEVICES_FILE)) {
            const encryptedData = fs.readFileSync(TRUSTED_DEVICES_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            if (decryptedData) return JSON.parse(decryptedData);
        }
    } catch (e) {
        console.error('Error reading trusted devices:', e);
    }
    return {};
}

function saveTrustedDevices(devices) {
    try {
        const encryptedData = encrypt(JSON.stringify(devices));
        fs.writeFileSync(TRUSTED_DEVICES_FILE, encryptedData, 'utf8');
    } catch (e) {
        console.error('Error saving trusted devices:', e);
    }
}

function isDeviceTrusted(username, deviceToken) {
    if (!deviceToken) return false;
    const devices = getTrustedDevices();
    const userDevices = devices[username] || [];
    const hash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    return userDevices.includes(hash);
}

function addTrustedDevice(username) {
    const devices = getTrustedDevices();
    if (!devices[username]) devices[username] = [];
    const newToken = crypto.randomBytes(32).toString('hex');
    const hash = crypto.createHash('sha256').update(newToken).digest('hex');
    devices[username].push(hash);
    saveTrustedDevices(devices);
    return newToken;
}

// Function to send SMS via NetPlus
async function sendNetPlusSMS(phone, messageContent) {
    if (!fs.existsSync(CONFIG_FILE)) throw new Error('Chưa cấu hình NetPlus SMS.');
    const configData = JSON.parse(decrypt(fs.readFileSync(CONFIG_FILE, 'utf8')));
    const { url, maTruong, username, password } = configData;
    if (!url || !maTruong || !username || !password) throw new Error('Cấu hình NetPlus SMS chưa đầy đủ.');

    const validPhone = formatAndValidateVNPhone(phone);
    if (!validPhone) throw new Error('Số điện thoại không hợp lệ.');

    const httpModule = url.startsWith('https') ? require('https') : require('http');
    const parsedUrl = new URL(url);

    const makeRequest = (options, postData) => new Promise((resolve, reject) => {
        const req = httpModule.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        });
        req.on('error', reject);
        req.write(postData);
        req.end();
    });

    const loginXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Login xmlns="http://tempuri.org/">
      <maTruong>${maTruong}</maTruong>
      <userName>${username}</userName>
      <password>${password}</password>
    </Login>
  </soap:Body>
</soap:Envelope>`;

    const loginOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '"http://tempuri.org/Login"',
            'Content-Length': Buffer.byteLength(loginXml)
        }
    };

    const loginRes = await makeRequest(loginOptions, loginXml);
    const loginMatch = loginRes.match(/<LoginResult>(\d+)<\/LoginResult>/);
    if (!loginMatch || parseInt(loginMatch[1]) <= 0) {
        throw new Error('Đăng nhập API NetPlus thất bại!');
    }
    
    const smsXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SendSMS xmlns="http://tempuri.org/">
      <aSMS_Input>
        <SmsType>1</SmsType>
        <IdCustomerSent>${loginMatch[1]}</IdCustomerSent>
        <CompanyCode>${maTruong}</CompanyCode>
        <Mobile>${validPhone}</Mobile>
        <SMSContent>${removeVietnameseTones(messageContent)}</SMSContent>
      </aSMS_Input>
      <userName>${username}</userName>
      <password>${password}</password>
    </SendSMS>
  </soap:Body>
</soap:Envelope>`;

    const smsOptions = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname,
        method: 'POST',
        headers: {
            'Content-Type': 'text/xml; charset=utf-8',
            'SOAPAction': '"http://tempuri.org/SendSMS"',
            'Content-Length': Buffer.byteLength(smsXml)
        }
    };

    const sendRes = await makeRequest(smsOptions, smsXml);
    if (!sendRes.includes('<SendSMSResult>true</SendSMSResult>')) {
        throw new Error('NetPlus trả về False khi gửi tin nhắn.');
    }
    return true;
}

// Check if request is from internal network
function isInternalRequest(req) {
    // Lấy IP thật của client (hỗ trợ proxy, Cloudflare)
    const forwardedIps = req.headers['cf-connecting-ip'] || req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';
    const ip = forwardedIps.split(',')[0].trim(); 
    
    const hostHeader = req.hostname || req.headers['host'] || '';
    const hostname = hostHeader.split(':')[0]; // Bỏ port nếu có
    
    // Nếu truy cập bằng tên miền vinhduchospital.com -> LUÔN bắt buộc xác thực (Không tính là nội bộ)
    if (hostname.includes('vinhduchospital.com')) {
        return false;
    }
    
    // Check internal domains
    if (hostname.includes('bvvinhduc.com') || hostname === 'localhost') {
        return true;
    }
    
    // Check internal IPs (IPv4 & IPv6 mapped)
    const isLocal = ip === '127.0.0.1' || ip === '::1' || ip.includes('::ffff:127.0.0.1');
    const is192 = ip.startsWith('192.168.') || ip.includes('::ffff:192.168.');
    const is10 = ip.startsWith('10.') || ip.includes('::ffff:10.');
    const is172 = ip.match(/^(::ffff:)?172\.(1[6-9]|2[0-9]|3[0-1])\./);
    
    return isLocal || is192 || is10 || is172;
}

// Cloudflare Turnstile Verification
async function verifyTurnstile(token, secretKey) {
    if (!token) return false;
    return new Promise((resolve) => {
        try {
            const https = require('https');
            const data = new URLSearchParams({
                secret: secretKey,
                response: token
            }).toString();

            const options = {
                hostname: 'challenges.cloudflare.com',
                port: 443,
                path: '/turnstile/v0/siteverify',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = https.request(options, (res) => {
                let responseBody = '';
                res.on('data', (chunk) => { responseBody += chunk; });
                res.on('end', () => {
                    try {
                        const json = JSON.parse(responseBody);
                        resolve(json.success === true);
                    } catch (e) {
                        resolve(false);
                    }
                });
            });

            req.on('error', (error) => {
                console.error('Turnstile verification error:', error);
                resolve(false);
            });

            req.write(data);
            req.end();
        } catch (error) {
            console.error('Turnstile exception:', error);
            resolve(false);
        }
    });
}
// -----------------------------

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });

// Store connected agents
const connectedAgents = new Map();

// SSE Clients
const webClients = new Set();

function broadcastAgentUpdate() {
    for (let client of webClients) {
        try {
            client.write(`event: agents_update\n`);
            client.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);
        } catch (e) {
            webClients.delete(client);
        }
    }
}

wss.on('connection', (ws, req) => {
    console.log(`[WS] New connection from ${req.socket.remoteAddress}`);
    let currentAgentId = null;
    
    ws.isAlive = true;
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log(`[WS] Received:`, data);

            // Registration packet from SignCoreVD
            if (data.agentId && data.nonce) {
                currentAgentId = data.agentId;
                connectedAgents.set(currentAgentId, ws);
                console.log(`[WS] Agent Registered: ${currentAgentId}`);
                
                // Send ACK back
                ws.send(JSON.stringify({ type: 'ACK', status: 'REGISTERED', agentId: currentAgentId }));
                
                // Notify Web
                broadcastAgentUpdate();
            }

            // Handle ACK from Agent
            if (data.type && data.type.endsWith('-ack') && data.reqId) {
                const pending = pendingRequests.get(data.reqId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    pendingRequests.delete(data.reqId);
                    
                    if (data.type === 'legacy-login-ack') {
                        if (data.ok) {
                            (async () => {
                                const reqBody = pending.reqBody || {};
                                const username = data.data?.userCode;
                                
                                const loginResponse = {
                                    success: true,
                                    user: { 
                                        id: data.data?.loginUserId, 
                                        uid: data.uid,
                                        username: username, 
                                        name: data.data?.userName, 
                                        role: 'doctor',
                                        isAdmin: data.data?.isAdmin,
                                        isKySoTuXa: data.data?.isKySoTuXa,
                                        activeAgentId: pending.agentId,
                                        soDienThoai: data.data?.soDienThoai
                                    },
                                    token: 'mock-jwt-token-12345'
                                };

                                // Check OTP config
                                let isOtpEnabled = false;
                                let isGroupLoginEnabled = false;
                                try {
                                    if (fs.existsSync(LOGIN_CONFIG_FILE)) {
                                        const configData = fs.readFileSync(LOGIN_CONFIG_FILE, 'utf8');
                                        const config = JSON.parse(configData);
                                        isOtpEnabled = !!config.enableOtp;
                                        isGroupLoginEnabled = !!config.enableGroupLogin;
                                    }
                                } catch (e) {}

                                // Bổ sung logic kiểm tra quyền (chỉ áp dụng ngoại mạng và khi cấu hình được bật)
                                if (!pending.isInternal && isGroupLoginEnabled) {
                                    if (!data.data?.isAdmin && !data.data?.isKySoTuXa) {
                                        return pending.res.json({
                                            success: false,
                                            message: 'Bạn chưa được phân quyền sử dụng Ký số từ xa. Vui lòng liên hệ bộ phận IT hoặc thực hiện ký trong mạng nội bộ Bệnh viện.'
                                        });
                                    }
                                }

                                if (!isOtpEnabled || pending.isInternal) {
                                    return pending.res.json(loginResponse);
                                }

                                if (isDeviceTrusted(username, reqBody.deviceToken)) {
                                    return pending.res.json(loginResponse);
                                }

                                const soDienThoai = data.data?.soDienThoai;
                                if (!soDienThoai || soDienThoai.trim() === '') {
                                    return pending.res.json({
                                        success: false,
                                        message: 'Tài khoản chưa được cập nhật số điện thoại hoặc số điện thoại đang bị sai. Vui lòng liên hệ bộ phận IT để được hỗ trợ.'
                                    });
                                }

                                // Rate Limit Check
                                const now = Date.now();
                                const rateLimit = otpRateLimit.get(username) || { count: 0, firstSent: now, lastSent: 0 };
                                
                                // Reset if 10 minutes passed
                                if (now - rateLimit.firstSent > 10 * 60 * 1000) {
                                    rateLimit.count = 0;
                                    rateLimit.firstSent = now;
                                }

                                if (rateLimit.count >= 5) {
                                    return pending.res.json({
                                        success: false,
                                        message: 'Bạn đã yêu cầu gửi mã OTP quá nhiều lần. Vui lòng thử lại sau 10 phút.'
                                    });
                                }

                                if (rateLimit.lastSent && now - rateLimit.lastSent < 60 * 1000) {
                                    return pending.res.json({
                                        success: false,
                                        message: 'Vui lòng đợi 60 giây trước khi yêu cầu gửi lại mã OTP.'
                                    });
                                }

                                rateLimit.count += 1;
                                rateLimit.lastSent = now;
                                otpRateLimit.set(username, rateLimit);

                                // Generate OTP
                                const otp = Math.floor(100000 + Math.random() * 900000).toString();
                                const tempToken = crypto.randomBytes(16).toString('hex');
                                
                                otpStore.set(tempToken, {
                                    otp: otp,
                                    username: username,
                                    expires: Date.now() + 5 * 60 * 1000, // 5 minutes
                                    loginResponse: loginResponse
                                });

                                try {
                                    const msg = `BV-VinhDuc - Ma xac nhan cua quy khach la: ${otp}. De dam bao an toan, vui long KHONG chia se ma xac nhan cho bat ky ai`;
                                    await sendNetPlusSMS(soDienThoai, msg);
                                    
                                    // Mask phone: keep last 3 digits
                                    const maskedPhone = '*******' + soDienThoai.slice(-3);
                                    return pending.res.json({
                                        success: true,
                                        requireOtp: true,
                                        tempToken: tempToken,
                                        phoneMasked: maskedPhone
                                    });
                                } catch (err) {
                                    console.error('Lỗi gửi SMS OTP:', err);
                                    return pending.res.json({ success: false, message: 'Lỗi gửi tin nhắn OTP: ' + err.message });
                                }
                            })();
                        } else {
                            pending.res.json({ success: false, message: data.message || 'Lỗi đăng nhập từ Agent!' });
                        }
                    } else {
                        // Generic response
                        pending.res.json({ success: true, data: data });
                    }
                }
            }

        } catch (e) {
            console.error('[WS] Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        if (currentAgentId) {
            connectedAgents.delete(currentAgentId);
            console.log(`[WS] Agent Disconnected: ${currentAgentId}`);
            
            // Notify Web
            broadcastAgentUpdate();
        }
    });
});

// Serve static files from 'public' folder
app.use(express.static('public', {
    setHeaders: (res, path) => {
        if (path.endsWith('.html')) {
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }
    }
}));

// Map to hold pending requests
const pendingRequests = new Map();

// API: SSE Events for Web
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Fix for NGINX buffering SSE
    res.flushHeaders();

    webClients.add(res);
    
    // Gửi ngay 1 event để client đồng bộ lại danh sách
    res.write(`event: agents_update\n`);
    res.write(`data: ${JSON.stringify({ timestamp: Date.now() })}\n\n`);

    req.on('close', () => {
        webClients.delete(res);
    });
});

// API: Login Endpoint (Forwards to Agent)
app.post('/api/login', async (req, res) => {
    const { username, password, captchaToken } = req.body;
    
    // Turnstile check
    const isInternal = isInternalRequest(req);
    if (!isInternal && fs.existsSync(TURNSTILE_CONFIG_FILE)) {
        try {
            const encryptedData = fs.readFileSync(TURNSTILE_CONFIG_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            if (decryptedData) {
                const config = JSON.parse(decryptedData);
                if (config.enabled) {
                    const isValid = await verifyTurnstile(captchaToken, config.secretKey);
                    if (!isValid) {
                        return res.json({ success: false, message: 'Hệ thống chống Spam (CAPTCHA) từ chối yêu cầu của bạn!' });
                    }
                }
            }
        } catch (e) {
            console.error('Turnstile logic error in login:', e);
        }
    }
    
    const agents = Array.from(connectedAgents.keys());
    if (agents.length === 0) {
        return res.json({ success: false, message: 'Không tìm thấy Máy chủ Ký số từ xa nào đang hoạt động. Vui lòng liên hệ IT để được hỗ trợ!' });
    }

    // Tính tải từng agent (dựa trên số request đang pending)
    const agentLoad = {};
    agents.forEach(id => agentLoad[id] = 0);
    for (const reqObj of pendingRequests.values()) {
        if (reqObj.agentId && agentLoad[reqObj.agentId] !== undefined) {
            agentLoad[reqObj.agentId]++;
        }
    }

    // Chọn agent rảnh nhất
    let minLoad = Infinity;
    let minAgents = [];
    for (const [id, load] of Object.entries(agentLoad)) {
        if (load < minLoad) {
            minLoad = load;
            minAgents = [id];
        } else if (load === minLoad) {
            minAgents.push(id);
        }
    }

    // Chọn ngẫu nhiên trong số các agent rảnh nhất để chia đều tải
    const selectedAgent = minAgents[Math.floor(Math.random() * minAgents.length)];

    const ws = connectedAgents.get(selectedAgent);
    const reqId = Date.now().toString() + Math.random().toString(36).substring(7);

    // Lưu request vào danh sách chờ
    const timeout = setTimeout(() => {
        if (pendingRequests.has(reqId)) {
            pendingRequests.delete(reqId);
            res.json({ success: false, message: 'Máy ký số không phản hồi (Timeout)!' });
        }
    }, 15000); // 15 seconds timeout

    pendingRequests.set(reqId, { 
        res, 
        timeout, 
        agentId: selectedAgent, 
        reqBody: req.body,
        isInternal: isInternal
    });

    // Gửi lệnh xuống Agent C#
    const loginPayload = {
        type: 'legacy-login',
        reqId: reqId,
        uid: reqId,
        username: username,
        password: password
    };
    
    // Lưu agentId vào đối tượng req để sau khi login thành công có thể trả về cho client
    req.selectedAgent = selectedAgent;

    ws.send(JSON.stringify(loginPayload));
});

// API: Verify OTP
app.post('/api/verify-otp', (req, res) => {
    const { tempToken, otp } = req.body;
    
    if (!tempToken || !otp) {
        return res.json({ success: false, message: 'Thiếu thông tin xác thực.' });
    }

    const otpData = otpStore.get(tempToken);
    if (!otpData) {
        return res.json({ success: false, message: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' });
    }

    if (Date.now() > otpData.expires) {
        otpStore.delete(tempToken);
        return res.json({ success: false, message: 'Mã xác thực đã hết hạn.' });
    }

    if (otpData.otp !== otp) {
        return res.json({ success: false, message: 'Mã xác thực không chính xác.' });
    }

    // OTP matched
    otpStore.delete(tempToken);
    const deviceToken = addTrustedDevice(otpData.username);
    
    res.json({
        success: true,
        deviceToken: deviceToken,
        ...otpData.loginResponse
    });
});

// API: Logout Endpoint (Forwards to Agent)
app.post('/api/logout', (req, res) => {
    const { agentId, uid } = req.body;
    if (agentId && uid && connectedAgents.has(agentId)) {
        const ws = connectedAgents.get(agentId);
        const reqId = Date.now().toString() + Math.random().toString(36).substring(7);
        ws.send(JSON.stringify({ type: 'logout', reqId: reqId, uid: uid }));
    }
    res.json({ success: true });
});

// API: Get active agents
app.get('/api/agents', (req, res) => {
    const agents = Array.from(connectedAgents.keys());
    res.json({ success: true, data: agents });
});

// API: Generic Request to Agent
app.post('/api/agent/request', (req, res) => {
    const { agentId, type, payload } = req.body;
    if (!agentId || !connectedAgents.has(agentId)) {
        return res.json({ success: false, message: 'Agent không khả dụng hoặc đã mất kết nối!' });
    }
    const ws = connectedAgents.get(agentId);
    const reqId = Date.now().toString() + Math.random().toString(36).substring(7);
    const timeout = setTimeout(() => {
        if (pendingRequests.has(reqId)) {
            pendingRequests.delete(reqId);
            res.json({ success: false, message: 'Máy ký số không phản hồi (Timeout)!' });
        }
    }, 30000);
    pendingRequests.set(reqId, { res, timeout, agentId });
    // Flatten payload vào root level vì Agent C# đọc trực tiếp root["reportId"], root["roleName"], v.v.
    const requestPayload = Object.assign({}, payload || {}, {
        type: type,
        reqId: reqId,
        uid: payload?.uid || reqId
    });
    ws.send(JSON.stringify(requestPayload));
});

// API: Get Turnstile Config
app.get('/api/turnstile-config', (req, res) => {
    try {
        if (fs.existsSync(TURNSTILE_CONFIG_FILE)) {
            const encryptedData = fs.readFileSync(TURNSTILE_CONFIG_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            if (decryptedData) {
                const config = JSON.parse(decryptedData);
                return res.json({ success: true, data: config });
            } else {
                return res.json({ success: false, message: 'Không thể giải mã file cấu hình Turnstile!' });
            }
        }
        res.json({ 
            success: true, 
            data: {
                enabled: false,
                siteKey: '',
                secretKey: ''
            } 
        });
    } catch (e) {
        console.error('Error reading turnstile config:', e);
        res.json({ success: false, message: 'Lỗi đọc cấu hình: ' + e.message });
    }
});

// API: Save Turnstile Config
app.post('/api/turnstile-config', (req, res) => {
    try {
        const configData = req.body;
        const configString = JSON.stringify(configData);
        const encryptedData = encrypt(configString);
        fs.writeFileSync(TURNSTILE_CONFIG_FILE, encryptedData, 'utf8');
        res.json({ success: true, message: 'Lưu cấu hình Turnstile thành công!' });
    } catch (e) {
        console.error('Error saving turnstile config:', e);
        res.json({ success: false, message: 'Lỗi lưu cấu hình: ' + e.message });
    }
});

// API: App Status (Used by frontend to check if Turnstile should be loaded)
app.get('/api/app-status', (req, res) => {
    const isInternal = isInternalRequest(req);
    let turnstileEnabled = false;
    let siteKey = '';

    if (fs.existsSync(TURNSTILE_CONFIG_FILE)) {
        try {
            const encryptedData = fs.readFileSync(TURNSTILE_CONFIG_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            if (decryptedData) {
                const config = JSON.parse(decryptedData);
                turnstileEnabled = config.enabled;
                siteKey = config.siteKey;
            }
        } catch (e) {
            console.error('Error reading turnstile config for status:', e);
        }
    }

    res.json({
        success: true,
        data: {
            isInternal: isInternal,
            turnstileEnabled: turnstileEnabled,
            siteKey: siteKey
        }
    });
});

// API: Get NetPlus Config
app.get('/api/config', (req, res) => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const encryptedData = fs.readFileSync(CONFIG_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            if (decryptedData) {
                const config = JSON.parse(decryptedData);
                return res.json({ success: true, data: config });
            } else {
                return res.json({ success: false, message: 'Không thể giải mã file cấu hình!' });
            }
        }
        // Return default config if no file exists
        res.json({ 
            success: true, 
            data: {
                url: '',
                fallbackUrl: '',
                maTruong: '',
                username: '',
                password: ''
            } 
        });
    } catch (e) {
        console.error('Error reading config:', e);
        res.json({ success: false, message: 'Lỗi đọc cấu hình: ' + e.message });
    }
});

// API: Save NetPlus Config
app.post('/api/config', (req, res) => {
    try {
        const configData = req.body;
        // Validate minimally
        if (!configData.url || !configData.username || !configData.password) {
            return res.json({ success: false, message: 'Vui lòng nhập đủ các trường bắt buộc (URL, Username, Password)!' });
        }
        
        const configStr = JSON.stringify(configData);
        const encryptedStr = encrypt(configStr);
        
        fs.writeFileSync(CONFIG_FILE, encryptedStr, 'utf8');
        res.json({ success: true, message: 'Cấu hình đã được lưu và mã hoá thành công!' });
    } catch (e) {
        console.error('Error saving config:', e);
        res.json({ success: false, message: 'Lỗi lưu cấu hình: ' + e.message });
    }
});

// API: Get Login Config
const LOGIN_CONFIG_FILE = path.join(__dirname, 'login_config.json');
app.get('/api/config-login', (req, res) => {
    try {
        if (fs.existsSync(LOGIN_CONFIG_FILE)) {
            const configData = fs.readFileSync(LOGIN_CONFIG_FILE, 'utf8');
            const config = JSON.parse(configData);
            return res.json({ success: true, data: config });
        }
        res.json({ success: true, data: { enableOtp: false, enableGroupLogin: false } });
    } catch (e) {
        console.error('Error reading login config:', e);
        res.json({ success: false, message: 'Lỗi đọc cấu hình đăng nhập: ' + e.message });
    }
});

// API: Save Login Config
app.post('/api/config-login', (req, res) => {
    try {
        const configData = req.body;
        fs.writeFileSync(LOGIN_CONFIG_FILE, JSON.stringify(configData), 'utf8');
        res.json({ success: true, message: 'Cấu hình đăng nhập đã được lưu thành công!' });
    } catch (e) {
        console.error('Error saving login config:', e);
        res.json({ success: false, message: 'Lỗi lưu cấu hình đăng nhập: ' + e.message });
    }
});

function formatAndValidateVNPhone(phone) {
    if (!phone) return null;
    let p = phone.replace(/[\s\-\+]/g, '');
    if (p.startsWith('0')) p = '84' + p.substring(1);
    const regex = /^84(3[2-9]|5[2689]|7[06-9]|8[1-9]|9[0-9])[0-9]{7}$/;
    if (regex.test(p)) return p;
    return null;
}

function removeVietnameseTones(str) {
    if (!str) return '';
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    return str;
}

// API: Test SMS
app.post('/api/test-sms', async (req, res) => {
    try {
        const { url, maTruong, username, password, phone, captchaToken } = req.body;
        const companyCode = maTruong;
        const smsType = 1;
        
        if (!url || !maTruong || !username || !password || !phone) {
            return res.json({ success: false, message: 'Thiếu thông tin cấu hình hoặc số điện thoại!' });
        }

        // Turnstile check
        const isInternal = isInternalRequest(req);
        if (!isInternal && fs.existsSync(TURNSTILE_CONFIG_FILE)) {
            const encryptedData = fs.readFileSync(TURNSTILE_CONFIG_FILE, 'utf8');
            const decryptedData = decrypt(encryptedData);
            if (decryptedData) {
                const config = JSON.parse(decryptedData);
                if (config.enabled) {
                    const isValid = await verifyTurnstile(captchaToken, config.secretKey);
                    if (!isValid) {
                        return res.json({ success: false, message: 'Hệ thống chống Spam (CAPTCHA) từ chối yêu cầu Test SMS!' });
                    }
                }
            }
        }

        const validPhone = formatAndValidateVNPhone(phone);
        if (!validPhone) {
            return res.json({ success: false, message: 'Số điện thoại không hợp lệ. Vui lòng nhập đúng số di động tại Việt Nam.' });
        }

        const httpModule = url.startsWith('https') ? require('https') : require('http');
        
        // 1. Call Login
        const loginXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <Login xmlns="http://tempuri.org/">
      <maTruong>${maTruong}</maTruong>
      <userName>${username}</userName>
      <password>${password}</password>
    </Login>
  </soap:Body>
</soap:Envelope>`;

        const parsedUrl = new URL(url);
        
        const loginOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://tempuri.org/Login"',
                'Content-Length': Buffer.byteLength(loginXml)
            }
        };

        const makeRequest = (options, postData) => new Promise((resolve, reject) => {
            const req = httpModule.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => resolve(data));
            });
            req.on('error', reject);
            req.write(postData);
            req.end();
        });

        const loginRes = await makeRequest(loginOptions, loginXml);
        const loginMatch = loginRes.match(/<LoginResult>(\d+)<\/LoginResult>/);
        if (!loginMatch || parseInt(loginMatch[1]) <= 0) {
            return res.json({ success: false, message: 'Đăng nhập API NetPlus thất bại (Kiểm tra lại tài khoản)!' });
        }
        
        const loginId = loginMatch[1];

        // 2. Call SendSMS
        const msgContent = removeVietnameseTones("Tin nhắn kiểm tra từ hệ thống Ký Số eHospital.");
        const smsXml = `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <SendSMS xmlns="http://tempuri.org/">
      <aSMS_Input>
        <SmsType>${smsType}</SmsType>
        <IdCustomerSent>${loginId}</IdCustomerSent>
        <CompanyCode>${companyCode}</CompanyCode>
        <Mobile>${validPhone}</Mobile>
        <SMSContent>${msgContent}</SMSContent>
      </aSMS_Input>
      <userName>${username}</userName>
      <password>${password}</password>
    </SendSMS>
  </soap:Body>
</soap:Envelope>`;

        const smsOptions = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
            path: parsedUrl.pathname,
            method: 'POST',
            headers: {
                'Content-Type': 'text/xml; charset=utf-8',
                'SOAPAction': '"http://tempuri.org/SendSMS"',
                'Content-Length': Buffer.byteLength(smsXml)
            }
        };

        const sendRes = await makeRequest(smsOptions, smsXml);
        if (sendRes.includes('<SendSMSResult>true</SendSMSResult>')) {
            res.json({ success: true, message: 'Gửi tin nhắn thành công!' });
        } else {
            res.json({ success: false, message: 'Lỗi gửi tin nhắn, NetPlus trả về False.' });
        }
    } catch (e) {
        console.error('Test SMS Error:', e);
        res.json({ success: false, message: 'Lỗi gọi API: ' + e.message });
    }
});

// Healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'OK', activeAgents: connectedAgents.size });
});

// WebSocket Heartbeat
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            let droppedAgentId = null;
            for (let [id, s] of connectedAgents.entries()) {
                if (s === ws) {
                    droppedAgentId = id;
                    break;
                }
            }
            if (droppedAgentId) {
                connectedAgents.delete(droppedAgentId);
                console.log(`[WS] Agent Disconnected (Ping Timeout): ${droppedAgentId}`);
                broadcastAgentUpdate();
            }
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 15000);

wss.on('close', () => {
    clearInterval(interval);
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => {
    console.log(`KySoServer is running on http://0.0.0.0:${PORT}`);
    console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
});
