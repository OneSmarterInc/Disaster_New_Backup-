param([switch]$WithAI)
$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
Set-Location $repo
$allowedBranches = @('feature/local-laptop-setup', 'integration/production-local-validation')
if ((git branch --show-current) -notin $allowedBranches) {
    throw 'Run this from feature/local-laptop-setup or integration/production-local-validation in the backup repository.'
}
$remote = git remote get-url origin
if ($remote -notmatch 'OneSmarterInc/Disaster_New_Backup-(\.git)?$') {
    throw 'This launcher is prepared for the Disaster_New_Backup- checkout.'
}
if ($env:VERCEL -or $env:NODE_ENV -eq 'production') {
    throw 'Open a local development PowerShell window without VERCEL or NODE_ENV=production.'
}
Get-Command node, npm.cmd, docker -ErrorAction Stop | Out-Null
$nodeMajor = [int]((node --version).TrimStart('v').Split('.')[0])
if ($nodeMajor -lt 20) { throw 'Node.js 20 or newer is required.' }
docker info --format '{{.OSType}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Start Docker Desktop in Linux-container mode, then run this script again.' }
if ((docker info --format '{{.OSType}}') -ne 'linux') { throw 'Docker must use Linux containers.' }
$containerName = 'rapidsims-local-redis'
$exists = docker ps -a --filter "name=^/$containerName$" --format '{{.Names}}'
if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Docker.' }
if ($exists -eq $containerName) {
    $containerInfo = docker inspect $containerName | ConvertFrom-Json
    $owned = $containerInfo[0].Config.Labels.'onesmarter.rapidsims.local'
    if ($owned -ne '1') { throw 'A different container has the same name. Do not delete it; report this conflict.' }
    docker start $containerName | Out-Null
} else {
    docker run -d --name $containerName --label onesmarter.rapidsims.local=1 -p 127.0.0.1:6380:6379 -v rapidsims-local-redis-data:/data redis:7.4 redis-server --appendonly yes | Out-Null
}
if ($LASTEXITCODE -ne 0) { throw 'Redis could not start. Check Docker and whether port 6380 is already in use.' }
$ready = $false
for ($i = 0; $i -lt 15; $i++) {
    $pong = docker exec $containerName redis-cli ping
    if ($LASTEXITCODE -eq 0 -and $pong -eq 'PONG') { $ready = $true; break }
    Start-Sleep -Seconds 1
}
if (-not $ready) { throw 'Redis did not become ready.' }
New-Item -ItemType Directory -Path '.local-dev' -Force | Out-Null
$exclude = git rev-parse --git-path info/exclude
if (-not (Select-String -Path $exclude -SimpleMatch '/.local-dev/' -Quiet -ErrorAction SilentlyContinue)) {
    Add-Content -Path $exclude -Value "`n/.local-dev/"
}
if (-not (Test-Path '.local-dev/node_modules/pg/package.json') -or -not (Test-Path '.local-dev/node_modules/redis/package.json')) {
    npm.cmd install --prefix '.local-dev' pg@8 redis@4
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed.' }
}
$env:LOCAL_PGPORT = '5434'
$env:LOCAL_PORT = '3000'
$env:LOCAL_REDIS_PORT = '6380'
try {
    $secret = Read-Host 'Local PostgreSQL password for rapidsims_app' -AsSecureString
    $credential = New-Object System.Management.Automation.PSCredential('rapidsims_app', $secret)
    $env:PGPASSWORD = $credential.GetNetworkCredential().Password
    if ($WithAI) {
        $aiSecret = Read-Host 'Anthropic API key for Sim01/Sim02 (calls use your API account)' -AsSecureString
        $aiCredential = New-Object System.Management.Automation.PSCredential('anthropic', $aiSecret)
        $env:ANTHROPIC_API_KEY = $aiCredential.GetNetworkCredential().Password
    }
    node (Join-Path $PSScriptRoot 'start.cjs')
    if ($LASTEXITCODE -ne 0) { Write-Warning 'The local suite stopped with an error. Share the error text without passwords or keys.' }
} finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    if ($WithAI) { Remove-Item Env:ANTHROPIC_API_KEY -ErrorAction SilentlyContinue }
    Remove-Variable secret, credential, aiSecret, aiCredential -ErrorAction SilentlyContinue
}
