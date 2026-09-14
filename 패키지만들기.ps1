[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 버전 읽기 (package.json)
$pkg = Get-Content "$scriptDir\package.json" -Raw | ConvertFrom-Json
$version = $pkg.version

$outName = "update_v$version"
$outDir  = "$scriptDir\$outName"

Write-Host "=== Building update package v$version ===" -ForegroundColor Cyan

# 기존 폴더 제거
if (Test-Path $outDir) { Remove-Item $outDir -Recurse -Force }
New-Item -ItemType Directory -Path $outDir | Out-Null

# 소스 파일 복사
Write-Host "Copying src..." -ForegroundColor Gray
Copy-Item "$scriptDir\src" "$outDir\src" -Recurse -Force
Copy-Item "$scriptDir\main.js" "$outDir\main.js" -Force
Copy-Item "$scriptDir\preload.js" "$outDir\preload.js" -Force

# 업데이트 스크립트 복사
Copy-Item "$scriptDir\update.ps1" "$outDir\update.ps1" -Force
Copy-Item "$scriptDir\업데이트.bat" "$outDir\업데이트.bat" -Force

# ZIP 압축
$zipPath = "$scriptDir\${outName}.zip"
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
Compress-Archive -Path "$outDir\*" -DestinationPath $zipPath -Force

# 임시 폴더 제거
Remove-Item $outDir -Recurse -Force

Write-Host ""
Write-Host "Done! Package created:" -ForegroundColor Green
Write-Host "  $zipPath" -ForegroundColor Yellow
Write-Host ""
Write-Host "Share this ZIP file. The other PC just needs to:" -ForegroundColor Gray
Write-Host "  1. Unzip anywhere" -ForegroundColor Gray
Write-Host "  2. Run [업데이트.bat]" -ForegroundColor Gray

Start-Sleep -Seconds 1
explorer $scriptDir
