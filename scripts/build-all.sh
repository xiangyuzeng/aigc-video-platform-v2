#!/bin/bash
set -e

SCRIPTS_DIR="$(dirname "$0")"

echo "========================================="
echo "  肯葳科技电商视频发布平台 — Full Build"
echo "========================================="

# Step 1: Build frontend
bash "$SCRIPTS_DIR/build-frontend.sh"

# Step 2: Build backend (PyInstaller)
bash "$SCRIPTS_DIR/build-backend.sh"

# Step 3: Build Tauri installer
bash "$SCRIPTS_DIR/build-installer.sh"

echo "========================================="
echo "  Build complete!"
echo "========================================="
