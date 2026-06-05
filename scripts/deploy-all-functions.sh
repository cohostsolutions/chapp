#!/bin/bash

# Edge Functions Deployment Script for New Supabase Project
# Project: domipubyjkhsrmdwtabh
# Date: January 19, 2026

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Project configuration
PROJECT_REF="domipubyjkhsrmdwtabh"
PROJECT_URL="https://domipubyjkhsrmdwtabh.supabase.co"

echo -e "${BLUE}================================${NC}"
echo -e "${BLUE}Edge Functions Deployment Script${NC}"
echo -e "${BLUE}================================${NC}"
echo ""
echo "Project: $PROJECT_REF"
echo "URL: $PROJECT_URL"
echo ""

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Step 1: Check Supabase CLI
echo -e "${YELLOW}[1/6] Checking Supabase CLI...${NC}"
if ! command_exists supabase; then
    echo -e "${RED}Error: Supabase CLI not found!${NC}"
    echo "Install it with:"
    echo "  curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz"
    echo "  sudo mv supabase /usr/local/bin/supabase"
    exit 1
fi

SUPABASE_VERSION=$(supabase --version)
echo -e "${GREEN}✓ Supabase CLI installed: $SUPABASE_VERSION${NC}"
echo ""

# Step 2: Check project link
echo -e "${YELLOW}[2/6] Verifying project link...${NC}"
if ! supabase projects list >/dev/null 2>&1; then
    echo -e "${RED}Error: Not logged in to Supabase!${NC}"
    echo "Please run: supabase login"
    exit 1
fi

# Try to link the project
echo "Linking to project $PROJECT_REF..."
if supabase link --project-ref $PROJECT_REF 2>/dev/null; then
    echo -e "${GREEN}✓ Successfully linked to project${NC}"
else
    echo -e "${YELLOW}⚠ Already linked or link failed - continuing...${NC}"
fi
echo ""

# Step 3: List functions to deploy
echo -e "${YELLOW}[3/6] Scanning edge functions...${NC}"
FUNCTIONS_DIR="supabase/functions"

if [ ! -d "$FUNCTIONS_DIR" ]; then
    echo -e "${RED}Error: Functions directory not found!${NC}"
    exit 1
fi

# Get list of functions (excluding _helpers, _shared, _tests)
FUNCTIONS=$(ls -d $FUNCTIONS_DIR/*/ 2>/dev/null | grep -v -E '(_helpers|_shared|_tests)' | xargs -n1 basename)
FUNCTION_COUNT=$(echo "$FUNCTIONS" | wc -l)

echo -e "${GREEN}Found $FUNCTION_COUNT functions to deploy:${NC}"
echo "$FUNCTIONS" | column
echo ""

# Step 4: Ask for confirmation
echo -e "${YELLOW}[4/6] Deployment confirmation${NC}"
read -p "Deploy all functions? (y/N): " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi
echo ""

# Step 5: Deploy functions
echo -e "${YELLOW}[5/6] Deploying functions...${NC}"
echo ""

DEPLOYED=0
FAILED=0
FAILED_FUNCTIONS=""

# Deploy critical functions first
CRITICAL_FUNCTIONS=(
    "health-check"
    "ai-chat"
    "social-webhook"
    "facebook-connect"
    "send-social-message"
    "process-pending-messages"
    "send-email"
    "send-sms"
)

echo -e "${BLUE}Deploying critical functions first...${NC}"
for func in "${CRITICAL_FUNCTIONS[@]}"; do
    if [ -d "$FUNCTIONS_DIR/$func" ]; then
        echo -n "  Deploying $func... "
        if supabase functions deploy $func --no-verify-jwt 2>/dev/null; then
            echo -e "${GREEN}✓${NC}"
            ((DEPLOYED++))
        else
            echo -e "${RED}✗${NC}"
            ((FAILED++))
            FAILED_FUNCTIONS="$FAILED_FUNCTIONS\n  - $func"
        fi
    fi
done

echo ""
echo -e "${BLUE}Deploying remaining functions...${NC}"

# Deploy all other functions
for func_path in $FUNCTIONS_DIR/*/; do
    func=$(basename "$func_path")
    
    # Skip special directories
    if [[ "$func" =~ ^_ ]] || [[ " ${CRITICAL_FUNCTIONS[@]} " =~ " $func " ]]; then
        continue
    fi
    
    echo -n "  Deploying $func... "
    if supabase functions deploy $func 2>/dev/null; then
        echo -e "${GREEN}✓${NC}"
        ((DEPLOYED++))
    else
        echo -e "${RED}✗${NC}"
        ((FAILED++))
        FAILED_FUNCTIONS="$FAILED_FUNCTIONS\n  - $func"
    fi
done

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Deployed: $DEPLOYED${NC}"
if [ $FAILED -gt 0 ]; then
    echo -e "${RED}Failed: $FAILED${NC}"
    echo -e "${RED}Failed functions:${NC}"
    echo -e "$FAILED_FUNCTIONS"
else
    echo -e "${GREEN}Failed: 0${NC}"
fi
echo -e "${BLUE}================================${NC}"
echo ""

# Step 6: Verify deployment
echo -e "${YELLOW}[6/6] Verifying deployment...${NC}"

# List deployed functions
echo "Fetching deployed functions list..."
if supabase functions list > /tmp/deployed_functions.txt 2>/dev/null; then
    echo -e "${GREEN}✓ Successfully retrieved function list${NC}"
    cat /tmp/deployed_functions.txt
else
    echo -e "${YELLOW}⚠ Could not retrieve function list${NC}"
fi

echo ""

# Test health-check endpoint
echo "Testing health-check endpoint..."
HEALTH_URL="$PROJECT_URL/functions/v1/health-check"
if curl -s -f "$HEALTH_URL" >/dev/null 2>&1; then
    echo -e "${GREEN}✓ Health check passed${NC}"
else
    echo -e "${YELLOW}⚠ Health check endpoint not responding${NC}"
fi

echo ""

# Test social-webhook verification
echo "Testing social-webhook verification..."
WEBHOOK_TEST_URL="$PROJECT_URL/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123"
WEBHOOK_RESPONSE=$(curl -s "$WEBHOOK_TEST_URL" 2>/dev/null || echo "")
if [ "$WEBHOOK_RESPONSE" = "test123" ]; then
    echo -e "${GREEN}✓ Social webhook verification passed${NC}"
else
    echo -e "${YELLOW}⚠ Social webhook verification failed${NC}"
    echo "  Expected: test123"
    echo "  Got: $WEBHOOK_RESPONSE"
fi

echo ""
echo -e "${BLUE}================================${NC}"
echo -e "${GREEN}Deployment Complete!${NC}"
echo -e "${BLUE}================================${NC}"
echo ""

# Next steps
echo -e "${YELLOW}Next Steps:${NC}"
echo ""
echo "1. Verify function logs:"
echo "   supabase functions logs --follow"
echo ""
echo "2. Update external webhooks:"
echo "   - Facebook: https://developers.facebook.com/apps/823361387270732/webhooks/"
echo "   - Twilio: https://console.twilio.com/"
echo ""
echo "3. Update frontend environment variables in Vercel:"
echo "   - VITE_SUPABASE_URL=$PROJECT_URL"
echo ""
echo "4. Test your application end-to-end"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}⚠ Some functions failed to deploy. Check the logs above.${NC}"
    echo ""
    echo "To redeploy a specific function:"
    echo "  supabase functions deploy <function-name>"
    exit 1
fi

echo -e "${GREEN}All functions deployed successfully!${NC}"
exit 0
