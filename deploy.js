const { NodeSSH } = require('node-ssh');
const path = require('path');
const { execSync } = require('child_process');

const ssh = new NodeSSH();

const config = {
  host: '192.168.99.150',
  username: 'n8n',
  password: 'Vinhduc@2025',
  port: 22
};

const remoteDir = '/home/n8n/KySoServer';

async function deploy() {
  console.log('🚀 Bắt đầu quá trình Deploy...');

  console.log('🛠️ Kiểm tra và tự động Commit code lên Github trước khi Deploy...');
  try {
    execSync('git add .', { stdio: 'inherit' });
    const status = execSync('git status --porcelain').toString();
    if (status.trim().length > 0) {
      const commitMsg = `Auto commit before deploy: ${new Date().toLocaleString('vi-VN')}`;
      execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
      console.log('📤 Đang đẩy lên Github...');
      execSync('git push origin master', { stdio: 'inherit' });
      console.log('✅ Đã commit và push code an toàn!');
    } else {
      console.log('⚠️ Không có thay đổi nào cần commit.');
    }
  } catch (e) {
    console.error('❌ Lỗi trong quá trình commit/push code. Huỷ deploy để đảm bảo an toàn:', e.message);
    process.exit(1);
  }

  try {
    console.log(`🔌 Đang kết nối tới ${config.host}...`);
    await ssh.connect(config);
    console.log('✅ Đã kết nối thành công!');

    console.log(`📁 Đang tạo thư mục ${remoteDir} (nếu chưa có)...`);
    await ssh.execCommand(`mkdir -p ${remoteDir}`);

    console.log('📤 Đang đẩy Source Code lên Server (bao gồm thư mục public)...');
    await ssh.putDirectory(__dirname, remoteDir, {
      recursive: true,
      concurrency: 5,
      validate: function(itemPath) {
        const baseName = path.basename(itemPath);
        return baseName !== 'node_modules' && baseName !== '.git' && baseName !== 'deploy.js';
      }
    });
    console.log('✅ Đã tải file lên xong!');

    console.log('🔄 Đang cài đặt thư viện và khởi động lại dịch vụ bằng PM2...');
    const npmRes = await ssh.execCommand('npm install --production', { cwd: remoteDir });
    console.log(npmRes.stdout);
    if (npmRes.stderr) console.error(npmRes.stderr);

    const runRes = await ssh.execCommand('pm2 restart KySoServer || pm2 start server.js --name KySoServer', { cwd: remoteDir });
    
    if (runRes.stderr && runRes.stderr.includes('pm2: command not found')) {
      console.log('⚠️ PM2 không tìm thấy. Khởi động bằng nohup...');
      await ssh.execCommand('pkill -f "node server.js" || true');
      await ssh.execCommand('nohup node server.js > server.log 2>&1 &', { cwd: remoteDir });
    } else {
      console.log(runRes.stdout);
      if (runRes.stderr) console.error(runRes.stderr);
    }

    console.log('🎉 Hoàn tất quá trình Deploy KySoServer!');
    ssh.dispose();
  } catch (error) {
    console.error('❌ Deploy failed:', error);
    ssh.dispose();
  }
}

deploy();
