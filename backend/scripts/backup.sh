#!/usr/bin/env bash
# Copia de seguridad de la base de datos local antes de cualquier cambio de esquema (regla 8).
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p backups
stamp=$(date +%Y%m%d-%H%M%S)
docker compose exec -T db pg_dump -U memora -d memora --no-owner | gzip > "backups/memora-$stamp.sql.gz"
echo "Copia guardada en backend/backups/memora-$stamp.sql.gz ($(du -h "backups/memora-$stamp.sql.gz" | cut -f1))"
