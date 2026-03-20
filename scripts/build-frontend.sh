#!/bin/bash
set -e

echo "=== Building frontend ==="
cd "$(dirname "$0")/../frontend"
npm run build

# Copy dist to backend static directory for single-port serving
STATIC_DIR="../backend/static"
rm -rf "$STATIC_DIR"
cp -r dist "$STATIC_DIR"

echo "=== Frontend built → backend/static/ ==="
