param(
  [switch]$NoConvex,
  [switch]$NoDolphin,
  [switch]$SetupDolphin,
  [int]$ApiPort = 8058,
  [int]$NextPort = 3000
)

$ErrorActionPreference = 'Stop'

# Resolve repo root and stay there
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Running DataDiver project from: $root" -ForegroundColor Cyan
Write-Host "Enhanced with Dolphin multimodal document parser" -ForegroundColor Yellow

# Check if Dolphin setup is needed
if ($SetupDolphin) {
  Write-Host "`nSetting up Dolphin document parser..." -ForegroundColor Magenta
  python scripts/setup_dolphin.py
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Dolphin setup failed. Continuing without Dolphin..." -ForegroundColor Red
    $env:USE_DOLPHIN = "0"
  } else {
    Write-Host "Dolphin setup completed successfully!" -ForegroundColor Green
    $env:USE_DOLPHIN = "1"
  }
} elseif (-not $NoDolphin) {
  Write-Host "`nVerifying Dolphin setup..." -ForegroundColor Yellow
  python scripts/setup_dolphin.py --verify-only
  if ($LASTEXITCODE -eq 0) {
    Write-Host "Dolphin is ready!" -ForegroundColor Green
    $env:USE_DOLPHIN = "1"
  } else {
    Write-Host "Dolphin not available. Use -SetupDolphin to install. Continuing without Dolphin..." -ForegroundColor Yellow
    $env:USE_DOLPHIN = "0"
  }
} else {
  Write-Host "`nSkipping Dolphin (use -NoDolphin to skip explicitly)" -ForegroundColor Yellow
  $env:USE_DOLPHIN = "0"
}

# Helper to spawn a new PowerShell window running a command
function Start-Window {
  param(
    [Parameter(Mandatory=$true)][string]$Title,
    [Parameter(Mandatory=$true)][string]$Command,
    [string]$WorkingDirectory = $root
  )
  $pwsh = (Get-Command pwsh -ErrorAction SilentlyContinue)
  if ($pwsh) {
    return Start-Process -FilePath $pwsh.Source -ArgumentList @('-NoExit','-Command', $Command) -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Normal
  } else {
    return Start-Process -FilePath 'powershell.exe' -ArgumentList @('-NoExit','-Command', $Command) -WorkingDirectory $WorkingDirectory -PassThru -WindowStyle Normal
  }
}

$procs = @()

# 1) Frontend (Next.js)
$frontCmd = "$env:PORT=$NextPort; npm run dev"
$procs += Start-Window -Title "Frontend (Next.js)" -Command $frontCmd -WorkingDirectory $root
Write-Host "Started Next.js dev on http://localhost:$NextPort" -ForegroundColor Green

# 2) Convex realtime dev (optional)
if (-not $NoConvex) {
  $convexCmd = "npx convex dev"
  $procs += Start-Window -Title "Convex Dev" -Command $convexCmd -WorkingDirectory $root
  Write-Host "Started Convex dev (watch)" -ForegroundColor Green
} else {
  Write-Host "Skipping Convex (use -NoConvex to skip explicitly)" -ForegroundColor Yellow
}

# 3) Backend (FastAPI)
$apiCmd = "python -m uvicorn agent.api:app --reload --port $ApiPort"
$procs += Start-Window -Title "FastAPI (agent.api)" -Command $apiCmd -WorkingDirectory $root
Write-Host "Started FastAPI on http://localhost:$ApiPort" -ForegroundColor Green

Write-Host "`n🚀 All services launched in separate windows!" -ForegroundColor Cyan
Write-Host "📊 Frontend: http://localhost:$NextPort" -ForegroundColor Green
Write-Host "🔌 API: http://localhost:$ApiPort" -ForegroundColor Green
if (-not $NoConvex) {
  Write-Host "💾 Convex: Running in separate window" -ForegroundColor Green
}
if ($env:USE_DOLPHIN -eq "1") {
  Write-Host "🐬 Dolphin: Enhanced document parsing enabled" -ForegroundColor Magenta
} else {
  Write-Host "📄 Document parsing: Traditional parsers only" -ForegroundColor Yellow
}
Write-Host "`nPress Enter here to stop all services..." -NoNewline
[void][System.Console]::ReadLine()

# Cleanup
foreach ($p in $procs) {
  if ($p -and -not $p.HasExited) {
    try { $p.CloseMainWindow() | Out-Null } catch {}
    try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Write-Host "Stopped all child windows." -ForegroundColor Cyan
