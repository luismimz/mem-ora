#!/usr/bin/env bash
# Aplica la instantánea versionada del esquema. Siempre hace copia de seguridad antes (regla 8).
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/backup.sh
docker compose exec -T directus npx directus schema apply --yes /directus/schema/snapshot.json
