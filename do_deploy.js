const { NodeSSH } = require('node-ssh');
const path = require('path');

const ssh = new NodeSSH();

async function deploy() {
    console.log("🚀 Bắt đầu quá trình Deploy...");
    try {
        console.log("🔌 Đang kết nối tới 192.168.99.150...");
        await ssh.connect({
            host: '192.168.99.150',
            username: 'n8n',
            password: 'Vinhduc@2025'
        });
        console.log("✅ Đã kết nối thành công!");

        const remoteDir = '/home/n8n/KySoServer';
        console.log(`📁 Đang tạo thư mục ${remoteDir} (nếu chưa có)...`);
        await ssh.execCommand(`mkdir -p ${remoteDir}`);
        
        console.log("📤 Đang đẩy Source Code lên Server (bao gồm thư mục public)...");
        await ssh.putDirectory(__dirname, remoteDir, {
            recursive: true,
            concurrency: 5,
            validate: function(itemPath) {
                const baseName = path.basename(itemPath);
                return baseName !== 'node_modules' && baseName !== '.git';
            }
        });
        console.log("✅ Đã tải file lên xong!");

        console.log("🔄 Đang cài đặt thư viện và khởi động lại dịch vụ bằng PM2...");
        const result = await ssh.execCommand(`cd ${remoteDir} && npm install --production && pm2 restart KySoServer || pm2 start server.js --name KySoServer`);
        
        if (result.stdout) console.log('📝 Log: \n' + result.stdout);
        if (result.stderr) console.log('⚠️ Lỗi (nếu có): \n' + result.stderr);

        console.log("🎉 Hoàn tất quá trình Deploy KySoServer!");
    } catch (err) {
        console.error("❌ Lỗi Deploy:", err);
    } finally {
        ssh.dispose();
    }
}

deploy();
