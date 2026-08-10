const WebSocket = require('ws');
const ws = new WebSocket('ws://192.168.99.150:7000/ws');
ws.on('open', () => { console.log('Connected successfully!'); process.exit(0); });
ws.on('error', (err) => { console.error('Connection failed:', err); process.exit(1); });
setTimeout(() => { console.error('Timeout'); process.exit(1); }, 3000);
