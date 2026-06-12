const http = require('http');

function callApi(type, payload) {
    const data = JSON.stringify({ agentId: 'cme-agent-1', type: type, payload: payload });
    const options = {
        hostname: '192.168.99.150',
        port: 7000,
        path: '/api/agent/request',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(data)
        }
    };
    const req = http.request(options, res => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => console.log(`[${type}]`, body));
    });
    req.write(data);
    req.end();
}

http.get('http://192.168.99.150:7000/api/agents', (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
        const agents = JSON.parse(body).data;
        if (agents && agents.length > 0) {
            const data = JSON.stringify({ agentId: agents[0], type: 'get-filters', payload: { uid: '123' } });
            const options = {
                hostname: '192.168.99.150',
                port: 7000,
                path: '/api/agent/request',
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            };
            const req = http.request(options, res2 => {
                let body2 = '';
                res2.on('data', chunk => body2 += chunk);
                res2.on('end', () => console.log('get-filters:', body2));
            });
            req.write(data);
            req.end();
        } else {
            console.log('No agents active');
        }
    });
});
