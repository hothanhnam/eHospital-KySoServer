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
                            pending.res.json({
                                success: true,
                                user: { 
                                    id: data.data?.loginUserId, 
                                    uid: data.uid,
                                    username: data.data?.userCode, 
                                    name: data.data?.userName, 
                                    role: 'doctor',
                                    isAdmin: data.data?.isAdmin,
                                    activeAgentId: pending.agentId
                                },
                                token: 'mock-jwt-token-12345'
                            });
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
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    
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

    pendingRequests.set(reqId, { res, timeout, agentId: selectedAgent });

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
                url: 'http://svc.netplus.vn/WSSendSMS.asmx',
                fallbackUrl: 'http://svc3.netplus.vn/WSSendSMS.asmx',
                maTruong: 'BV-VinhDuc',
                companyCode: 'BV-VinhDuc',
                username: 'bvvinhducqnguitin',
                password: '',
                smsType: 1
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
