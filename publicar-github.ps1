# Publica esta carpeta en GitHub (y por tanto en GitHub Pages) usando la API de GitHub con `gh`.
# Sirve cuando `git push` no funciona (p. ej. si Windows bloquea git). Requiere `gh auth login` hecho una vez.
#
# Uso:
#   powershell -ExecutionPolicy Bypass -File publicar-github.ps1                       # sube los cambios
#   powershell -ExecutionPolicy Bypass -File publicar-github.ps1 -Mensaje "Qué cambió" # con mensaje propio
#   powershell -ExecutionPolicy Bypass -File publicar-github.ps1 -SoloVer              # solo lista los cambios
#
# La carpeta del repositorio queda idéntica a esta (archivos nuevos, modificados y borrados).
# NUNCA se sube data.json (contiene el PIN de administrador y los datos del servidor local).
# Un mensaje de VARIAS líneas no puede pasarse con "powershell -File ..." (se parte en argumentos);
# llámalo desde una consola de PowerShell:  & .\publicar-github.ps1 -Mensaje $texto
[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$Repo = 'audictore/demoday',
  [string]$Rama = 'main',
  [string]$Mensaje = '',
  [string]$Autor = 'Alonzo Lara Flores',
  [switch]$SoloVer
)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$utf8 = New-Object Text.UTF8Encoding $false
$excluirArchivos = @('data.json')
$excluirCarpetas = @('.git', '.claude', 'node_modules')
$tmp = Join-Path ([IO.Path]::GetTempPath()) ('ghpub-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $tmp | Out-Null

function Api($method, $path, $obj) {
  $args = @('api', '-X', $method, $path)
  if ($null -ne $obj) {
    $f = Join-Path $tmp ([guid]::NewGuid().ToString('N') + '.json')
    [IO.File]::WriteAllText($f, ($obj | ConvertTo-Json -Depth 10 -Compress), $utf8)
    $args += @('--input', $f)
  }
  # gh escribe los errores en stderr; con 'Stop' PowerShell abortaría sin mostrar a qué ruta pertenece.
  $previo = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
  $out = & gh @args 2>&1 | Out-String
  $codigo = $LASTEXITCODE; $ErrorActionPreference = $previo
  if ($codigo -ne 0) { throw "gh api $method $path falló: $out" }
  if ($out.Trim()) { return ($out | ConvertFrom-Json) }
}

# SHA que Git le asigna a un archivo ("blob <tamaño>\0<contenido>"), para no resubir lo que no cambió.
$sha1 = [Security.Cryptography.SHA1]::Create()
function Git-BlobSha([byte[]]$bytes) {
  $hdr = [Text.Encoding]::ASCII.GetBytes("blob $($bytes.Length)`0")
  $all = New-Object byte[] ($hdr.Length + $bytes.Length)
  [Array]::Copy($hdr, 0, $all, 0, $hdr.Length); [Array]::Copy($bytes, 0, $all, $hdr.Length, $bytes.Length)
  return (($sha1.ComputeHash($all) | ForEach-Object { $_.ToString('x2') }) -join '')
}

try {
  # 1) Estado remoto
  $head = (Api 'GET' "repos/$Repo/git/ref/heads/$Rama").object.sha
  $treeSha = (Api 'GET' "repos/$Repo/git/commits/$head").tree.sha
  $remote = @{}
  foreach ($e in (Api 'GET' "repos/$Repo/git/trees/${treeSha}?recursive=1").tree) { if ($e.type -eq 'blob') { $remote[$e.path] = $e.sha } }

  # 2) Archivos locales
  $local = @{}
  foreach ($file in Get-ChildItem $root -Recurse -File -Force) {
    $rel = $file.FullName.Substring($root.Length + 1).Replace('\', '/')
    $partes = $rel.Split('/')
    if ($partes.Length -gt 1 -and ($partes[0..($partes.Length - 2)] | Where-Object { $excluirCarpetas -contains $_ })) { continue }
    if ($excluirArchivos -contains $partes[-1]) { continue }
    $bytes = [IO.File]::ReadAllBytes($file.FullName)
    $local[$rel] = @{ path = $file.FullName; bytes = $bytes; sha = (Git-BlobSha $bytes) }
  }

  # 3) Diferencias
  $nuevos = @($local.Keys | Where-Object { -not $remote.ContainsKey($_) })
  $cambiados = @($local.Keys | Where-Object { $remote.ContainsKey($_) -and $remote[$_] -ne $local[$_].sha })
  $borrados = @($remote.Keys | Where-Object { -not $local.ContainsKey($_) })
  if (-not ($nuevos.Count + $cambiados.Count + $borrados.Count)) { Write-Host 'Sin cambios: GitHub ya está al día.' -ForegroundColor Green; return }
  $nuevos | Sort-Object | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green }
  $cambiados | Sort-Object | ForEach-Object { Write-Host "  ~ $_" -ForegroundColor Yellow }
  $borrados | Sort-Object | ForEach-Object { Write-Host "  - $_" -ForegroundColor Red }
  if ($SoloVer) { Write-Host 'Modo -SoloVer: no se subió nada.'; return }

  # 4) Subir lo nuevo/modificado, armar el árbol completo y avanzar la rama
  $entradas = @()
  foreach ($rel in ($local.Keys | Sort-Object)) {
    $sha = $local[$rel].sha
    if ($nuevos -contains $rel -or $cambiados -contains $rel) {
      $sha = (Api 'POST' "repos/$Repo/git/blobs" @{ content = [Convert]::ToBase64String($local[$rel].bytes); encoding = 'base64' }).sha
    }
    $entradas += @{ path = $rel; mode = '100644'; type = 'blob'; sha = $sha }
  }
  $tree = Api 'POST' "repos/$Repo/git/trees" @{ tree = $entradas }
  if (-not $Mensaje) { $Mensaje = 'Actualización ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') }
  $login = (Api 'GET' 'user').login
  $commit = Api 'POST' "repos/$Repo/git/commits" @{ message = $Mensaje; tree = $tree.sha; parents = @($head); author = @{ name = $Autor; email = "$login@users.noreply.github.com" } }
  Api 'PATCH' "repos/$Repo/git/refs/heads/$Rama" @{ sha = $commit.sha } | Out-Null
  Write-Host "Publicado: https://github.com/$Repo/commit/$($commit.sha.Substring(0, 7))" -ForegroundColor Green
  Write-Host "GitHub Pages se actualiza en ~1 minuto: https://$($login).github.io/$($Repo.Split('/')[1])/"
} finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
