#!/bin/bash
set -e

echo "=== Building backend with PyInstaller ==="
cd "$(dirname "$0")/../backend"

# Activate venv if exists
if [ -f .venv/bin/activate ]; then
    source .venv/bin/activate
fi

# Install PyInstaller if needed
pip install pyinstaller --quiet

# Build
pyinstaller build.spec --clean --noconfirm

# Copy to Tauri sidecar directory
SIDECAR_DIR="../src-tauri/sidecar"
mkdir -p "$SIDECAR_DIR"
cp dist/backend "$SIDECAR_DIR/backend"

echo "=== Backend built successfully → src-tauri/sidecar/backend ==="
