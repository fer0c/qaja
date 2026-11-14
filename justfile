set dotenv-load := false

# Levanta FastAPI (:8000) y Next.js (:3000) en paralelo
dev:
    #!/usr/bin/env bash
    set -euo pipefail
    trap 'kill 0' EXIT
    (cd api && uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000) &
    (cd web && API_INTERNAL_URL=http://127.0.0.1:8000 pnpm run dev) &
    wait

dev-api:
    cd api && uv run uvicorn main:app --reload --host 127.0.0.1 --port 8000

dev-web:
    cd web && API_INTERNAL_URL=http://127.0.0.1:8000 pnpm run dev

build:
    cd web && pnpm run build

check:
    cd api && uv run pytest
    cd web && pnpm run typecheck
