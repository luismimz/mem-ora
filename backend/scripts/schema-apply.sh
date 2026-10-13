#!/usr/bin/env bash
# Aplica la instantánea versionada del esquema. Siempre hace copia de seguridad antes (regla 8).
set -euo pipefail
cd "$(dirname "$0")/.."
./scripts/backup.sh
node --env-file=.env scripts/schema-apply.mjs
