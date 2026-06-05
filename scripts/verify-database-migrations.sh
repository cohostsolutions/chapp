#!/bin/bash

# Database Migration Verification Script
# Checks if all local migrations have been applied to Supabase

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_REF="domipubyjkhsrmdwtabh"

echo -e "${BLUE}=====================================${NC}"
echo -e "${BLUE}Database Migration Verification${NC}"
echo -e "${BLUE}=====================================${NC}"
echo ""
echo "Project: $PROJECT_REF"
echo ""

# Check if Supabase CLI is installed
if ! command -v supabase >/dev/null 2>&1; then
    echo -e "${RED}Error: Supabase CLI not found!${NC}"
    exit 1
fi

# Count local migration files
LOCAL_MIGRATIONS=$(find supabase/migrations -name "*.sql" -type f | wc -l)
echo -e "${YELLOW}Local migrations:${NC} $LOCAL_MIGRATIONS files"
echo ""

# Check applied migrations in Supabase
echo -e "${YELLOW}Checking applied migrations in Supabase...${NC}"
echo ""

# Get database status
if supabase migration list > /tmp/migration_status.txt 2>&1; then
    echo -e "${GREEN}✓ Successfully retrieved migration status${NC}"
    cat /tmp/migration_status.txt
    echo ""
    
    # Count applied migrations
    APPLIED=$(grep -c "Applied" /tmp/migration_status.txt 2>/dev/null || echo "0")
    PENDING=$(grep -c "Pending" /tmp/migration_status.txt 2>/dev/null || echo "0")
    
    echo -e "${BLUE}Summary:${NC}"
    echo "  Local migration files: $LOCAL_MIGRATIONS"
    echo "  Applied migrations: $APPLIED"
    echo "  Pending migrations: $PENDING"
    echo ""
    
    if [ "$PENDING" -gt 0 ]; then
        echo -e "${YELLOW}⚠ You have $PENDING pending migrations${NC}"
        echo ""
        echo "To apply pending migrations:"
        echo "  supabase db push"
        echo ""
        exit 1
    else
        echo -e "${GREEN}✓ All migrations are applied!${NC}"
        exit 0
    fi
else
    echo -e "${RED}✗ Failed to retrieve migration status${NC}"
    echo ""
    echo "You may need to:"
    echo "1. Ensure you're linked to the project:"
    echo "   supabase link --project-ref $PROJECT_REF"
    echo ""
    echo "2. Check migrations manually:"
    echo "   supabase migration list"
    echo ""
    echo "3. Apply pending migrations:"
    echo "   supabase db push"
    echo ""
    exit 1
fi
