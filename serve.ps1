# Servidor de red local del Demo Day (sin Node, sin Python, sin internet).
# Sirve la página y guarda evaluaciones/votos en data.json para que TODOS los celulares
# conectados a la misma red (Wi-Fi o "Zona con cobertura inalámbrica" de Windows) compartan los datos.
#
# Uso:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080] [-AdminPin 123456]
param([int]$Port = 8080, [string]$AdminPin = '')

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Web.Extensions
$ser = New-Object System.Web.Script.Serialization.JavaScriptSerializer
$ser.MaxJsonLength = 104857600
$utf8 = New-Object System.Text.UTF8Encoding $false
$root = $PSScriptRoot
$dataFile = Join-Path $root 'data.json'
$blocked = @('data.json', 'serve.ps1')

$db = @{ teams = @{}; evals = @{}; votes = @{}; settings = @{}; pin = ''; rev = 0 }
if (Test-Path $dataFile) {
  try {
    $o = $ser.DeserializeObject([IO.File]::ReadAllText($dataFile, $utf8))
    foreach ($c in 'teams', 'evals', 'votes', 'settings') { if ($o[$c]) { foreach ($k in $o[$c].Keys) { $db[$c][$k] = $o[$c][$k] } } }
    if ($o['pin']) { $db.pin = [string]$o['pin'] }
    if ($o['rev']) { $db.rev = [int]$o['rev'] }
  } catch { Write-Host "No se pudo leer data.json: $($_.Exception.Message)" -ForegroundColor Yellow }
}
if ($AdminPin) { $db.pin = $AdminPin }
elseif (-not $db.pin) { $db.pin = (Get-Random -Minimum 100000 -Maximum 999999).ToString() }

function Save-Db {
  $db.rev++
  $json = $ser.Serialize(@{ teams = $db.teams; evals = $db.evals; votes = $db.votes; settings = $db.settings; pin = $db.pin; rev = $db.rev })
  [IO.File]::WriteAllText($dataFile, $json, $utf8)
}
if (-not (Test-Path $dataFile) -or $AdminPin) { Save-Db }   # el PIN se conserva entre reinicios

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.csv' = 'text/csv; charset=utf-8'; '.json' = 'application/json'; '.png' = 'image/png'; '.svg' = 'image/svg+xml'
  '.ico' = 'image/x-icon'; '.webp' = 'image/webp'
}
$statusText = @{ 200 = 'OK'; 204 = 'No Content'; 400 = 'Bad Request'; 401 = 'Unauthorized'; 403 = 'Forbidden'; 404 = 'Not Found'; 413 = 'Payload Too Large'; 500 = 'Internal Server Error' }

function Send($stream, [int]$code, [string]$ctype, [byte[]]$bytes) {
  $head = "HTTP/1.1 $code $($statusText[$code])`r`nContent-Type: $ctype`r`nContent-Length: $($bytes.Length)`r`nCache-Control: no-store`r`nConnection: close`r`n`r`n"
  $hb = [Text.Encoding]::ASCII.GetBytes($head)
  $stream.Write($hb, 0, $hb.Length)
  if ($bytes.Length -gt 0) { $stream.Write($bytes, 0, $bytes.Length) }
}
function SendJson($stream, [int]$code, $obj) { Send $stream $code 'application/json; charset=utf-8' ($utf8.GetBytes($ser.Serialize($obj))) }
function Fail($stream, [int]$code, [string]$msg) { SendJson $stream $code @{ error = $msg } }

