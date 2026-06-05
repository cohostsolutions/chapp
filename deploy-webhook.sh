#!/bin/bash
# Deploy social-webhook function to NEW Supabase project

echo "======================================"
echo "Deploying social-webhook Function"
echo "======================================"
echo ""
echo "Target Project: domipubyjkhsrmdwtabh"
echo ""

# Check if we're in the right directory
if [ ! -d "supabase/functions/social-webhook" ]; then
  echo "❌ Error: Must run from project root"
  exit 1
fi

echo "📦 Function found: supabase/functions/social-webhook"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase &> /dev/null; then
  echo "⚠️  Supabase CLI not found. Installing..."
  npm install -g supabase
fi

echo "Step 1: Login to Supabase (if not already logged in)"
echo "--------------------------------------"
supabase login

echo ""
echo "Step 2: Link to NEW project"
echo "--------------------------------------"
supabase link --project-ref domipubyjkhsrmdwtabh

echo ""
echo "Step 3: Set required secrets"
echo "--------------------------------------"
echo "Setting META_VERIFY_TOKEN..."
supabase secrets set META_VERIFY_TOKEN=alcornexus

echo ""
echo "Setting META_APP_SECRET..."
echo "⚠️  You need to provide your META_APP_SECRET"
echo "Get it from: https://developers.facebook.com/apps → Your App → Settings → Basic"
echo ""
read -p "Enter META_APP_SECRET: " META_SECRET
supabase secrets set META_APP_SECRET="$META_SECRET"

echo ""
echo "Step 4: Deploy the function"
echo "--------------------------------------"
supabase functions deploy social-webhook

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Test your webhook:"
echo "curl \"https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123\""
echo ""
echo "Expected response: test123"
echo ""
