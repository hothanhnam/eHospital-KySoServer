const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function run() {
    await ssh.connect({ host: '192.168.99.150', username: 'n8n', password: 'Vinhduc@2025' });
    const { stdout, stderr } = await ssh.execCommand('pm2 logs KySoServer --lines 30 --nostream');
    console.log(stdout);
    console.log(stderr);
    ssh.dispose();
}
run();