function Read-Request($stream) {
  $buf = New-Object byte[] 8192
  $ms = New-Object IO.MemoryStream
  $headEnd = -1
  while ($headEnd -lt 0) {
    $n = $stream.Read($buf, 0, $buf.Length)
    if ($n -le 0) { return $null }
    $ms.Write($buf, 0, $n)
    $headEnd = [Text.Encoding]::ASCII.GetString($ms.ToArray()).IndexOf("`r`n`r`n")
    if ($ms.Length -gt 65536 -and $headEnd -lt 0) { return $null }
  }
  $all = $ms.ToArray()
  $lines = [Text.Encoding]::ASCII.GetString($all, 0, $headEnd).Split("`r`n", [StringSplitOptions]::RemoveEmptyEntries)
  $first = $lines[0].Split(' ')
  $h = @{}
  foreach ($l in $lines | Select-Object -Skip 1) { $i = $l.IndexOf(':'); if ($i -gt 0) { $h[$l.Substring(0, $i).Trim().ToLower()] = $l.Substring($i + 1).Trim() } }
  $len = 0; if ($h['content-length']) { $len = [int]$h['content-length'] }
  if ($len -gt 2097152) { return @{ tooBig = $true } }
  $body = New-Object IO.MemoryStream
  $have = $all.Length - ($headEnd + 4)
  if ($have -gt 0) { $body.Write($all, $headEnd + 4, [Math]::Min($have, $len)) }
  while ($body.Length -lt $len) {
    $n = $stream.Read($buf, 0, $buf.Length); if ($n -le 0) { break }
    $body.Write($buf, 0, $n)
  }
  $target = $first[1]; $q = ''
  $qi = $target.IndexOf('?'); if ($qi -ge 0) { $q = $target.Substring($qi + 1); $target = $target.Substring(0, $qi) }
  return @{ method = $first[0].ToUpper(); path = [Uri]::UnescapeDataString($target); query = $q; headers = $h; body = $utf8.GetString($body.ToArray()) }
}

