# Agent Mesh: install this machine's node on Windows. Served by the team's world server:
#   irm http://__SERVER__/install.ps1 | iex
# Installs uv (if missing), the node server (dashboard included) and agentmesh-node, starts the node at sign-in,
# then opens the dashboard so you can join the team. Safe to run again to update.
# $env:AGENTMESH_NO_SERVICE=1 starts the node for this session only; $env:AGENTMESH_NO_OPEN=1 skips the browser.
$ErrorActionPreference = 'Stop'
$Server = '__SERVER__'      # the world server this script came from (host:port)
$Office = '__HOST__'        # prefilled as "Office server" in the setup form
$Wheel = '__WHEEL__'
$Org = '__ORG__'
$Title = if ($Org) { "$Org Office" } else { 'Office' }
$Base = "http://$Server"
$HomeDir = Join-Path $env:USERPROFILE '.agentfleet'
$Bin = Join-Path $env:USERPROFILE '.local\bin'
$Port = 9100

function Say($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "!!  $m" -ForegroundColor Yellow }
function Die($m) { Write-Host "xx  $m" -ForegroundColor Red; throw $m }

Say "Installing $Title on this machine"
if (-not $Wheel) { Die "The server has no node package yet. Ask your admin to run 'make bundle' on the server." }
New-Item -ItemType Directory -Force -Path (Join-Path $HomeDir 'data'), $Bin | Out-Null
$env:Path = "$Bin;$env:Path"

# 1. uv: installs the node and the Python it needs.
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
  Say 'Installing uv'
  powershell -NoProfile -ExecutionPolicy ByPass -Command "irm https://astral.sh/uv/install.ps1 | iex"
  $env:Path = "$Bin;$env:USERPROFILE\.cargo\bin;$env:Path"
}
if (-not (Get-Command uv -ErrorAction SilentlyContinue)) { Die 'uv did not install; see https://docs.astral.sh/uv/' }

# 2. The node server, with the dashboard built in.
Say "Installing the Agent Mesh node ($Wheel)"
$Tmp = Join-Path ([IO.Path]::GetTempPath()) ([Guid]::NewGuid())
New-Item -ItemType Directory -Path $Tmp | Out-Null
$WheelPath = Join-Path $Tmp $Wheel
Invoke-WebRequest "$Base/downloads/$Wheel" -OutFile $WheelPath -UseBasicParsing
uv tool install --force --python 3.12 $WheelPath | Out-Null
$Node = (Get-Command agentfleet-node -ErrorAction SilentlyContinue).Source
if (-not $Node) { $Node = Join-Path $Bin 'agentfleet-node.exe' }
if (-not (Test-Path $Node)) { Die 'agentfleet-node was not installed' }

# 3. agentmesh-node: lets your agents reach other machines.
$Arch = $env:PROCESSOR_ARCHITECTURE.ToLower()   # amd64 | arm64
if (Get-Command agentmesh-node -ErrorAction SilentlyContinue) {
  Say 'agentmesh-node already installed'
} else {
  try {
    Invoke-WebRequest "$Base/downloads/agentmesh-node-windows-$Arch.exe" -OutFile (Join-Path $Bin 'agentmesh-node.exe') -UseBasicParsing
    Say 'Installed agentmesh-node'
  } catch {
    Warn "The server has no agentmesh-node for windows-$Arch. The Office works, but your agents can't reach other machines yet. Ask your admin."
  }
}

# 4. Claude Code runs the agents; it needs a login on this machine.
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Warn 'Claude Code is not installed. Install it and log in (https://docs.claude.com/claude-code); your agents need it.'
}

# 5. Start the node now and at every sign-in (hidden window). It keeps its data in %USERPROFILE%\.agentfleet.
Say 'Starting the node'
$Run = Join-Path $HomeDir 'run-node.ps1'
@"
`$env:Path = '$Bin;' + `$env:Path
`$env:AGENTFLEET_DATA_DIR = '$HomeDir\data'
`$env:AGENTFLEET_MESH_NODE_CONFIG_PATH = '$HomeDir\data\agentmesh-node.yaml'
Set-Location '$HomeDir'
& '$Node' serve *>> '$HomeDir\node.log'
"@ | Set-Content -Encoding UTF8 $Run
Get-Process -Name agentfleet-node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
$PsArgs = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$Run`""
if (-not $env:AGENTMESH_NO_SERVICE) {
  try {
    $Action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $PsArgs
    $Trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $Settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit 0
    Register-ScheduledTask -TaskName 'AgentMeshNode' -Action $Action -Trigger $Trigger -Settings $Settings -Force | Out-Null
  } catch {
    Warn "Could not register a sign-in task ($_). The node runs now; start it again after a restart by running this installer."
  }
}
Start-Process powershell.exe -ArgumentList $PsArgs -WindowStyle Hidden

$Ready = $false
for ($i = 0; $i -lt 40; $i++) {
  try { Invoke-WebRequest "http://127.0.0.1:$Port/api/node" -UseBasicParsing -TimeoutSec 2 | Out-Null; $Ready = $true; break } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $Ready) { Die "The node did not start; see $HomeDir\node.log" }

$Url = "http://127.0.0.1:$Port/?server=$Office"
Say "Done. Opening $Url to join the team."
if (-not $env:AGENTMESH_NO_OPEN) { Start-Process $Url }
Write-Host "If no browser opened, visit $Url"
