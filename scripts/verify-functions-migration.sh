#!/bin/bash

# Edge Functions Migration Verification Script
# Checks which functions are deployed and which are missing

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_REF="domipubyjkhsrmdwtabh"
PROJECT_URL="https://domipubyjkhsrmdwtabh.supabase.co"
FUNCTIONS_DIR="supabase/functions"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Edge Functions Migration Verification${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo "Project: $PROJECT_REF"
echo "URL: $PROJECT_URL"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase >/dev/null 2>&1; then
    echo -e "${RED}Error: Supabase CLI not found!${NC}"
    exit 1
fi

# Get list of local functions
echo -e "${YELLOW}Scanning local functions...${NC}"
LOCAL_FUNCTIONS=$(find $FUNCTIONS_DIR -mindepth 1 -maxdepth 1 -type d ! -name '_*' -exec basename {} \; | sort)
LOCAL_COUNT=$(echo "$LOCAL_FUNCTIONS" | wc -l)
echo -e "${GREEN}Found $LOCAL_COUNT local functions${NC}"
echo ""

# Get list of deployed functions
echo -e "${YELLOW}Fetching deployed functions...${NC}"
if supabase functions list > /tmp/deployed_list.txt 2>&1; then
    DEPLOYED_FUNCTIONS=$(cat /tmp/deployed_list.txt | tail -n +2 | awk '{print $1}' | sort)
    DEPLOYED_COUNT=$(echo "$DEPLOYED_FUNCTIONS" | grep -v '^$' | wc -l)
    echo -e "${GREEN}Found $DEPLOYED_COUNT deployed functions${NC}"
else
    echo -e "${RED}Failed to fetch deployed functions. Are you logged in?${NC}"
    echo "Run: supabase login"
    exit 1
fi

echo ""
echo -e "${BLUE}=====================================${NC}"

# Compare local vs deployed
MISSING_FUNCTIONS=""
DEPLOYED_OK=""
MISSING_COUNT=0
DEPLOYED_OK_COUNT=0

for func in $LOCAL_FUNCTIONS; do
    if echo "$DEPLOYED_FUNCTIONS" | grep -q "^$func$"; then
        DEPLOYED_OK="$DEPLOYED_OK$func\n"
        ((DEPLOYED_OK_COUNT++))
    else
        MISSING_FUNCTIONS="$MISSING_FUNCTIONS$func\n"
        ((MISSING_COUNT++))
    fi
done

# Display results
if [ $DEPLOYED_OK_COUNT -gt 0 ]; then
    echo -e "${GREEN}✓ Deployed Functions ($DEPLOYED_OK_COUNT):${NC}"
    echo -e "$DEPLOYED_OK" | grep -v '^$' | while read func; do
        echo -e "  ${GREEN}✓${NC} $func"
    done
    echo ""
fi

if [ $MISSING_COUNT -gt 0 ]; then
    echo -e "${RED}✗ Missing Functions ($MISSING_COUNT):${NC}"
    echo -e "$MISSING_FUNCTIONS" | grep -v '^$' | while read func; do
        echo -e "  ${RED}✗${NC} $func"
    done
    echo ""
    echo -e "${YELLOW}To deploy missing functions:${NC}"
    echo -e "$MISSING_FUNCTIONS" | grep -v '^$' | while read func; do
        echo "  supabase functions deploy $func"
    done
    echo ""
    echo -e "${YELLOW}Or deploy all at once:${NC}"
    echo "  supabase functions deploy"
    echo "  # or run: ./scripts/deploy-all-functions.sh"
else
    echo -e "${GREEN}✓ All functions are deployed!${NC}"
fi

echo ""
echo -e "${BLUE}=====================================${NC}"

# Test critical endpoints
echo -e "${YELLOW}Testing critical endpoints...${NC}"
echo ""

# Test 1: Health Check
echo -n "Testing health-check... "
if curl -s -f "$PROJECT_URL/functions/v1/health-check" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

# Test 2: Social Webhook Verification
echo -n "Testing social-webhook verification... "
WEBHOOK_RESPONSE=$(curl -s "$PROJECT_URL/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123" 2>/dev/null || echo "")
if [ "$WEBHOOK_RESPONSE" = "test123" ]; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC} (Expected: test123, Got: $WEBHOOK_RESPONSE)"
fi

# Test 3: Webhook Health Check
echo -n "Testing webhook-health-check... "
if curl -s -f "$PROJECT_URL/functions/v1/webhook-health-check" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC}"
else
    echo -e "${RED}✗${NC}"
fi

echo ""
echo -e "${BLUE}=====================================${NC}"

# Summary
echo -e "${BLUE}Summary:${NC}"
echo "  Local functions: $LOCAL_COUNT"
echo "  Deployed functions: $DEPLOYED_OK_COUNT"
echo "  Missing functions: $MISSING_COUNT"
echo ""

if [ $MISSING_COUNT -eq 0 ]; then
    echo -e "${GREEN}✓ Migration complete! All functions are deployed.${NC}"
    exit 0
else
    echo -e "${YELLOW}⚠ Migration incomplete. $MISSING_COUNT function(s) need to be deployed.${NC}"
    echo ""
    echo "Run deployment script:"
    echo "  chmod +x scripts/deploy-all-functions.sh"
    echo "  ./scripts/deploy-all-functions.sh"
    exit 1
fi