function Test-Id($id) { return ($id -match '^[A-Za-z0-9_\-]{1,200}$') }
function Is-Closed($key) { return ($db.settings.ContainsKey($key) -and $db.settings[$key] -eq $false) }
function Get-Ips {
  $ips = [Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces() |
    Where-Object { $_.OperationalStatus -eq 'Up' -and $_.NetworkInterfaceType -ne 'Loopback' } |
    ForEach-Object { $_.GetIPProperties().UnicastAddresses } |
    Where-Object { $_.Address.AddressFamily -eq 'InterNetwork' -and -not $_.Address.ToString().StartsWith('169.254') } |
    ForEach-Object { $_.Address.ToString() }
  return [string[]]@($ips | Sort-Object { -not $_.StartsWith('192.168.') })
}

function Handle-Api($stream, $req, $segs) {
  $m = $req.method; $res = $segs[0]; $id = $segs[1]
  $isAdmin = ($req.headers['x-admin-pin'] -eq $db.pin)
  $needAdmin = { if (-not $isAdmin) { Fail $stream 401 'PIN de administrador incorrecto'; return $true }; return $false }

  switch ("$m $res") {
    'GET ping' { SendJson $stream 200 @{ ok = $true; ips = @(Get-Ips); port = $Port }; return }
    'GET auth' { if (& $needAdmin) { return }; SendJson $stream 200 @{ ok = $true }; return }
    'GET settings' { SendJson $stream 200 $db.settings; return }
    'GET teams' {
      if ($id) { if ($db.teams.ContainsKey($id)) { SendJson $stream 200 $db.teams[$id] } else { Fail $stream 404 'No existe' }; return }
      SendJson $stream 200 @($db.teams.Values); return
    }
    'GET eval' { if ($db.evals.ContainsKey($id)) { SendJson $stream 200 $db.evals[$id] } else { Fail $stream 404 'No existe' }; return }
    'GET vote' { if ($db.votes.ContainsKey($id)) { SendJson $stream 200 $db.votes[$id] } else { Fail $stream 404 'No existe' }; return }
    'GET state' {
      if (& $needAdmin) { return }
      $since = -1; if ($req.query -match 'since=(-?\d+)') { $since = [int]$Matches[1] }
      if ($since -eq $db.rev) { SendJson $stream 200 @{ rev = $db.rev; changed = $false }; return }
      SendJson $stream 200 @{ rev = $db.rev; changed = $true; teams = @($db.teams.Values); evals = @($db.evals.Values); votes = @($db.votes.Values); settings = $db.settings }; return
    }
    'PUT eval' {
      if (-not (Test-Id $id)) { Fail $stream 400 'Id inválido'; return }
      if (Is-Closed 'open') { Fail $stream 403 'Las evaluaciones están cerradas'; return }
      $ev = $ser.DeserializeObject($req.body)
      if ($ev['id'] -ne $id -or -not $db.teams.ContainsKey([string]$ev['teamId'])) { Fail $stream 400 'Evaluación inválida'; return }
      $t = $ev['total']; if (-not ($t -is [int] -or $t -is [decimal] -or $t -is [double]) -or $t -lt 0 -or $t -gt 100) { Fail $stream 400 'Total inválido'; return }
      if (-not $ev['judgeName'] -or -not $ev['scores']) { Fail $stream 400 'Faltan datos'; return }
      $db.evals[$id] = $ev; Save-Db; SendJson $stream 200 @{ ok = $true }; return
    }
    'PUT vote' {
      if (-not (Test-Id $id) -or $id.Length -lt 8 -or $id.Length -gt 64) { Fail $stream 400 'Id inválido'; return }
      if (Is-Closed 'votingOpen') { Fail $stream 403 'La votación está cerrada'; return }
      $v = $ser.DeserializeObject($req.body)
      if ($v['voterId'] -ne $id -or -not $db.teams.ContainsKey([string]$v['teamId'])) { Fail $stream 400 'Voto inválido'; return }
      $db.votes[$id] = $v; Save-Db; SendJson $stream 200 @{ ok = $true }; return
    }
    'PUT teams' {
      if (& $needAdmin) { return }
      if (-not (Test-Id $id)) { Fail $stream 400 'Id inválido'; return }
      $db.teams[$id] = $ser.DeserializeObject($req.body); Save-Db; SendJson $stream 200 @{ ok = $true }; return
    }
    'POST teams' {
      if (& $needAdmin) { return }
      foreach ($t in $ser.DeserializeObject($req.body)) { if (Test-Id ([string]$t['id'])) { $db.teams[[string]$t['id']] = $t } }
      Save-Db; SendJson $stream 200 @{ ok = $true }; return
    }
    'DELETE teams' { if (& $needAdmin) { return }; $db.teams.Remove($id); Save-Db; SendJson $stream 200 @{ ok = $true }; return }
    'DELETE eval' { if (& $needAdmin) { return }; $db.evals.Remove($id); Save-Db; SendJson $stream 200 @{ ok = $true }; return }
    'PUT settings' {
      if (& $needAdmin) { return }
      $s = $ser.DeserializeObject($req.body); foreach ($k in $s.Keys) { $db.settings[$k] = $s[$k] }
      Save-Db; SendJson $stream 200 @{ ok = $true }; return
    }
    'POST reset' {
      if (& $needAdmin) { return }
      $db.teams = @{}; $db.evals = @{}; $db.votes = @{}; $db.settings = @{}; Save-Db; SendJson $stream 200 @{ ok = $true }; return
    }
  }
  Fail $stream 404 'Ruta no encontrada'
}

function Handle-Static($stream, $req) {
  if ($req.method -ne 'GET') { Fail $stream 404 'No encontrado'; return }
  $rel = $req.path.TrimStart('/')
  if ($rel -eq '') { $rel = 'index.html' }
  $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
  if (-not $full.StartsWith($root) -or ($blocked -contains [IO.Path]::GetFileName($full).ToLower()) -or -not (Test-Path $full -PathType Leaf)) {
    Send $stream 404 'text/plain; charset=utf-8' ($utf8.GetBytes('No encontrado')); return
  }
  $ext = [IO.Path]::GetExtension($full).ToLower()
  $ct = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
  Send $stream 200 $ct ([IO.File]::ReadAllBytes($full))
}

$listener = New-Object System.Net.Sockets.TcpListener([Net.IPAddress]::Any, $Port)
$listener.Start()
Write-Host ''
Write-Host '  Demo Day 2026 · servidor de red local' -ForegroundColor Cyan
Write-Host "  Administrador (en esta computadora):  http://localhost:$Port/#/admin"
Write-Host '  Direcciones para los celulares (misma red):'
foreach ($ip in Get-Ips) { Write-Host "      http://${ip}:$Port/" -ForegroundColor Green }
Write-Host "  PIN de administrador: $($db.pin)" -ForegroundColor Yellow
Write-Host '  (Si Windows pregunta por el Firewall, permite el acceso en redes privadas.  Ctrl+C para detener.)'
Write-Host ''

while ($true) {
  if (-not $listener.Pending()) { Start-Sleep -Milliseconds 15; continue }
  $client = $listener.AcceptTcpClient()
  try {
    $client.ReceiveTimeout = 4000; $client.SendTimeout = 4000
    $stream = $client.GetStream()
    $req = Read-Request $stream
    if ($null -eq $req) { continue }
    if ($req.tooBig) { Fail $stream 413 'Solicitud demasiado grande'; continue }
    $segs = @($req.path.Trim('/').Split('/'))
    try {
      if ($segs[0] -eq 'api') { Handle-Api $stream $req @($segs | Select-Object -Skip 1) } else { Handle-Static $stream $req }
    } catch { try { Fail $stream 500 $_.Exception.Message } catch { } }
  } catch { } finally { try { $client.Close() } catch { } }
}
