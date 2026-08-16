$PG_BIN = "C:\Program Files\PostgreSQL\17\bin"
$PGDATA = Join-Path $env:LOCALAPPDATA "braslaminas-pgdata"

if (Test-Path $PGDATA) {
    & "$PG_BIN\pg_ctl.exe" -D $PGDATA stop -m fast
    Write-Host "PostgreSQL do projeto parado."
} else {
    Write-Host "Instância não encontrada."
}
