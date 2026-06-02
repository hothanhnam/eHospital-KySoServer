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

// API for Web HIS to trigger signing
app.post('/api/sign/request', (req, res) => {
    const { agentId, payload } = req.body;
    
    if (!agentId || !payload) {
        return res.status(400).json({ error: 'Missing agentId or payload' });
    }

    const agentWs = connectedAgents.get(agentId);
    if (agentWs && agentWs.readyState === WebSocket.OPEN) {
        // Push payload to agent
        agentWs.send(JSON.stringify(payload));
        return res.json({ success: true, message: 'Dispatched to agent' });
    } else {
        return res.status(404).json({ error: 'Agent is offline or not found' });
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
