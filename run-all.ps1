param(
  [switch]$NoConvex,
  [int]$ApiPort = 8058,
  [int]$NextPort = 3000
)

$ErrorActionPreference = 'Stop'

# Resolve repo root and stay there
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root

Write-Host "Running project from: $root" -ForegroundColor Cyan

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

Write-Host "\nAll services launched in separate windows." -ForegroundColor Cyan
Write-Host "Press Enter here to stop them all..." -NoNewline
[void][System.Console]::ReadLine()

# Cleanup
foreach ($p in $procs) {
  if ($p -and -not $p.HasExited) {
    try { $p.CloseMainWindow() | Out-Null } catch {}
    try { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue } catch {}
  }
}
Write-Host "Stopped all child windows." -ForegroundColor Cyan
