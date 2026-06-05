#!/bin/bash

# SEO Verification Script for AlCor Nexus
# This script helps verify canonical tags and meta tags are properly set

echo "╔════════════════════════════════════════════════════════════════════╗"
echo "║       AlCor Nexus - SEO & Canonical Tag Verification              ║"
echo "╚════════════════════════════════════════════════════════════════════╝"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Base URL
BASE_URL="${1:-https://alcornexus.com}"

echo "Testing base URL: $BASE_URL"
echo ""

# Array of pages to test
declare -a pages=(
  "/"
  "/pricing"
  "/ai-agents"
  "/custom-solutions"
  "/privacy"
  "/terms"
)

echo "═══════════════════════════════════════════════════════════════════"
echo "1. Checking robots.txt"
echo "═══════════════════════════════════════════════════════════════════"
curl -s "$BASE_URL/robots.txt" | head -n 20
echo ""

echo "═══════════════════════════════════════════════════════════════════"
echo "2. Checking sitemap.xml"
echo "═══════════════════════════════════════════════════════════════════"
curl -s "$BASE_URL/sitemap.xml" | grep -E "<loc>|<lastmod>" | head -n 20
echo ""

echo "═══════════════════════════════════════════════════════════════════"
echo "3. Checking Canonical Tags for Each Page"
echo "═══════════════════════════════════════════════════════════════════"

for page in "${pages[@]}"
do
    echo ""
    echo "─────────────────────────────────────────────────────────────────"
    echo "Testing: $BASE_URL$page"
    echo "─────────────────────────────────────────────────────────────────"
    
    # Fetch the page
    response=$(curl -s -L "$BASE_URL$page")
    
    # Count canonical tags
    canonical_count=$(echo "$response" | grep -c 'rel="canonical"')
    
    if [ "$canonical_count" -eq 0 ]; then
        echo -e "${RED}✗ ERROR: No canonical tag found!${NC}"
    elif [ "$canonical_count" -eq 1 ]; then
        canonical_url=$(echo "$response" | grep -o 'rel="canonical" href="[^"]*"' | sed 's/rel="canonical" href="//;s/"$//')
        echo -e "${GREEN}✓ Found 1 canonical tag:${NC} $canonical_url"
        
        # Verify it matches expected URL
        expected_url="$BASE_URL$page"
        if [ "$canonical_url" = "$expected_url" ]; then
            echo -e "${GREEN}✓ Canonical URL matches page URL${NC}"
        else
            echo -e "${YELLOW}⚠ Warning: Canonical URL doesn't match page URL${NC}"
            echo "  Expected: $expected_url"
            echo "  Found: $canonical_url"
        fi
    else
        echo -e "${RED}✗ ERROR: Multiple canonical tags found ($canonical_count)!${NC}"
        echo "$response" | grep 'rel="canonical"'
    fi
    
    # Check title tag
    title=$(echo "$response" | grep -o '<title>[^<]*</title>' | sed 's/<title>//;s/<\/title>//')
    if [ -n "$title" ]; then
        echo -e "${GREEN}✓ Title:${NC} $title"
    else
        echo -e "${RED}✗ No title tag found${NC}"
    fi
    
    # Check meta description
    description=$(echo "$response" | grep -o 'name="description" content="[^"]*"' | sed 's/name="description" content="//;s/"$//')
    if [ -n "$description" ]; then
        echo -e "${GREEN}✓ Meta Description:${NC} ${description:0:80}..."
    else
        echo -e "${RED}✗ No meta description found${NC}"
    fi
    
    # Check OG URL
    og_url=$(echo "$response" | grep -o 'property="og:url" content="[^"]*"' | sed 's/property="og:url" content="//;s/"$//')
    if [ -n "$og_url" ]; then
        echo -e "${GREEN}✓ OG URL:${NC} $og_url"
    fi
done

echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "4. Google Rich Results Test URLs"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "Test your structured data with Google:"
for page in "${pages[@]}"
do
    encoded_url=$(echo "$BASE_URL$page" | sed 's/:/%3A/g; s/\//%2F/g')
    echo "• $BASE_URL$page"
    echo "  https://search.google.com/test/rich-results?url=$encoded_url"
    echo ""
done

echo "═══════════════════════════════════════════════════════════════════"
echo "5. Request Indexing in Google Search Console"
echo "═══════════════════════════════════════════════════════════════════"
echo ""
echo "After deploying these changes:"
echo "1. Go to: https://search.google.com/search-console"
echo "2. Select your property: $BASE_URL"
echo "3. Use 'URL Inspection' tool for each page"
echo "4. Click 'Request Indexing' for updated pages"
echo ""
echo "═══════════════════════════════════════════════════════════════════"
echo "                       Verification Complete                        "
echo "═══════════════════════════════════════════════════════════════════"
