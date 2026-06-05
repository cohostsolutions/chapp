#!/bin/bash

# PWA Asset Generation Script
# This script helps you generate all required PWA assets

echo "🎨 AlCor Nexus PWA Asset Generator"
echo "=================================="
echo ""

# Check if source logo exists
if [ ! -f "public/alcor-logo.svg" ] && [ ! -f "public/logo.png" ]; then
    echo "❌ Error: No source logo found!"
    echo "   Please add a logo file to public/ directory"
    echo "   Supported: logo.png (1024x1024) or alcor-logo.svg"
    exit 1
fi

# Determine source file
if [ -f "public/alcor-logo.svg" ]; then
    SOURCE="public/alcor-logo.svg"
    echo "✅ Found source: alcor-logo.svg"
elif [ -f "public/logo.png" ]; then
    SOURCE="public/logo.png"
    echo "✅ Found source: logo.png"
fi

echo ""
echo "⚠️  Note: pwa-asset-generator requires Chrome libraries"
echo "   In dev containers, you may need to install dependencies:"
echo "   sudo apt-get update && sudo apt-get install -y libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libgbm1 libpango-1.0-0 libcairo2 libasound2"
echo ""
echo "📦 Attempting asset generation..."

# Try to generate assets, but don't fail if it doesn't work
if npx -y pwa-asset-generator "$SOURCE" public/ \
    --padding "20%" \
    --background "#0f172a" \
    --scrape false \
    --icon-only \
    --favicon \
    --type png 2>/dev/null; then
    echo "✅ PWA icons generated"
else
    echo "⚠️  Could not auto-generate icons (Chrome dependencies missing)"
    echo ""
    echo "📱 Alternative: Use online tools to generate icons:"
    echo "   • https://realfavicongenerator.net/"
    echo "   • https://www.pwabuilder.com/imageGenerator"
    echo "   • https://favicon.io/"
    echo ""
    echo "   Required sizes:"
    echo "   • favicon.png (512x512)"
    echo "   • pwa-192x192.png (192x192, maskable)"
    echo "   • pwa-512x512.png (512x512, maskable)"
    echo "   • apple-touch-icon-152x152.png"
    echo "   • apple-touch-icon-167x167.png"
    echo "   • apple-touch-icon-180x180.png"
fi

echo ""
echo "📱 Splash screens (optional):"
echo "   • Use https://appsco.pe/developer/splash-screens to generate"
echo "   • Or skip - most modern iOS versions don't require them"
echo ""
echo "⚠️  Still needed:"
echo "   1. Take screenshots of your app"
echo "   2. Save to public/screenshots/"
echo "      - dashboard-wide.png (1280x720)"
echo "      - leads-mobile.png (750x1334)"
echo "      - ai-chat-mobile.png (750x1334)"
echo ""
echo "📖 See PWA_DEPLOYMENT_GUIDE.md for next steps"
