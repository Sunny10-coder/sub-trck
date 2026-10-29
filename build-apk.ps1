# SubMind APK Build Automation Script
# Solves Windows MAX_PATH (260-character) limitation during C++ CMake/Ninja compilation

$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$FrontendDir = Join-Path $ProjectRoot "frontend"
$ShortDir = "C:\s\frontend"

Write-Host "==> [1/3] Mirroring frontend source to short path ($ShortDir)..." -ForegroundColor Cyan
New-Item -ItemType Directory -Path $ShortDir -Force | Out-Null
& robocopy $FrontendDir $ShortDir /E /XD ".cxx" "build" ".gradle" ".metro-cache" /MT:16 /NFL /NDL /NP /R:1 /W:1 | Out-Null
& robocopy (Join-Path $FrontendDir "node_modules") (Join-Path $ShortDir "node_modules") /E /XD ".cxx" /MT:16 /NFL /NDL /NP /R:1 /W:1 | Out-Null

Write-Host "==> [2/3] Compiling Release APK via Gradle..." -ForegroundColor Cyan
Push-Location "$ShortDir\android"
try {
    .\gradlew.bat assembleRelease
} finally {
    Pop-Location
}

$ApkSource = "$ShortDir\android\app\build\outputs\apk\release\app-release.apk"
if (Test-Path $ApkSource) {
    Write-Host "==> [3/3] Copying APK to project directory..." -ForegroundColor Green
    $Dest1 = Join-Path $ProjectRoot "SubMind-Latest.apk"
    Copy-Item $ApkSource $Dest1 -Force
    Write-Host "BUILD SUCCESSFUL! APK generated at:" -ForegroundColor Green
    Write-Host "  $Dest1" -ForegroundColor Yellow
} else {
    Write-Error "APK file was not found at $ApkSource"
}
