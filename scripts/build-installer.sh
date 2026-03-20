#!/bin/bash
set -e

echo "=== Building Tauri installer ==="
cd "$(dirname "$0")/../src-tauri"

# Ensure sidecar directory exists
mkdir -p sidecar

cargo tauri build

echo "=== Installer built ==="
