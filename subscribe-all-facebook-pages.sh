#!/bin/bash
# Script to subscribe all manually-connected Facebook pages to webhooks
# Usage: ./subscribe-all-facebook-pages.sh YOUR_AUTH_TOKEN YOUR_SUPABASE_URL

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 YOUR_AUTH_TOKEN YOUR_SUPABASE_URL"
  echo ""
  echo "Example:"
  echo "  $0 'eyJhbGc...' 'https://yourproject.supabase.co'"
  echo ""
  echo "To get your auth token:"
  echo "  1. Open your app in browser and log in"
  echo "  2. Open DevTools → Console"
  echo "  3. Run: JSON.parse(localStorage.getItem('supabase.auth.token')).session.access_token"
  exit 1
fi

AUTH_TOKEN="$1"
SUPABASE_URL="$2"
WEBHOOK_URL="$SUPABASE_URL/functions/v1/subscribe-facebook-webhooks-bulk"

echo "📱 Subscribing all Facebook pages to webhooks..."
echo "URL: $WEBHOOK_URL"
echo ""

# Call the bulk subscribe endpoint
# This will subscribe ALL enabled facebook_pages in the organization
RESPONSE=$(curl -s -X POST "$WEBHOOK_URL" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $AUTH_TOKEN" \
  -d '{}')

echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"

# Parse the response to show summary
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅ All pages subscribed successfully!"
else
  echo ""
  echo "⚠️  Some pages may have failed. Check the results above."
fi
