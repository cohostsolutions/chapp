#!/bin/bash

# Master Edge Functions Migration Script
# Complete migration workflow for new Supabase project

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

PROJECT_REF="domipubyjkhsrmdwtabh"

clear

echo -e "${CYAN}"
echo "╔════════════════════════════════════════════════════╗"
echo "║                                                    ║"
echo "║       Edge Functions Migration Workflow           ║"
echo "║       Supabase Project: $PROJECT_REF    ║"
echo "║                                                    ║"
echo "╚════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check if scripts exist
SCRIPT_DIR="scripts"
if [ ! -d "$SCRIPT_DIR" ]; then
    echo -e "${RED}Error: scripts directory not found!${NC}"
    exit 1
fi

# Make scripts executable
chmod +x "$SCRIPT_DIR"/*.sh 2>/dev/null || true

# Function to show step header
show_step() {
    local step=$1
    local title=$2
    echo ""
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}STEP $step: $title${NC}"
    echo -e "${CYAN}═══════════════════════════════════════════════════${NC}"
    echo ""
}

# Function to wait for user
wait_for_user() {
    echo ""
    read -p "Press Enter to continue or Ctrl+C to exit..."
    echo ""
}

# Welcome
echo -e "${YELLOW}This script will guide you through the complete migration process:${NC}"
echo ""
echo "  1. ✓ Verify Supabase CLI setup"
echo "  2. 🔐 Configure environment secrets"
echo "  3. 🚀 Deploy all edge functions"
echo "  4. ✅ Verify deployment"
echo "  5. 📋 Update external webhooks"
echo ""
echo -e "${YELLOW}Estimated time: 15-30 minutes${NC}"
echo ""

read -p "Ready to begin? (Y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Nn]$ ]]; then
    echo "Migration cancelled."
    exit 0
fi

# Step 1: Check CLI
show_step "1/5" "Verify Supabase CLI"

if ! command -v supabase >/dev/null 2>&1; then
    echo -e "${RED}✗ Supabase CLI not found!${NC}"
    echo ""
    echo "Installing Supabase CLI..."
    curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
    if sudo mv supabase /usr/local/bin/supabase 2>/dev/null; then
        echo -e "${GREEN}✓ Supabase CLI installed successfully${NC}"
    else
        echo -e "${RED}✗ Failed to install. Please install manually.${NC}"
        exit 1
    fi
else
    SUPABASE_VERSION=$(supabase --version)
    echo -e "${GREEN}✓ Supabase CLI found: $SUPABASE_VERSION${NC}"
fi

# Check login status
if ! supabase projects list >/dev/null 2>&1; then
    echo ""
    echo -e "${YELLOW}⚠ Not logged in to Supabase${NC}"
    echo "Opening login flow..."
    supabase login
fi

# Link project
echo ""
echo "Linking to project: $PROJECT_REF"
if supabase link --project-ref $PROJECT_REF 2>/dev/null; then
    echo -e "${GREEN}✓ Successfully linked${NC}"
else
    echo -e "${YELLOW}⚠ Already linked or link failed - continuing...${NC}"
fi

wait_for_user

# Step 2: Setup Secrets
show_step "2/5" "Configure Environment Secrets"

echo -e "${YELLOW}Setting up required secrets for edge functions...${NC}"
echo ""
echo "This includes:"
echo "  - Supabase credentials"
echo "  - Meta/Facebook API keys"
echo "  - AI service keys (Google Gemini)"
echo "  - Email service keys (Resend)"
echo "  - Twilio credentials (optional)"
echo ""

if [ -f "$SCRIPT_DIR/setup-functions-secrets.sh" ]; then
    ./"$SCRIPT_DIR/setup-functions-secrets.sh"
    SECRETS_RESULT=$?
    
    if [ $SECRETS_RESULT -ne 0 ]; then
        echo ""
        echo -e "${RED}✗ Secrets setup failed or incomplete${NC}"
        echo ""
        echo "You can:"
        echo "  1. Set secrets manually via dashboard:"
        echo "     https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
        echo "  2. Run the secrets script separately:"
        echo "     ./scripts/setup-functions-secrets.sh"
        echo "  3. Continue anyway (some functions may not work)"
        echo ""
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Migration cancelled. Fix secrets and run again."
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠ Secrets setup script not found. Skipping...${NC}"
    echo ""
    echo "Set secrets manually at:"
    echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
    wait_for_user
fi

# Step 3: Deploy Functions
show_step "3/5" "Deploy Edge Functions"

echo -e "${YELLOW}Deploying all 53 edge functions...${NC}"
echo ""
echo "This may take 5-10 minutes depending on your connection."
echo ""

wait_for_user

if [ -f "$SCRIPT_DIR/deploy-all-functions.sh" ]; then
    ./"$SCRIPT_DIR/deploy-all-functions.sh"
    DEPLOY_RESULT=$?
    
    if [ $DEPLOY_RESULT -ne 0 ]; then
        echo ""
        echo -e "${RED}✗ Deployment encountered errors${NC}"
        echo ""
        echo "You can:"
        echo "  1. Check the error messages above"
        echo "  2. Deploy failed functions manually:"
        echo "     supabase functions deploy <function-name>"
        echo "  3. View function logs:"
        echo "     supabase functions logs <function-name>"
        echo ""
        read -p "Continue with verification? (y/N): " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "Migration incomplete. Fix errors and deploy remaining functions."
            exit 1
        fi
    fi
else
    echo -e "${YELLOW}⚠ Deployment script not found. Deploying manually...${NC}"
    supabase functions deploy
fi

# Step 4: Verify Deployment
show_step "4/5" "Verify Deployment"

echo -e "${YELLOW}Verifying all functions are deployed and working...${NC}"
echo ""

if [ -f "$SCRIPT_DIR/verify-functions-migration.sh" ]; then
    ./"$SCRIPT_DIR/verify-functions-migration.sh"
    VERIFY_RESULT=$?
    
    if [ $VERIFY_RESULT -ne 0 ]; then
        echo ""
        echo -e "${YELLOW}⚠ Verification found issues${NC}"
        echo "Review the output above and deploy missing functions."
    else
        echo -e "${GREEN}✓ All functions verified!${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Verification script not found${NC}"
    echo "Listing deployed functions..."
    supabase functions list
fi

wait_for_user

# Step 5: Update Webhooks
show_step "5/5" "Update External Webhooks"

echo -e "${YELLOW}⚠ IMPORTANT: Update these external services${NC}"
echo ""
echo -e "${CYAN}Facebook/Instagram Webhooks:${NC}"
echo "  1. Go to: https://developers.facebook.com/apps/823361387270732/webhooks/"
echo "  2. Set Callback URL: https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook"
echo "  3. Set Verify Token: alcornexus"
echo "  4. Click 'Verify and Save'"
echo ""
echo -e "${CYAN}Twilio Voice Webhooks (if using):${NC}"
echo "  1. Go to: https://console.twilio.com/"
echo "  2. Set Voice Webhook: https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook"
echo ""
echo -e "${CYAN}Vercel Environment Variables:${NC}"
echo "  Update in Vercel Dashboard:"
echo "  - VITE_SUPABASE_URL=https://domipubyjkhsrmdwtabh.supabase.co"
echo "  - VITE_SUPABASE_PUBLISHABLE_KEY=<your-anon-key>"
echo ""

wait_for_user

# Final Summary
echo ""
echo -e "${CYAN}╔════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                    ║${NC}"
echo -e "${CYAN}║             Migration Complete! ✓                  ║${NC}"
echo -e "${CYAN}║                                                    ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}✓ Supabase CLI configured${NC}"
echo -e "${GREEN}✓ Environment secrets set${NC}"
echo -e "${GREEN}✓ Edge functions deployed${NC}"
echo -e "${GREEN}✓ Deployment verified${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Verify external webhooks are updated"
echo "2. Test your application end-to-end"
echo "3. Monitor function logs for any issues:"
echo "   supabase functions logs --follow"
echo "4. Update any CI/CD pipelines with new project ID"
echo ""
echo -e "${BLUE}Documentation:${NC}"
echo "  - Full Checklist: EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md"
echo "  - Quick Start: EDGE_FUNCTIONS_QUICK_START.md"
echo "  - Deployment Guide: DEPLOY_FUNCTIONS_GUIDE.md"
echo ""
echo -e "${BLUE}Support:${NC}"
echo "  - Supabase Dashboard: https://supabase.com/dashboard/project/$PROJECT_REF"
echo "  - Function Logs: supabase functions logs --follow"
echo ""
echo -e "${GREEN}🎉 Migration workflow complete!${NC}"
echo ""
