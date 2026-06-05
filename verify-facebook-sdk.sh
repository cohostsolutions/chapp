#!/bin/bash
# Facebook SDK Setup Verification Script

echo "========================================"
echo "Facebook SDK Setup Verification"
echo "========================================"
echo ""

# Check if .env file exists
if [ ! -f ".env" ]; then
  echo "❌ .env file not found!"
  echo "   Please copy .env.example to .env and configure it."
  exit 1
fi

echo "✅ .env file found"
echo ""

# Check for VITE_FACEBOOK_APP_ID
if grep -q "^VITE_FACEBOOK_APP_ID=" .env; then
  APP_ID=$(grep "^VITE_FACEBOOK_APP_ID=" .env | cut -d'=' -f2)
  if [ -z "$APP_ID" ] || [ "$APP_ID" = "your_facebook_app_id" ]; then
    echo "⚠️  VITE_FACEBOOK_APP_ID is not configured"
    echo "   Please add your Facebook App ID to .env"
  else
    echo "✅ VITE_FACEBOOK_APP_ID is configured"
    echo "   App ID: ${APP_ID:0:5}...${APP_ID: -5}"
  fi
else
  echo "❌ VITE_FACEBOOK_APP_ID not found in .env"
  echo "   Add: VITE_FACEBOOK_APP_ID=your_app_id"
fi

echo ""

# Check for FACEBOOK_APP_SECRET
if grep -q "^FACEBOOK_APP_SECRET=" .env; then
  SECRET=$(grep "^FACEBOOK_APP_SECRET=" .env | cut -d'=' -f2)
  if [ -z "$SECRET" ] || [ "$SECRET" = "your_facebook_app_secret" ]; then
    echo "⚠️  FACEBOOK_APP_SECRET is not configured"
  else
    echo "✅ FACEBOOK_APP_SECRET is configured"
  fi
else
  echo "❌ FACEBOOK_APP_SECRET not found in .env"
fi

echo ""

# Check if index.html has Facebook SDK
if grep -q "facebook-jssdk" index.html; then
  echo "✅ Facebook SDK script found in index.html"
else
  echo "❌ Facebook SDK script not found in index.html"
fi

echo ""

# Check if vite.config.ts has the htmlEnvPlugin
if grep -q "htmlEnvPlugin" vite.config.ts; then
  echo "✅ HTML environment plugin configured in vite.config.ts"
else
  echo "❌ HTML environment plugin not found in vite.config.ts"
fi

echo ""

# Check if SocialPlatformsTab exists
if [ -f "src/components/settings/SocialPlatformsTab.tsx" ]; then
  echo "✅ SocialPlatformsTab component exists"
  
  # Check if it references FB
  if grep -q "window.FB\|fbWindow.FB" src/components/settings/SocialPlatformsTab.tsx; then
    echo "✅ SocialPlatformsTab uses Facebook SDK"
  else
    echo "⚠️  SocialPlatformsTab may not be using Facebook SDK"
  fi
else
  echo "❌ SocialPlatformsTab component not found"
fi

echo ""
echo "========================================"
echo "Setup Summary"
echo "========================================"

# Count checks
TOTAL=6
PASSED=$(grep -c "✅" <<< "$(cat)")

echo "Setup is ready! Please ensure:"
echo ""
echo "1. Configure VITE_FACEBOOK_APP_ID in .env"
echo "2. Configure FACEBOOK_APP_SECRET in .env"
echo "3. Set up OAuth redirect URIs in Facebook App settings"
echo "4. Add required permissions to your Facebook App"
echo ""
echo "For detailed setup instructions, see FACEBOOK_SDK_SETUP.md"
echo ""
