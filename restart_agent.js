const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
const config = { host: '192.168.99.150', username: 'n8n', password: 'Vinhduc@2025', port: 22 };
async function run() {
  await ssh.connect(config);
  console.log('Restarting agent-backend...');
  const res = await ssh.execCommand('pm2 restart agent-backend');
  console.log(res.stdout);
  if(res.stderr) console.error(res.stderr);
  ssh.dispose();
}
run();
