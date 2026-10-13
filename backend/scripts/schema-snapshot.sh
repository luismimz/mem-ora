#!/usr/bin/env bash
# Exporta el esquema actual a schema/snapshot.json (se versiona en git).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose exec -T directus node /directus/cli.js schema snapshot --yes --format json /tmp/snapshot.json >/dev/null
docker compose cp directus:/tmp/snapshot.json schema/snapshot.json
echo "Instantánea guardada en backend/schema/snapshot.json"
