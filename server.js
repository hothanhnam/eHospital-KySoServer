const express = require('express');
const cors = require('cors');
const http = require('http');
const WebSocket = require('ws');

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
            if (data.type && data.type.endsWith("-ack") && data.reqId) {
                const pending = pendingRequests.get(data.reqId);
                if (pending) {
                    clearTimeout(pending.timeout);
                    pendingRequests.delete(data.reqId);
                    
                    if (data.type === "legacy-login-ack") {
                        if (data.ok) {
                        pending.res.json({
                            success: true,
                            user: { 
                                id: data.data?.loginUserId, 
                                uid: data.uid,
                                username: data.data?.userCode, 
                                name: data.data?.userName, 
                                role: 'doctor' 
                            },
                            token: 'mock-jwt-token-12345'
                        });
                    } else {
                        pending.res.json({ success: false, message: data.message || 'Lỗi đăng nhập từ Agent!' });
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
app.use(express.static('public'));

// Mock Database
const mockUsers = [
    { username: 'admin', password: '123', name: 'Quản trị viên' },
    { username: 'bacsi_nam', password: '123', name: 'Bác sĩ Nam' }
];

let mockDocuments = [
    { id: 'doc1', title: 'Bệnh án Ngoại trú - BN Nguyễn Văn A', status: 'pending', date: '2026-06-02' },
    { id: 'doc2', title: 'Giấy ra viện - BN Trần Thị B', status: 'pending', date: '2026-06-02' },
    { id: 'doc3', title: 'Đơn thuốc điện tử - BN Lê Văn C', status: 'pending', date: '2026-06-02' },
];

// Map to hold pending requests
const pendingRequests = new Map();

// API: SSE Events for Web
app.get('/api/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    webClients.add(res);

    req.on('close', () => {
        webClients.delete(res);
    });
});

// API: Login Endpoint (Forwards to Agent)
app.post('/api/login', (req, res) => {
    const { username, password, agentId } = req.body;
    
    if (!agentId || !connectedAgents.has(agentId)) {
        return res.json({ success: false, message: 'Agent không khả dụng hoặc đã mất kết nối!' });
    }

    const ws = connectedAgents.get(agentId);
    const reqId = Date.now().toString() + Math.random().toString(36).substring(7);

    // Lưu request vào danh sách chờ
    const timeout = setTimeout(() => {
        if (pendingRequests.has(reqId)) {
            pendingRequests.delete(reqId);
            res.json({ success: false, message: 'Máy ký số không phản hồi (Timeout)!' });
        }
    }, 15000); // 15 seconds timeout

    pendingRequests.set(reqId, { res, timeout });

    // Gửi lệnh xuống Agent C#
    const loginPayload = {
        type: 'legacy-login',
        reqId: reqId,
        uid: reqId, // Dùng reqId làm uid tạm thời
        username: username,
        password: password
    };
    
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

// API: Get Documents
app.get('/api/documents', (req, res) => {
    res.json({ success: true, data: mockDocuments });
});

// API: Get active agents
app.get('/api/agents', (req, res) => {
    const agents = Array.from(connectedAgents.keys());
    res.json({ success: true, data: agents });
});


// API: Generic Request to Agent
app.post("/api/agent/request", (req, res) => {
    const { agentId, type, payload } = req.body;
    if (!agentId || !connectedAgents.has(agentId)) {
        return res.json({ success: false, message: "Agent không khả dụng hoặc đã mất kết nối!" });
    }
    const ws = connectedAgents.get(agentId);
    const reqId = Date.now().toString() + Math.random().toString(36).substring(7);
    const timeout = setTimeout(() => {
        if (pendingRequests.has(reqId)) {
            pendingRequests.delete(reqId);
            res.json({ success: false, message: "Máy ký số không phản hồi (Timeout)!" });
        }
    }, 30000);
    pendingRequests.set(reqId, { res, timeout });
    const requestPayload = {
        type: type,
        reqId: reqId,
        uid: payload?.uid || reqId,
        payload: payload
    };
    ws.send(JSON.stringify(requestPayload));
});

// API for Web HIS to trigger signing (or triggered from Portal)
app.post('/api/sign/request', (req, res) => {
    const { agentId, payload, docId } = req.body;
    
    // Validate
    if (!agentId) return res.status(400).json({ error: 'Missing agentId' });

    const agentWs = connectedAgents.get(agentId);
    if (agentWs && agentWs.readyState === WebSocket.OPEN) {
        // Push payload to agent
        agentWs.send(JSON.stringify(payload));
        
        // Update mock document status
        if (docId) {
            const doc = mockDocuments.find(d => d.id === docId);
            if (doc) doc.status = 'signing';
        }

        return res.json({ success: true, message: 'Đã gửi lệnh ký xuống Agent' });
    } else {
        return res.status(404).json({ error: 'Agent (SignCoreVD) chưa được kết nối hoặc đang Offline' });
    }
});

// Healthcheck
app.get('/health', (req, res) => {
    res.json({ status: 'OK', activeAgents: connectedAgents.size });
});

const PORT = process.env.PORT || 7000;
server.listen(PORT, () => {
    console.log(`KySoServer is running on http://0.0.0.0:${PORT}`);
    console.log(`WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);
});
