#!/bin/bash
# Manual Deployment - Run these commands one by one

echo "🚀 Edge Functions - Manual Deployment Guide"
echo "============================================="
echo ""
echo "The automated script encountered an issue. Follow these steps:"
echo ""

echo "Step 1: Set Critical Secrets"
echo "----------------------------"
echo "Run these commands (copy and paste):"
echo ""
cat << 'EOF'
# Core Meta/Facebook secrets (REQUIRED for social features)
supabase secrets set META_VERIFY_TOKEN=alcornexus
supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
supabase secrets set FACEBOOK_APP_ID=823361387270732
supabase secrets set FACEBOOK_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2

# Core Supabase secrets (auto-detected from .env)
supabase secrets set SUPABASE_URL=https://domipubyjkhsrmdwtabh.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbWlwdWJ5amtoc3JtZHd0YWJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcxODMxMCwiZXhwIjoyMDg0Mjk0MzEwfQ.8DMkPlBDnnu108bNVQl3qpcQy0SmWobieR7uNmDc380
supabase secrets set SUPABASE_ANON_KEY=sb_publishable_WfCeSV9IOdnVa6NpqjdFBQ_Z-40I-js

# AI Service (REQUIRED - you need to add your key)
# supabase secrets set GOOGLE_API_KEY=your-actual-google-api-key-here

# Email Service (REQUIRED - you need to add your key)
# supabase secrets set RESEND_API_KEY=your-actual-resend-api-key-here

EOF

echo ""
echo "Step 2: Deploy All Functions"
echo "----------------------------"
echo "supabase functions deploy"
echo ""

echo "Step 3: Verify Deployment"
echo "------------------------"
echo "supabase functions list"
echo ""
echo "curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check'"
echo ""
echo "curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123'"
echo ""

echo ""
echo "⚠️  IMPORTANT: Missing Keys"
echo "--------------------------"
echo "You need to set these additional secrets:"
echo ""
echo "1. GOOGLE_API_KEY - For AI/Gemini features"
echo "   Get it from: https://makersuite.google.com/app/apikey"
echo ""
echo "2. RESEND_API_KEY - For email features"  
echo "   Get it from: https://resend.com/api-keys"
echo ""
echo "3. (Optional) TWILIO credentials for SMS/Voice"
echo ""
echo "Set them with:"
echo "  supabase secrets set GOOGLE_API_KEY=your-key"
echo "  supabase secrets set RESEND_API_KEY=your-key"
echo ""
