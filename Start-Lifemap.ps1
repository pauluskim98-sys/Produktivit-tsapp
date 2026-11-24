param([switch]$CheckOnly)
$ErrorActionPreference = 'Stop'
$projectPath = $PSScriptRoot
$localUrl = 'http://127.0.0.1:3000/lifemap'

Add-Type -AssemblyName System.Net.Http
$handler = New-Object System.Net.Http.HttpClientHandler
$handler.UseProxy = $false
$handler.AllowAutoRedirect = $false
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromSeconds(2)
function Test-Lifemap {
  try {
    $response = $client.GetAsync($localUrl).GetAwaiter().GetResult()
    try {
      $page = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
      if ($response.IsSuccessStatusCode -and $page -match '<title>Lifemap') { return 'ready' }
      return 'occupied'
    } finally { $response.Dispose() }
  } catch { return 'unavailable' }
}

$launchMutex = New-Object System.Threading.Mutex($false, 'Local\LifemapDesktopStartup')
$launchLockHeld = $false
try {
  try { $launchLockHeld = $launchMutex.WaitOne([TimeSpan]::FromSeconds(75)) }
  catch [System.Threading.AbandonedMutexException] { $launchLockHeld = $true }
  if (!$launchLockHeld) { throw 'Lifemap wird bereits gestartet. Bitte versuche es gleich erneut.' }
  $status = Test-Lifemap
  if ($status -eq 'occupied') { throw 'Der lokale Anschluss 3000 wird schon von einem anderen Programm verwendet.' }
  if ($status -ne 'ready') {
    $runtime = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
    if (!(Test-Path -LiteralPath $runtime)) { $runtime = (Get-Command node.exe -ErrorAction Stop).Source }
    $version = & $runtime --version
    if ($LASTEXITCODE -ne 0 -or $version -notmatch '^v(\d+)\.' -or [int]$Matches[1] -lt 24) { throw 'Lifemap braucht Node.js 24 oder neuer.' }
    if (!(Test-Path -LiteralPath (Join-Path $projectPath 'node_modules\next\dist\bin\next'))) { throw 'Die Programmdateien fehlen. Bitte in Codex neu einrichten lassen.' }
    $desktopLogs = Join-Path $projectPath 'data\desktop'
    [IO.Directory]::CreateDirectory($desktopLogs) | Out-Null
    if (!(Test-Path -LiteralPath (Join-Path $projectPath '.next\BUILD_ID'))) {
      $builder = Start-Process -FilePath $runtime -ArgumentList 'node_modules/next/dist/bin/next','build' -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $desktopLogs 'build.log') -RedirectStandardError (Join-Path $desktopLogs 'build-error.log') -Wait -PassThru
      if ($builder.ExitCode -ne 0) { throw 'Lifemap konnte nicht vorbereitet werden. Details stehen unter data\desktop\build-error.log.' }
    }
    $server = Start-Process -FilePath $runtime -ArgumentList 'node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000' -WorkingDirectory $projectPath -WindowStyle Hidden -RedirectStandardOutput (Join-Path $desktopLogs 'server.log') -RedirectStandardError (Join-Path $desktopLogs 'server-error.log') -PassThru
    $startupDeadline = [DateTime]::UtcNow.AddSeconds(60)
    do {
      $status = Test-Lifemap
      if ($status -eq 'ready' -or $status -eq 'occupied') { break }
      if ($server.HasExited) {
        Start-Sleep -Milliseconds 500
        $status = Test-Lifemap
        break
      }
      Start-Sleep -Milliseconds 350
    } while ([DateTime]::UtcNow -lt $startupDeadline)
    if ($status -eq 'occupied') { throw 'Der lokale Anschluss 3000 wird schon von einem anderen Programm verwendet.' }
    if ($status -ne 'ready') { throw 'Lifemap konnte nicht starten. Details stehen unter data\desktop\server-error.log.' }
  }
  if ($CheckOnly) { Write-Output 'Lifemap ist erreichbar.'; return }
  $window = @('desktop/bin/publish','desktop/bin/publish-staged') |
    ForEach-Object { Join-Path $projectPath $_ } |
    Where-Object { (Test-Path -LiteralPath (Join-Path $_ 'Lifemap.exe')) -and (Test-Path -LiteralPath (Join-Path $_ 'Lifemap.dll')) } |
    Sort-Object { (Get-Item -LiteralPath (Join-Path $_ 'Lifemap.dll')).LastWriteTimeUtc } -Descending |
    Select-Object -First 1 |
    ForEach-Object { Join-Path $_ 'Lifemap.exe' }
  if (!$window) { throw 'Das Windows-Fenster fehlt. Bitte in Codex neu bauen lassen.' }
  Start-Process -FilePath $window -WorkingDirectory $projectPath -WindowStyle Normal
} catch {
  if ($CheckOnly) { throw }
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Lifemap') | Out-Null
  exit 1
} finally {
  if ($launchLockHeld) { $launchMutex.ReleaseMutex() }
  $launchMutex.Dispose()
  $client.Dispose()
}
