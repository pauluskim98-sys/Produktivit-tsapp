param([switch]$RestartOnly, [switch]$OpenIfClosed)
$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$node = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
if (!(Test-Path -LiteralPath $node)) { $node = (Get-Command node.exe).Source }
$next = Join-Path $root 'node_modules\next\dist\bin\next'
if (!(Test-Path -LiteralPath $next)) { throw 'Die Lifemap-Abhaengigkeiten fehlen.' }

Push-Location -LiteralPath $root
try {
  if (!$RestartOnly) {
    & $node $next build
    if ($LASTEXITCODE -ne 0) { throw 'Build fehlgeschlagen. Der laufende Server wird nicht neu gestartet.' }
  }
  if (!(Test-Path -LiteralPath (Join-Path $root '.next\BUILD_ID'))) { throw 'Es gibt noch keinen fertigen Lifemap-Build.' }
  $listener = Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($listener) {
    $server = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
    $page = & curl.exe --noproxy '*' -fsS --max-time 4 http://127.0.0.1:3000/lifemap
    if ($server.ExecutablePath -ne $node -or $server.CommandLine -notmatch 'next[/\\]dist[/\\]bin[/\\]next.*start.*127\.0\.0\.1.*3000' -or ($page -join "`n") -notmatch '<title>Lifemap') {
      throw 'Der Prozess auf Anschluss 3000 ist nicht eindeutig Lifemap. Er bleibt offen.'
    }
    Stop-Process -Id $server.ProcessId
  }
  $starter = Join-Path $root 'Start-Lifemap.ps1'
  & $starter -CheckOnly
  if ($OpenIfClosed -and !(Get-Process Lifemap -ErrorAction SilentlyContinue)) { & $starter }
} finally {
  Pop-Location
}
