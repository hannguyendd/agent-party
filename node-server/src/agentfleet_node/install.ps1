# Agent Mesh: install this machine's node on Windows. Served by the team's office server, or attached to a GitHub release:
#   irm http://<office server>:7500/install.ps1 | iex
#   $env:AGENTMESH_SERVER='<host>:7500'; irm https://github.com/<repo>/releases/download/v<version>/install.ps1 | iex
# Installs uv (if missing), the node server (dashboard included) and agentmesh-node, runs the node in the background
# now and at every sign-in, adds Office shortcuts and opens the dashboard so you can join. Run it again to update.
# $env:AGENTMESH_AUTOSTART='off' skips start-at-sign-in; $env:AGENTMESH_NO_OPEN=1 skips the browser;
# $env:AGENTMESH_UPDATE=1 (the in-app Update) keeps the current choice.
$ErrorActionPreference = 'Stop'
$Server = '__SERVER__'      # the office server this script came from (host:port; '' for the GitHub copy)
$Office = '__HOST__'        # prefilled as "Office server" in the setup form
$Wheel = '__WHEEL__'
$Org = '__ORG__'
$GitHub = '__GITHUB__'      # the GitHub release of this version: where to download when the office server can't serve it
# The GitHub copy doesn't know the office server: $env:AGENTMESH_SERVER='host:port' tells it (downloads try it first).
if (-not $Server -and $env:AGENTMESH_SERVER) { $Server = $env:AGENTMESH_SERVER; $Office = ($Server -split ':')[0] }
$Title = if ($Org) { "$Org Office" } else { 'Office' }
$Base = if ($Server) { "http://$Server" } else { '' }
$HomeDir = Join-Path $env:USERPROFILE '.agentfleet'
$Bin = Join-Path $env:USERPROFILE '.local\bin'
$Port = 9100

function Say($m) { Write-Host "==> $m" -ForegroundColor Cyan }
function Warn($m) { Write-Host "!!  $m" -ForegroundColor Yellow }
function Die($m) { Write-Host "xx  $m" -ForegroundColor Red; throw $m }

Say "Installing $Title on this machine"
if (-not $Wheel) { Die "The server has no node package yet. Ask your admin to run 'make server' again (it builds or downloads it)." }
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
# From the office server when there is one; else (or when that fails) from the GitHub release of the same version.
$Got = $false
if ($Base) { try { Invoke-WebRequest "$Base/downloads/$Wheel" -OutFile $WheelPath -UseBasicParsing; $Got = $true } catch {} }
if (-not $Got -and $GitHub) {
  Say "Downloading from GitHub ($($GitHub -replace '^https://github.com/', ''))"
  try { Invoke-WebRequest "$GitHub/$Wheel" -OutFile $WheelPath -UseBasicParsing; $Got = $true } catch {}
}
if (-not $Got) { Die "Could not download the node package. Check this computer can open $(if ($Base) { $Base } else { $GitHub }) in a browser; if not, ask IT to allow it." }
uv tool install --force --reinstall --python 3.12 $WheelPath | Out-Null
$Node = (Get-Command agentfleet-node -ErrorAction SilentlyContinue).Source
if (-not $Node) { $Node = Join-Path $Bin 'agentfleet-node.exe' }
if (-not (Test-Path $Node)) { Die 'agentfleet-node was not installed' }

# 3. agentmesh-node: lets your agents reach other machines.
$Arch = $env:PROCESSOR_ARCHITECTURE.ToLower()   # amd64 | arm64
$AmVersion = '__AMVERSION__'
if (Get-Command agentmesh-node -ErrorAction SilentlyContinue) {
  Say 'agentmesh-node already installed'
} else {
  try {
    if (-not $Base) { throw 'no office server' }
    Invoke-WebRequest "$Base/downloads/agentmesh-node-windows-$Arch.exe" -OutFile (Join-Path $Bin 'agentmesh-node.exe') -UseBasicParsing
    New-Item -ItemType File -Force (Join-Path $HomeDir 'installed-agentmesh-node') | Out-Null
    Say 'Installed agentmesh-node'
  } catch {
    # Not on the office server: take it from the official release instead.
    try {
      $RelArch = if ($Arch -eq 'arm64') { 'arm64' } else { 'x86_64' }
      Say "Downloading agentmesh-node $AmVersion from github.com/google/agentmesh"
      $Zip = Join-Path $Tmp 'am.zip'
      Invoke-WebRequest "https://github.com/google/agentmesh/releases/download/$AmVersion/agentmesh_Windows_$RelArch.zip" -OutFile $Zip -UseBasicParsing
      Expand-Archive $Zip -DestinationPath (Join-Path $Tmp 'am') -Force
      Copy-Item (Join-Path $Tmp 'am\agentmesh-node.exe') (Join-Path $Bin 'agentmesh-node.exe') -Force
      New-Item -ItemType File -Force (Join-Path $HomeDir 'installed-agentmesh-node') | Out-Null
      Say 'Installed agentmesh-node'
    } catch {
      Warn "Could not get agentmesh-node for windows-$Arch. The Office works, but your agents can't reach other machines yet. Ask your admin."
    }
  }
}

# 4. Claude Code runs the agents; it needs a login on this machine.
if (-not (Get-Command claude -ErrorAction SilentlyContinue)) {
  Warn 'Claude Code is not installed. Install it and log in (https://docs.claude.com/claude-code); your agents need it.'
}

# 5. Run it. Starting at sign-in is your choice (off unless you say yes); `agentfleet-node` shows a menu any time.
uv tool update-shell 2>$null | Out-Null   # puts the tool folder on PATH for new terminals
# Runs now and at every sign-in: online/offline is chosen in the app. $env:AGENTMESH_AUTOSTART='off' skips it.
$Auto = $env:AGENTMESH_AUTOSTART
if (-not $env:AGENTMESH_UPDATE -and -not $Auto) { $Auto = 'on' }
if ($Auto -eq 'on') { & $Node autostart on | Out-Null }
elseif ($Auto -eq 'off') { & $Node autostart off | Out-Null; & $Node restart | Out-Null }   # a "no" also undoes an earlier install's
else { & $Node restart | Out-Null }

$Ready = $false
for ($i = 0; $i -lt 40; $i++) {
  try { Invoke-WebRequest "http://127.0.0.1:$Port/api/node" -UseBasicParsing -TimeoutSec 2 | Out-Null; $Ready = $true; break } catch { Start-Sleep -Milliseconds 500 }
}
if (-not $Ready) { Die "The node did not start; see $HomeDir\node.log" }

# 6. Shortcuts (Start menu + Desktop) that open the Office and start the node if it isn't running.
$Shell = New-Object -ComObject WScript.Shell
foreach ($Dir in @("$env:APPDATA\Microsoft\Windows\Start Menu\Programs", [Environment]::GetFolderPath('Desktop'))) {
  $Lnk = $Shell.CreateShortcut((Join-Path $Dir "$Title.lnk"))
  $Lnk.TargetPath = $Node
  $Lnk.Arguments = 'open'
  $Lnk.WindowStyle = 7
  $Lnk.Description = "Open $Title"
  $Lnk.Save()
}

$Url = if ($Office) { "http://127.0.0.1:$Port/?server=$Office" } else { "http://127.0.0.1:$Port/" }
Say "Done. $Title is running at http://127.0.0.1:$Port"
Write-Host "    Open it any time from the '$Title' shortcut. To remove it: Settings > This computer > Uninstall."
if (-not $env:AGENTMESH_NO_OPEN) { Start-Process $Url }
