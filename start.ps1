# ccp-observe 一键启动（Windows PowerShell）
#
#   .\start.ps1                 # 127.0.0.1:8787，自动打开面板
#   .\start.ps1 -Port 8788      # 换端口
#   .\start.ps1 -NoOpen         # 不打开浏览器
#
# 若提示禁止运行脚本，请先执行：
#   Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass

[CmdletBinding()]
param(
    [int]$Port = $(if ($env:CCP_PORT) { [int]$env:CCP_PORT } else { 8787 }),
    [string]$HostAddr = $(if ($env:CCP_HOST) { $env:CCP_HOST } else { "127.0.0.1" }),
    [switch]$NoOpen
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

function Fail([string]$Message) {
    Write-Host $Message -ForegroundColor Red
    exit 1
}

# Start-Process -ArgumentList joins arguments with spaces, so paths that
# contain spaces (e.g. C:\Program Files\...) must be quoted explicitly.
function Quote-Arg([string]$Value) {
    if ($Value -match '^[^\s"]*$') { return $Value }
    return '"' + ($Value -replace '"', '\"') + '"'
}

# ---- 1. 找 Python 3 --------------------------------------------------------
$pyExe = $null
$pyArgs = @()
function Test-Python([string]$exe, [string[]]$args) {
    try {
        & $exe @args -c "import sys; raise SystemExit(0 if sys.version_info >= (3,9) else 1)" 2>$null | Out-Null
        return ($LASTEXITCODE -eq 0)
    } catch { return $false }
}

if ($env:CCP_PYTHON) {
    if (Test-Python $env:CCP_PYTHON @()) { $pyExe = $env:CCP_PYTHON }
} else {
    foreach ($cand in @("python", "python3")) {
        $cmd = Get-Command $cand -ErrorAction SilentlyContinue
        if ($cmd -and (Test-Python $cmd.Source @())) { $pyExe = $cmd.Source; break }
    }
    if (-not $pyExe) {
        $launcher = Get-Command "py" -ErrorAction SilentlyContinue
        if ($launcher -and (Test-Python $launcher.Source @("-3"))) {
            $pyExe = $launcher.Source
            $pyArgs = @("-3")
        }
    }
}
if (-not $pyExe) {
    Fail @"
[!] 没有找到可用的 Python 3.9+。
    安装 Python 后重试：https://www.python.org/downloads/
    或设置环境变量 CCP_PYTHON 指向解释器绝对路径。
"@
}
$ver = (& $pyExe @pyArgs -c "import sys;print(sys.version.split()[0])")
Write-Host "[1/3] Python: $ver"

# ---- 2. 面板静态文件 -------------------------------------------------------
if (-not (Test-Path (Join-Path $Root "proxy\static\index.html"))) {
    $npm = Get-Command "npm" -ErrorAction SilentlyContinue
    if ($npm) {
        Write-Host "[2/3] 首次运行：构建面板（npm install && npm run build）…"
        Push-Location (Join-Path $Root "web")
        try {
            if (Test-Path "package-lock.json") { & npm ci --silent } else { & npm install --silent }
            if ($LASTEXITCODE -ne 0) { throw "npm install 失败" }
            & npm run build --silent
            if ($LASTEXITCODE -ne 0) { throw "npm run build 失败" }
        } finally { Pop-Location }
    } else {
        Fail "[!] 缺少 proxy\static\index.html，且未安装 npm。安装 Node.js 18+ 后执行：cd web; npm install; npm run build"
    }
} else {
    Write-Host "[2/3] 面板静态文件已就绪"
}

$Panel = "http://${HostAddr}:$Port/_ccp/"
$proxyScript = Join-Path $Root "proxy\proxy.py"

function Test-OurProxy {
    try {
        $res = Invoke-RestMethod -Uri "http://${HostAddr}:$Port/_ccp/api/selftest" -TimeoutSec 2
        return ($null -ne $res.checks)
    } catch { return $false }
}

$ownedProc = $null
if (Test-OurProxy) {
    Write-Host "[3/3] 检测到已在运行的 ccp-observe，直接复用"
} else {
    Write-Host "[3/3] 启动代理 ${HostAddr}:$Port …"
    $argList = @()
    $argList += $pyArgs
    $argList += @((Quote-Arg $proxyScript), "--host", (Quote-Arg $HostAddr), "--port", "$Port")
    $ownedProc = Start-Process -FilePath $pyExe -ArgumentList $argList `
        -WorkingDirectory $Root -PassThru -NoNewWindow

    $ready = $false
    for ($i = 0; $i -lt 50; $i++) {
        if ($ownedProc.HasExited) { break }
        Start-Sleep -Milliseconds 200
        if (Test-OurProxy) { $ready = $true; break }
    }
    if (-not $ready) {
        if ($ownedProc -and -not $ownedProc.HasExited) { Stop-Process -Id $ownedProc.Id -Force }
        Fail "[!] 代理未能在 10 秒内就绪，请检查上方日志（端口 $Port 是否被占用？）。"
    }
}

# ---- 首次使用引导 ----------------------------------------------------------
$configPath = Join-Path $Root "proxy\state\config.json"
$upstream = ""
if (Test-Path $configPath) {
    try {
        $cfg = Get-Content $configPath -Raw -Encoding UTF8 | ConvertFrom-Json
        $upstream = @($cfg.upstream, $cfg.upstream_anthropic, $cfg.upstream_openai) |
            Where-Object { $_ } | Select-Object -First 1
    } catch { $upstream = "" }
}

if (-not $upstream) {
    Write-Host ""
    Write-Host "  ┌─ 首次使用 ────────────────────────────────────────────────" -ForegroundColor Yellow
    Write-Host "  │ 还没有配置上游地址（任何 OpenAI / Anthropic 兼容端点都可以）。" -ForegroundColor Yellow
    Write-Host "  │ 打开面板 → 右上角齿轮 → 填写「上游地址」→ 保存。" -ForegroundColor Yellow
    Write-Host "  │ 示例：https://example.internal/v1" -ForegroundColor Yellow
    Write-Host "  └───────────────────────────────────────────────────────────" -ForegroundColor Yellow
    Write-Host "  面板：$Panel"
    Write-Host ""
} else {
    Write-Host "  面板：$Panel   上游：$upstream"
}

if (-not $NoOpen) { Start-Process $Panel | Out-Null }

if ($ownedProc) {
    Write-Host "  按 Ctrl+C 停止代理。"
    try { Wait-Process -Id $ownedProc.Id } finally {
        if (-not $ownedProc.HasExited) { Stop-Process -Id $ownedProc.Id -Force }
        Write-Host "[ccp-observe] 代理已停止"
    }
} else {
    Write-Host "  代理由其它进程托管，本脚本退出。"
}
