param(
    [string]$HostIP = "192.168.99.150",
    [string]$User = "n8n",
    [string]$Port = "22",
    [string]$RemoteDir = "/home/n8n/KySoServer"
)

Write-Host "Deploying KySoServer to $User@$HostIP..." -ForegroundColor Cyan

Write-Host "1. Committing code to Github..." -ForegroundColor Cyan
git add .
$gitStatus = git status --porcelain
if ($gitStatus) {
    $commitMsg = "Auto commit before deploy: " + (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    git commit -m $commitMsg
    Write-Host "Pushing to Github..."
    git push origin master
    Write-Host "Code committed and pushed successfully!" -ForegroundColor Green
} else {
    Write-Host "No changes to commit. Proceeding..." -ForegroundColor Yellow
}

# 2. Create target directory if not exists
ssh -p $Port ${User}@${HostIP} "mkdir -p $RemoteDir"

# 3. SCP files (including public directory)
Write-Host "3. Copying files via SCP..." -ForegroundColor Cyan
scp -r -P $Port package.json server.js public ${User}@${HostIP}:${RemoteDir}/

# 3. Remote commands: Install dependencies and restart service
Write-Host "Installing NPM dependencies on server and restarting..."
ssh -p $Port ${User}@${HostIP} "cd $RemoteDir && npm install --production && pm2 restart KySoServer || pm2 start server.js --name KySoServer"

Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
