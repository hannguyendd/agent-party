# Party Agent: remove this machine's node on Windows. Served by the team's office server:
#   irm http://<office server>:7500/uninstall.ps1 | iex   (or Settings > This computer > Uninstall)
# Stops the node, removes start-at-sign-in, the Office shortcuts and the package (and agentmesh-node if the installer
# put it there). Your agents and chats in %USERPROFILE%\.agentfleet are kept unless you say so.
$HomeDir = Join-Path $env:USERPROFILE '.agentfleet'
$Bin = Join-Path $env:USERPROFILE '.local\bin'
$env:Path = "$Bin;$env:Path"
$Purge = $false
if (Test-Path $HomeDir) {
  $Answer = Read-Host "Also delete your agents, chats and setup in $HomeDir? [y/N]"
  $Purge = $Answer -match '^[yY]'
}
Write-Host '==> Removing the node' -ForegroundColor Cyan
if (Get-Command agentfleet-node -ErrorAction SilentlyContinue) {
  if ($Purge) { agentfleet-node uninstall --purge } else { agentfleet-node uninstall }
} else {
  Unregister-ScheduledTask -TaskName AgentMeshNode -Confirm:$false -ErrorAction SilentlyContinue
  Get-Process agentfleet-node -ErrorAction SilentlyContinue | Stop-Process -Force
  if ($Purge) { Remove-Item $HomeDir -Recurse -Force -ErrorAction SilentlyContinue }
}
Remove-Item "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\*Office.lnk", (Join-Path ([Environment]::GetFolderPath('Desktop')) '*Office.lnk') -ErrorAction SilentlyContinue
if ((Test-Path (Join-Path $HomeDir 'installed-agentmesh-node')) -or $Purge) {
  Get-Process agentmesh-node -ErrorAction SilentlyContinue | Stop-Process -Force
  Remove-Item (Join-Path $Bin 'agentmesh-node.exe'), (Join-Path $HomeDir 'installed-agentmesh-node') -ErrorAction SilentlyContinue
  Write-Host '==> Removed agentmesh-node' -ForegroundColor Cyan
}
if ($Purge) { Write-Host '==> Done. Your data was deleted.' -ForegroundColor Cyan }
else { Write-Host "==> Done. Your data is kept in $HomeDir (delete that folder to remove it)." -ForegroundColor Cyan }
