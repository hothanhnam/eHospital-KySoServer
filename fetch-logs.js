const { NodeSSH } = require('node-ssh');
const ssh = new NodeSSH();
async function main() {
  await ssh.connect({
    host: '192.168.99.150',
    username: 'n8n',
    password: 'Vinhduc@2025'
  });
  const res = await ssh.execCommand('pm2 logs KySoServer --lines 30 --nostream');
  console.log(res.stdout);
  if (res.stderr) console.error(res.stderr);
  process.exit(0);
}
main().catch(console.error);
