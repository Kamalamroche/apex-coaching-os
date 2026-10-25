#!/usr/bin/env bash
# Applies the schema to an empty Postgres database and runs the RLS checks.
# Usage: DATABASE_URL=postgres://postgres@localhost:5432/postgres supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql_run() { psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q "$@"; }
psql_run -f tests/auth_stub.sql
for f in migrations/*.sql; do psql_run -f "$f"; done
psql_run -f seed.sql
psql_run -f tests/rls_test.sql
