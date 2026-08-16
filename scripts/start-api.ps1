$BACKEND_DIR = Join-Path $PSScriptRoot "..\backend"
$env:Path = "$env:ProgramFiles\nodejs;$env:Path"

if (Get-NetTCPConnection -State Listen -LocalPort 3000 -ErrorAction SilentlyContinue) {
    Write-Host "API já está rodando na porta 3000."
    exit 0
}

Set-Location $BACKEND_DIR
Write-Host "Iniciando API BrasLâminas em http://localhost:3000"
& node src/server.js
