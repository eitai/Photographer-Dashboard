#!/bin/bash
set -e

if [ ! -d venv ]; then
    echo "ERROR: Run ./install.sh first."
    exit 1
fi

[ -f .env ] || cp .env.example .env

source venv/bin/activate

HOST=$(grep -E '^HOST=' .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "127.0.0.1")
PORT=$(grep -E '^PORT=' .env 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "8001")

HOST=${HOST:-127.0.0.1}
PORT=${PORT:-8001}

echo "Starting Face Recognition Service on ${HOST}:${PORT}"
exec uvicorn main:app --host "$HOST" --port "$PORT" --workers 1
