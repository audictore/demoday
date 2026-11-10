# Abre el puerto del servidor del Demo Day en el Firewall de Windows (todas las redes).
# Solo hace falta una vez. Pide permisos de administrador (aparece el aviso de Windows).
# Uso:  powershell -ExecutionPolicy Bypass -File abrir-firewall.ps1 [-Port 8080]
param([int]$Port = 8080)

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Port $Port"
  exit
}

$name = "Demo Day 2026 (puerto $Port)"
Get-NetFirewallRule -DisplayName $name -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $name -Direction Inbound -Protocol TCP -LocalPort $Port -Action Allow -Profile Any | Out-Null
Write-Host "Listo: el puerto $Port TCP quedó abierto para conexiones entrantes." -ForegroundColor Green
Read-Host 'Pulsa Enter para cerrar'
