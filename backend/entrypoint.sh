#!/bin/sh
set -e

echo "================================================"
echo "  AIGC Video Platform — Backend Starting"
echo "================================================"

# Create data directories
mkdir -p data/uploads data/assets output/videos

# Run database migrations
echo "[1/2] Running database migrations..."
alembic upgrade head
echo "       Migrations complete."

# Start the server
echo "[2/2] Starting API server on port ${PORT:-8000}..."
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
