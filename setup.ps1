# QueueCTL Setup Script (PowerShell)
# This script installs dependencies, builds the project, and links the CLI globally

Write-Host "🚀 Setting up QueueCTL..." -ForegroundColor Cyan
Write-Host ""

# Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to install dependencies" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Build the project
Write-Host "🔨 Building project..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Build failed" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Project built successfully" -ForegroundColor Green
Write-Host ""

# Link globally
Write-Host "🔗 Linking queuectl command globally..." -ForegroundColor Yellow
npm link
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Failed to link globally" -ForegroundColor Red
    exit 1
}
Write-Host "✅ queuectl command is now available globally" -ForegroundColor Green
Write-Host ""

# Verify installation
Write-Host "🧪 Verifying installation..." -ForegroundColor Yellow
try {
    $null = Get-Command queuectl -ErrorAction Stop
    Write-Host "✅ queuectl command is working!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Try these commands:" -ForegroundColor Cyan
    Write-Host "  queuectl --help"
    Write-Host "  queuectl enqueue `"echo 'Hello, QueueCTL!'`""
    Write-Host "  queuectl status"
    Write-Host ""
    Write-Host "🎉 Setup complete! You're ready to use QueueCTL." -ForegroundColor Green
} catch {
    Write-Host "⚠️  queuectl command not found in PATH" -ForegroundColor Yellow
    Write-Host "You may need to restart your terminal or add npm global bin to PATH"
}
