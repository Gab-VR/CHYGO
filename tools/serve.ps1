<#
  A deckbuilder: a tiny local web server for this folder.

  Serves the app at http://localhost:<port>/ to this computer only, then opens it in
  the default browser. Close the window to stop. Works with the PowerShell built into
  Windows 10/11 (5.1) and with PowerShell 7 on any system; nothing to install.

  Keep the port the same between runs: the browser stores your decks per address,
  so a different port would start with an empty app.
#>
param(
  [int]$Port = 47123,
  [switch]$NoBrowser
)
$ErrorActionPreference = 'Stop'

# The app folder is the parent of this script's folder, wherever it was unzipped.
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$sep = [IO.Path]::DirectorySeparatorChar
$rootPrefix = $root.TrimEnd($sep) + $sep

$types = @{
  '.html' = 'text/html; charset=utf-8';  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.css' = 'text/css; charset=utf-8';    '.json' = 'application/json; charset=utf-8'; '.pdf' = 'application/pdf'
  '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.gif' = 'image/gif'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.md' = 'text/plain; charset=utf-8'; '.txt' = 'text/plain; charset=utf-8'
}

# Use the usual port; if another program has it, try the next few.
$listener = $null; $chosen = $null
foreach ($p in $Port..($Port + 9)) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $chosen = $p; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host "Couldn't start: ports $Port to $($Port + 9) are all in use." -ForegroundColor Red; exit 1 }

$url = "http://localhost:$chosen/"
Write-Host ''
Write-Host "  A deckbuilder is running at $url" -ForegroundColor Yellow
if ($chosen -ne $Port) { Write-Host "  (port $Port was busy; your saved decks live at port $Port)" -ForegroundColor DarkYellow }
Write-Host '  Keep this window open while you use it. Close it to stop.'
Write-Host ''
if (-not $NoBrowser) { try { Start-Process $url } catch { Write-Host "  Open $url in your browser." } }

while ($listener.IsListening) {
  try { $ctx = $listener.GetContext() } catch { break }
  $res = $ctx.Response
  try {
    $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
    if ($rel -eq '') { $rel = 'index.html' }
    $full = [IO.Path]::GetFullPath((Join-Path $root $rel))
    # Only files inside the app folder: no "..\" escapes.
    if ($full -ne $root -and -not $full.StartsWith($rootPrefix, [StringComparison]::OrdinalIgnoreCase)) {
      $res.StatusCode = 403
    } else {
      if (Test-Path -LiteralPath $full -PathType Container) { $full = Join-Path $full 'index.html' }
      if (Test-Path -LiteralPath $full -PathType Leaf) {
        $bytes = [IO.File]::ReadAllBytes($full)
        $type = $types[[IO.Path]::GetExtension($full).ToLowerInvariant()]
        if (-not $type) { $type = 'application/octet-stream' }
        $res.ContentType = $type
        $res.Headers.Add('Cache-Control', 'no-cache')
        $res.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne 'HEAD') { $res.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else { $res.StatusCode = 404 }
    }
  } catch {
    try { $res.StatusCode = 500 } catch {}
  } finally {
    try { $res.Close() } catch {}
  }
}
