#!/bin/bash

# Run bulk Facebook webhook subscription
echo "Running bulk Facebook webhook subscription..."
echo ""

curl -X POST https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbWlwdWJ5amtoc3JtZHd0YWJoIiwicm9sZSI6ImNsaWVudF9hZG1pbiIsImlhdCI6MTczNzUwNzEzNiwiZXhwIjoyMDYzMzExMTM2fQ.JfKbKJmb6AYaQc6kV-YvVYYZuqXfO9nqVlqFHKwKpg4" \
  -H "Content-Type: application/json" \
  -d '{}' -s | jq '.' 2>&1 || curl -X POST https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbWlwdWJ5amtoc3JtZHd0YWJoIiwicm9sZSI6ImNsaWVudF9hZG1pbiIsImlhdCI6MTczNzUwNzEzNiwiZXhwIjoyMDYzMzExMTM2fQ.JfKbKJmb6AYaQc6kV-YvVYYZuqXfO9nqVlqFHKwKpg4" \
  -H "Content-Type: application/json" \
  -d '{}'

echo ""
echo "Done!"
