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
            }

            // Handle other messages (Sign responses, etc.)
            // ...
        } catch (e) {
            console.error('[WS] Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        if (currentAgentId) {
            connectedAgents.delete(currentAgentId);
            console.log(`[WS] Agent Disconnected: ${currentAgentId}`);
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

// API: Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = mockUsers.find(u => u.username === username && u.password === password);
    if (user) {
        res.json({ success: true, token: 'dummy-token-' + username, user: { username: user.username, name: user.name } });
    } else {
        res.status(401).json({ success: false, message: 'Sai tên đăng nhập hoặc mật khẩu!' });
    }
});

// API: Get Documents
app.get('/api/documents', (req, res) => {
    res.json({ success: true, data: mockDocuments });
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
