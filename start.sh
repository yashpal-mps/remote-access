#!/bin/bash

# Capture It - Quick Start Script for macOS
# This script helps you get started quickly

echo "======================================"
echo "  Capture It - Remote Desktop Setup"
echo "======================================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    echo "   Download from: https://nodejs.org/"
    exit 1
fi

echo "✅ Node.js found: $(node --version)"

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "⚠️  Docker is not installed. You can run signaling server locally instead."
    echo "   Download from: https://www.docker.com/"
    USE_DOCKER=false
else
    echo "✅ Docker found: $(docker --version)"
    USE_DOCKER=true
fi

echo ""
echo "Installing dependencies..."

# Install root dependencies
npm install

# Install renderer dependencies
cd renderer
npm install
cd ..

# Install signaling server dependencies
cd signaling-server
npm install
cd ..

echo ""
echo "✅ All dependencies installed!"
echo ""

if [ "$USE_DOCKER" = true ]; then
    echo "Starting signaling server with Docker..."
    cd signaling-server
    docker-compose up -d
    cd ..
    echo "✅ Signaling server started on port 3000"
else
    echo "Starting signaling server locally..."
    cd signaling-server
    node server.js &
    cd ..
    SIGNALING_PID=$!
    echo "✅ Signaling server started with PID: $SIGNALING_PID"
fi

echo ""
echo "Starting Electron app..."
echo ""
echo "======================================"
echo "  Opening Capture It..."
echo "======================================"
echo ""
echo "📝 Remember to grant macOS permissions:"
echo "   1. Screen Recording (System Preferences → Security & Privacy)"
echo "   2. Accessibility (System Preferences → Security & Privacy)"
echo ""

# Start Electron
npm run dev
