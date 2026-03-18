#!/bin/bash
cd "$(dirname "$0")"

echo "========================================"
echo "  Treez Sync Middleware"
echo "  Folder: $(pwd)"
echo "========================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
  echo "ERROR: Node.js is not installed."
  echo "Please install Node.js from https://nodejs.org/"
  echo "  (or: brew install node)"
  exit 1
fi

echo "Node.js found: $(node -v)"
echo ""

# Install dependencies if node_modules missing
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies - first run only..."
  npm install
  if [ $? -ne 0 ]; then
    echo "Failed to install dependencies."
    exit 1
  fi
  echo ""
fi

# Build the app
echo "Building..."
npm run build
if [ $? -ne 0 ]; then
  echo "Build failed."
  exit 1
fi
echo ""

echo "========================================"
echo "  App is starting at http://localhost:3000"
echo "  Press Ctrl+C to stop the app"
echo "========================================"
echo ""

npm start
