#!/bin/bash

# QueueCTL Setup Script
# This script installs dependencies, builds the project, and links the CLI globally

echo "🚀 Setting up QueueCTL..."
echo ""

# Install dependencies
echo "📦 Installing dependencies..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi
echo "✅ Dependencies installed"
echo ""

# Build the project
echo "🔨 Building project..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ Build failed"
    exit 1
fi
echo "✅ Project built successfully"
echo ""

# Link globally
echo "🔗 Linking queuectl command globally..."
npm link
if [ $? -ne 0 ]; then
    echo "❌ Failed to link globally"
    exit 1
fi
echo "✅ queuectl command is now available globally"
echo ""

# Verify installation
echo "🧪 Verifying installation..."
if command -v queuectl &> /dev/null; then
    echo "✅ queuectl command is working!"
    echo ""
    echo "📋 Try these commands:"
    echo "  queuectl --help"
    echo "  queuectl enqueue \"echo 'Hello, QueueCTL!'\""
    echo "  queuectl status"
    echo ""
    echo "🎉 Setup complete! You're ready to use QueueCTL."
else
    echo "⚠️  queuectl command not found in PATH"
    echo "You may need to restart your terminal or add npm global bin to PATH"
fi
