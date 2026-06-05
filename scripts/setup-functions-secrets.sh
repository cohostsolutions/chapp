#!/bin/bash

# Edge Functions Secrets Setup Script
# Sets all required environment variables for Supabase Edge Functions

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_REF="domipubyjkhsrmdwtabh"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Edge Functions Secrets Setup${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase >/dev/null 2>&1; then
    echo -e "${RED}Error: Supabase CLI not found!${NC}"
    exit 1
fi

# Check if logged in
if ! supabase projects list >/dev/null 2>&1; then
    echo -e "${RED}Error: Not logged in to Supabase!${NC}"
    echo "Run: supabase login"
    exit 1
fi

echo -e "${YELLOW}This script will set up all required secrets for edge functions.${NC}"
echo -e "${YELLOW}You can either:${NC}"
echo "  1. Use values from .env file (automatic)"
echo "  2. Enter values manually (interactive)"
echo ""

read -p "Use .env file? (Y/n): " -n 1 -r
echo ""
USE_ENV_FILE=true
if [[ $REPLY =~ ^[Nn]$ ]]; then
    USE_ENV_FILE=false
fi

echo ""

# Function to set secret
set_secret() {
    local key=$1
    local value=$2
    local required=$3
    
    if [ -z "$value" ]; then
        if [ "$required" = "true" ]; then
            echo -e "  ${RED}✗${NC} $key (missing - required!)"
            return 1
        else
            echo -e "  ${YELLOW}⊘${NC} $key (optional - skipped)"
            return 0
        fi
    fi
    
    if supabase secrets set "$key=$value" 2>/dev/null; then
        echo -e "  ${GREEN}✓${NC} $key"
        return 0
    else
        echo -e "  ${RED}✗${NC} $key (failed to set)"
        return 1
    fi
}

# Function to get value from .env or prompt
get_value() {
    local key=$1
    local env_key=$2
    local default=$3
    local description=$4
    
    if [ "$USE_ENV_FILE" = true ] && [ -f ".env" ]; then
        # Try to extract from .env file
        value=$(grep "^${env_key}=" .env 2>/dev/null | cut -d '=' -f2- | tr -d '"')
        echo "$value"
    else
        # Prompt user
        echo -n "$description [$default]: "
        read input
        echo "${input:-$default}"
    fi
}

# Counter for success/failure
TOTAL=0
SUCCESS=0
FAILED=0

# Core Supabase Configuration (Required)
echo -e "${BLUE}[1/8] Core Supabase Configuration${NC}"
((TOTAL++))
SUPABASE_URL=$(get_value "SUPABASE_URL" "VITE_SUPABASE_URL" "https://domipubyjkhsrmdwtabh.supabase.co" "Supabase URL")
if set_secret "SUPABASE_URL" "$SUPABASE_URL" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
SUPABASE_SERVICE_ROLE_KEY=$(get_value "SUPABASE_SERVICE_ROLE_KEY" "SUPABASE_SERVICE_ROLE_KEY" "" "Service Role Key")
if set_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
SUPABASE_ANON_KEY=$(get_value "SUPABASE_ANON_KEY" "VITE_SUPABASE_PUBLISHABLE_KEY" "" "Anon Key")
if set_secret "SUPABASE_ANON_KEY" "$SUPABASE_ANON_KEY" true; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# Meta/Facebook Integration (Required for social features)
echo -e "${BLUE}[2/8] Meta/Facebook Integration${NC}"
((TOTAL++))
FACEBOOK_APP_ID=$(get_value "FACEBOOK_APP_ID" "FACEBOOK_APP_ID" "823361387270732" "Facebook App ID")
if set_secret "FACEBOOK_APP_ID" "$FACEBOOK_APP_ID" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
META_APP_ID=$(get_value "META_APP_ID" "FACEBOOK_APP_ID" "$FACEBOOK_APP_ID" "Meta App ID (same as Facebook)")
if set_secret "META_APP_ID" "${META_APP_ID:-$FACEBOOK_APP_ID}" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
FACEBOOK_APP_SECRET=$(get_value "FACEBOOK_APP_SECRET" "FACEBOOK_APP_SECRET" "d17a6665e2b0dae5c774dd2cafc5dfd2" "Facebook App Secret")
if set_secret "FACEBOOK_APP_SECRET" "$FACEBOOK_APP_SECRET" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
META_APP_SECRET=$(get_value "META_APP_SECRET" "FACEBOOK_APP_SECRET" "$FACEBOOK_APP_SECRET" "Meta App Secret (same as Facebook)")
if set_secret "META_APP_SECRET" "${META_APP_SECRET:-$FACEBOOK_APP_SECRET}" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
META_VERIFY_TOKEN=$(get_value "META_VERIFY_TOKEN" "META_VERIFY_TOKEN" "alcornexus" "Meta Webhook Verify Token")
if set_secret "META_VERIFY_TOKEN" "$META_VERIFY_TOKEN" true; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# AI Services (Required for AI features)
echo -e "${BLUE}[3/8] AI Services${NC}"
((TOTAL++))
GOOGLE_API_KEY=$(get_value "GOOGLE_API_KEY" "GOOGLE_API_KEY" "" "Google API Key (for Gemini AI)")
if set_secret "GOOGLE_API_KEY" "$GOOGLE_API_KEY" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
OPENAI_API_KEY=$(get_value "OPENAI_API_KEY" "OPENAI_API_KEY" "" "OpenAI API Key (optional)")
if set_secret "OPENAI_API_KEY" "$OPENAI_API_KEY" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
ELEVENLABS_API_KEY=$(get_value "ELEVENLABS_API_KEY" "ELEVENLABS_API_KEY" "" "ElevenLabs API Key (for TTS)")
if set_secret "ELEVENLABS_API_KEY" "$ELEVENLABS_API_KEY" false; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# Email Services (Required for email features)
echo -e "${BLUE}[4/8] Email Services${NC}"
((TOTAL++))
RESEND_API_KEY=$(get_value "RESEND_API_KEY" "RESEND_API_KEY" "" "Resend API Key")
if set_secret "RESEND_API_KEY" "$RESEND_API_KEY" true; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
SMTP_HOST=$(get_value "SMTP_HOST" "SMTP_HOST" "" "SMTP Host (optional)")
if set_secret "SMTP_HOST" "$SMTP_HOST" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
SMTP_PORT=$(get_value "SMTP_PORT" "SMTP_PORT" "587" "SMTP Port (optional)")
if set_secret "SMTP_PORT" "$SMTP_PORT" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
SMTP_USER=$(get_value "SMTP_USER" "SMTP_USER" "" "SMTP Username (optional)")
if set_secret "SMTP_USER" "$SMTP_USER" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
SMTP_PASS=$(get_value "SMTP_PASS" "SMTP_PASS" "" "SMTP Password (optional)")
if set_secret "SMTP_PASS" "$SMTP_PASS" false; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# Twilio Services (Required for SMS/Voice)
echo -e "${BLUE}[5/8] Twilio Services${NC}"
((TOTAL++))
TWILIO_ACCOUNT_SID=$(get_value "TWILIO_ACCOUNT_SID" "TWILIO_ACCOUNT_SID" "" "Twilio Account SID")
if set_secret "TWILIO_ACCOUNT_SID" "$TWILIO_ACCOUNT_SID" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
TWILIO_AUTH_TOKEN=$(get_value "TWILIO_AUTH_TOKEN" "TWILIO_AUTH_TOKEN" "" "Twilio Auth Token")
if set_secret "TWILIO_AUTH_TOKEN" "$TWILIO_AUTH_TOKEN" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
TWILIO_PHONE_NUMBER=$(get_value "TWILIO_PHONE_NUMBER" "TWILIO_PHONE_NUMBER" "" "Twilio Phone Number")
if set_secret "TWILIO_PHONE_NUMBER" "$TWILIO_PHONE_NUMBER" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
TWILIO_CALLER_ID=$(get_value "TWILIO_CALLER_ID" "TWILIO_PHONE_NUMBER" "$TWILIO_PHONE_NUMBER" "Twilio Caller ID (same as phone)")
if set_secret "TWILIO_CALLER_ID" "${TWILIO_CALLER_ID:-$TWILIO_PHONE_NUMBER}" false; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# Google Services (Required for Calendar/OAuth)
echo -e "${BLUE}[6/8] Google Services${NC}"
((TOTAL++))
GOOGLE_CLIENT_ID=$(get_value "OAuth_Client_ID" "GOOGLE_CLIENT_ID" "" "Google OAuth Client ID")
if set_secret "OAuth_Client_ID" "$GOOGLE_CLIENT_ID" false; then ((SUCCESS++)); else ((FAILED++)); fi

((TOTAL++))
GOOGLE_CLIENT_SECRET=$(get_value "GOOGLE_OAUTH_CLIENT_SECRET" "GOOGLE_CLIENT_SECRET" "" "Google OAuth Client Secret")
if set_secret "GOOGLE_OAUTH_CLIENT_SECRET" "$GOOGLE_CLIENT_SECRET" false; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# Additional Services (Optional)
echo -e "${BLUE}[7/8] Additional Services (Optional)${NC}"
((TOTAL++))
LOVABLE_API_KEY=$(get_value "LOVABLE_API_KEY" "LOVABLE_API_KEY" "" "Lovable API Key (legacy)")
if set_secret "LOVABLE_API_KEY" "$LOVABLE_API_KEY" false; then ((SUCCESS++)); else ((FAILED++)); fi

echo ""

# Verification
echo -e "${BLUE}[8/8] Verifying secrets...${NC}"
if supabase secrets list > /tmp/secrets_list.txt 2>&1; then
    echo -e "${GREEN}✓ Secrets list retrieved${NC}"
    SECRET_COUNT=$(cat /tmp/secrets_list.txt | tail -n +2 | wc -l)
    echo "  Total secrets set: $SECRET_COUNT"
else
    echo -e "${RED}✗ Failed to retrieve secrets list${NC}"
fi

echo ""
echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Summary${NC}"
echo -e "${BLUE}=====================================${NC}"
echo "  Total secrets: $TOTAL"
echo -e "  ${GREEN}Successful: $SUCCESS${NC}"
echo -e "  ${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${YELLOW}⚠ Some secrets failed to set. Check errors above.${NC}"
    echo ""
    echo "You can also set secrets via Supabase Dashboard:"
    echo "https://supabase.com/dashboard/project/$PROJECT_REF/settings/functions"
    exit 1
else
    echo -e "${GREEN}✓ All secrets configured successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Deploy edge functions: ./scripts/deploy-all-functions.sh"
    echo "  2. Verify deployment: ./scripts/verify-functions-migration.sh"
    exit 0
fi
