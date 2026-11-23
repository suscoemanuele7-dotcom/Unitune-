#!/usr/bin/env bash
# Prova migrazione + policy RLS su un Postgres usa-e-getta (serve Docker).
set -euo pipefail
cd "$(dirname "$0")/.."
NAME=unitune-db-test
docker rm -f "$NAME" >/dev/null 2>&1 || true
docker run -d --name "$NAME" -e POSTGRES_PASSWORD=test postgres:17-alpine >/dev/null
trap 'docker rm -f "$NAME" >/dev/null' EXIT
until docker exec "$NAME" pg_isready -U postgres >/dev/null 2>&1; do sleep 1; done
sleep 1
run() { docker exec -i "$NAME" psql -U postgres -v ON_ERROR_STOP=1 -q -t < "$1"; }
run tests/00_supabase_stub.sql
for f in migrations/*.sql; do run "$f"; done
run tests/rls_test.sql 2>&1 | grep -E "NOTICE|ERROR" | sed 's/^.*NOTICE:  /  /'
echo "Tutti i test del database sono passati."
