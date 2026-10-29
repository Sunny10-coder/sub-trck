$ErrorActionPreference = 'Stop'
$project = Split-Path -Parent $MyInvocation.MyCommand.Path
$source = Join-Path $project 'frontend'
$stage = 'C:\s\frontend'
New-Item -ItemType Directory -Path $stage -Force | Out-Null
& robocopy $source $stage /E /XD node_modules .git .cxx build .gradle .expo /NFL /NDL /NJH /NJS /NP /R:1 /W:1
if ($LASTEXITCODE -ge 8) { throw 'Source staging failed' }
Push-Location $stage
try {
 & node node_modules/typescript/bin/tsc --noEmit
 if ($LASTEXITCODE -ne 0) { throw 'Type check failed' }
 Push-Location android
 try { & .\gradlew.bat assembleRelease --offline --console=plain; if ($LASTEXITCODE -ne 0) { throw 'Android build failed' } } finally { Pop-Location }
 $apk = Join-Path $stage 'android\app\build\outputs\apk\release\app-release.apk'
 Copy-Item -LiteralPath $apk -Destination (Join-Path $project 'SubMind-Paper-1.1.0.apk') -Force
 Get-FileHash -LiteralPath (Join-Path $project 'SubMind-Paper-1.1.0.apk') -Algorithm SHA256
} finally { Pop-Location }
