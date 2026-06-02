const { NodeSSH } = require('node-ssh');
const path = require('path');
const ssh = new NodeSSH();

const config = {
  host: '192.168.99.150',
  username: 'n8n',
  password: 'Vinhduc@2025',
  port: 22
};

const remoteDir = '/home/n8n/KySoServer';

async function deploy() {
  try {
    console.log(`Connecting to ${config.host}...`);
    await ssh.connect(config);
    console.log('Connected!');

    // Create remote directory
    await ssh.execCommand(`mkdir -p ${remoteDir}`);

    // Upload files and folders
    console.log('Uploading files...');
    await ssh.putDirectory(path.join(__dirname, 'public'), `${remoteDir}/public`, {
      recursive: true,
      concurrency: 10
    });
    
    const filesToUpload = ['package.json', 'server.js'].map(file => ({
      local: path.join(__dirname, file),
      remote: `${remoteDir}/${file}`
    }));
    await ssh.putFiles(filesToUpload);
    console.log('Upload complete!');

    // Install dependencies and restart server
    console.log('Installing dependencies on remote server (npm install)...');
    const npmRes = await ssh.execCommand('npm install --production', { cwd: remoteDir });
    console.log(npmRes.stdout);
    if (npmRes.stderr) console.error(npmRes.stderr);

    console.log('Starting/Restarting KySoServer using PM2 or Node...');
    // We try to use pm2 if installed, otherwise nohup node
    const runRes = await ssh.execCommand('pm2 restart KySoServer || pm2 start server.js --name KySoServer', { cwd: remoteDir });
    
    // If pm2 is not found, fallback to nohup
    if (runRes.stderr && runRes.stderr.includes('pm2: command not found')) {
      console.log('PM2 not found. Falling back to nohup...');
      await ssh.execCommand('pkill -f "node server.js" || true');
      await ssh.execCommand('nohup node server.js > server.log 2>&1 &', { cwd: remoteDir });
      console.log('KySoServer started in background using nohup.');
    } else {
      console.log(runRes.stdout);
      if (runRes.stderr) console.error(runRes.stderr);
    }

    console.log('Deploy successful!');
    ssh.dispose();
  } catch (error) {
    console.error('Deploy failed:', error);
    ssh.dispose();
  }
}

deploy();
