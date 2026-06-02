param(
    [string]$HostIP = "192.168.99.150",
    [string]$User = "n8n",
    [string]$Port = "22",
    [string]$RemoteDir = "/home/n8n/KySoServer"
)

Write-Host "Deploying KySoServer to $User@$HostIP..." -ForegroundColor Cyan

# 1. Create target directory if not exists
ssh -p $Port ${User}@${HostIP} "mkdir -p $RemoteDir"

# 2. SCP files (excluding node_modules and .git)
Write-Host "Copying files via SCP..."
scp -P $Port package.json server.js ${User}@${HostIP}:${RemoteDir}/

# 3. Remote commands: Install dependencies and restart service
Write-Host "Installing NPM dependencies on server and restarting..."
ssh -p $Port ${User}@${HostIP} "cd $RemoteDir && npm install --production && pm2 restart KySoServer || pm2 start server.js --name KySoServer"

Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
