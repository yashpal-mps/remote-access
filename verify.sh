#!/bin/bash

# Capture It - Verification Script
# Checks if everything is set up correctly

echo "======================================"
echo "  Capture It - System Verification"
echo "======================================"
echo ""

ERRORS=0

# Check Node.js
echo "Checking Node.js..."
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    echo "  ✅ Node.js: $NODE_VERSION"
else
    echo "  ❌ Node.js not found"
    ERRORS=$((ERRORS + 1))
fi

# Check npm
echo "Checking npm..."
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    echo "  ✅ npm: $NPM_VERSION"
else
    echo "  ❌ npm not found"
    ERRORS=$((ERRORS + 1))
fi

# Check Docker (optional)
echo "Checking Docker..."
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    echo "  ✅ Docker: $DOCKER_VERSION"
else
    echo "  ⚠️  Docker not found (optional)"
fi

# Check .env file
echo "Checking .env file..."
if [ -f ".env" ]; then
    echo "  ✅ .env file exists"
else
    echo "  ❌ .env file not found"
    ERRORS=$((ERRORS + 1))
fi

# Check required directories
echo "Checking project structure..."
DIRS=("electron" "renderer" "signaling-server" "renderer/src")
for dir in "${DIRS[@]}"; do
    if [ -d "$dir" ]; then
        echo "  ✅ $dir/"
    else
        echo "  ❌ $dir/ not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check required files
echo "Checking required files..."
FILES=(
    "electron/main.js"
    "electron/preload.js"
    "renderer/package.json"
    "renderer/vite.config.js"
    "renderer/index.html"
    "renderer/src/main.jsx"
    "renderer/src/App.jsx"
    "renderer/src/Host.jsx"
    "renderer/src/Client.jsx"
    "renderer/src/styles.css"
    "signaling-server/server.js"
    "signaling-server/Dockerfile"
    "signaling-server/docker-compose.yml"
    "package.json"
    ".env"
    "README.md"
)

for file in "${FILES[@]}"; do
    if [ -f "$file" ]; then
        echo "  ✅ $file"
    else
        echo "  ❌ $file not found"
        ERRORS=$((ERRORS + 1))
    fi
done

# Check node_modules
echo "Checking dependencies..."
if [ -d "node_modules" ]; then
    echo "  ✅ Root dependencies installed"
else
    echo "  ❌ Root dependencies not installed"
    echo "     Run: npm install"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "renderer/node_modules" ]; then
    echo "  ✅ Renderer dependencies installed"
else
    echo "  ❌ Renderer dependencies not installed"
    echo "     Run: cd renderer && npm install"
    ERRORS=$((ERRORS + 1))
fi

if [ -d "signaling-server/node_modules" ]; then
    echo "  ✅ Signaling server dependencies installed"
else
    echo "  ❌ Signaling server dependencies not installed"
    echo "     Run: cd signaling-server && npm install"
    ERRORS=$((ERRORS + 1))
fi

# Check port availability
echo "Checking port 3000..."
if lsof -i :3000 &> /dev/null; then
    echo "  ⚠️  Port 3000 is already in use"
else
    echo "  ✅ Port 3000 is available"
fi

echo ""
echo "======================================"
if [ $ERRORS -eq 0 ]; then
    echo "  ✅ All checks passed!"
    echo ""
    echo "  Ready to start! Run:"
    echo "    npm run dev"
    echo ""
    echo "  Or use the quick start script:"
    echo "    ./start.sh"
else
    echo "  ❌ $ERRORS error(s) found"
    echo "  Please fix the issues above before starting"
fi
echo "======================================"

exit $ERRORS
