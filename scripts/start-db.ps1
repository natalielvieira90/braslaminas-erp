$ErrorActionPreference = "Stop"

$PG_BIN = "C:\Program Files\PostgreSQL\17\bin"
$PGDATA = Join-Path $env:LOCALAPPDATA "braslaminas-pgdata"
$PG_LOG = Join-Path $env:LOCALAPPDATA "braslaminas-pg.log"
$PGPORT = 5433
$PGPASSWORD_FILE = Join-Path $env:LOCALAPPDATA "braslaminas-pgpw.txt"

if (!(Test-Path $PG_BIN)) {
    Write-Error "PostgreSQL não encontrado em $PG_BIN"
}

if (-not (Test-Path $PGDATA)) {
    Set-Content -Path $PGPASSWORD_FILE -Value "postgres" -NoNewline
    Write-Host "Criando instância PostgreSQL do projeto..."
    & "$PG_BIN\initdb.exe" -D $PGDATA -U postgres -A scram-sha-256 --pwfile=$PGPASSWORD_FILE -E UTF8 | Out-Host
}

if (-not (Get-NetTCPConnection -State Listen -LocalPort $PGPORT -ErrorAction SilentlyContinue)) {
    Write-Host "Iniciando PostgreSQL na porta $PGPORT..."
    & "$PG_BIN\pg_ctl.exe" -D $PGDATA -o "-p $PGPORT" -l $PG_LOG start | Out-Host
} else {
    Write-Host "PostgreSQL já está rodando na porta $PGPORT."
}

$env:PGPASSWORD = "postgres"
& "$PG_BIN\psql.exe" -h 127.0.0.1 -p $PGPORT -U postgres -lqt | Select-String "braslaminas" | Out-Null
if ($LASTEXITCODE -ne 0 -or $? -eq $false) {
    & "$PG_BIN\createdb.exe" -h 127.0.0.1 -p $PGPORT -U postgres braslaminas | Out-Host
    Write-Host "Banco 'braslaminas' criado."
} else {
    Write-Host "Banco 'braslaminas' já existe."
}
