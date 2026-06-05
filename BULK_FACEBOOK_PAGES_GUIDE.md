# Bulk Facebook Pages Webhook Subscription Guide

## Overview

You have **multiple Facebook pages** that were connected manually before the OAuth flow was implemented:

1. **GuilCor Agrimac** (Facebook Page)
2. **CoHost Solutions** (Facebook Page)
3. **AlCor Nexus** (Instagram)

All of these need webhook subscription to start receiving messages.

## New Bulk Function

A new edge function **`subscribe-facebook-webhooks-bulk`** has been created to subscribe **all enabled pages at once**.

### Features

✅ Subscribes all enabled Facebook pages in your organization  
✅ Or specific pages by ID if you provide them  
✅ Returns detailed results for each page  
✅ Handles token decryption automatically  
✅ Shows which ones succeeded and which failed  

## Quick Start

### Method 1: Using the Shell Script (Easiest)

```bash
# 1. Make the script executable
chmod +x subscribe-all-facebook-pages.sh

# 2. Get your auth token:
#    - Open your app and log in
#    - Press F12 to open DevTools
#    - Go to Console and paste:
#      JSON.parse(localStorage.getItem('supabase.auth.token')).session.access_token
#    - Copy the token

# 3. Run the script
./subscribe-all-facebook-pages.sh "YOUR_AUTH_TOKEN" "https://yourproject.supabase.co"
```

**Example**:
```bash
./subscribe-all-facebook-pages.sh \
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  "https://domipubyjkhsrmdwtabh.supabase.co"
```

### Method 2: Using curl Directly

```bash
curl -X POST https://your-supabase-url/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{}'
```

### Method 3: Using Supabase Dashboard

1. Go to **Edge Functions** → **subscribe-facebook-webhooks-bulk**
2. Click the **Test** button
3. Leave request body as: `{}`
4. Click **Send**
5. View the results

## Response Format

### Success Response

```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  "results": [
    {
      "page_id": "123456789",
      "page_name": "GuilCor Agrimac",
      "success": true,
      "message": "Successfully subscribed GuilCor Agrimac to webhook"
    },
    {
      "page_id": "987654321",
      "page_name": "CoHost Solutions",
      "success": true,
      "message": "Successfully subscribed CoHost Solutions to webhook"
    },
    {
      "page_id": "555666777",
      "page_name": "AlCor Nexus",
      "success": true,
      "message": "Successfully subscribed AlCor Nexus to webhook"
    }
  ]
}
```

### Partial Failure Response

```json
{
  "success": false,
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    {
      "page_id": "123456789",
      "page_name": "GuilCor Agrimac",
      "success": true,
      "message": "Successfully subscribed GuilCor Agrimac to webhook"
    },
    {
      "page_id": "987654321",
      "page_name": "CoHost Solutions",
      "success": false,
      "message": "Token decryption failed",
      "error": "Vault error: ..."
    }
  ]
}
```

## To Subscribe Specific Pages Only

If you want to subscribe only certain pages instead of all:

```bash
curl -X POST https://your-supabase-url/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "page_ids": ["123456789", "987654321"]
  }'
```

## Deployment

### Step 1: Deploy the Bulk Function

```bash
supabase functions deploy subscribe-facebook-webhooks-bulk
```

### Step 2: Deploy Updated social-webhook

The `social-webhook` function was already updated to check both tables.

```bash
supabase functions deploy social-webhook
```

### Step 3: Run Bulk Subscription

Use one of the methods above to subscribe all pages.

## Verification

After running the bulk subscription, verify it worked:

### Check Edge Function Logs

1. Go to **Supabase Dashboard** → **Edge Functions** → **subscribe-facebook-webhooks-bulk**
2. Click **Logs** tab
3. You should see entries like:
   ```
   [Bulk Subscribe] Found 3 page(s) to subscribe
   [Bulk Subscribe] Subscribing app to GuilCor Agrimac (123456789)
   [Bulk Subscribe] Successfully subscribed GuilCor Agrimac to webhook
   ...
   ```

### Send Test Messages

1. Message each Facebook page from a personal account:
   - Message GuilCor Agrimac page
   - Message CoHost Solutions page
   - Message AlCor Nexus (Instagram)

2. Check your ChatLogs page:
   - New messages should appear
   - AI should respond automatically
   - Status should update correctly

### Monitor Webhook Execution

1. Go to **Supabase Dashboard** → **Edge Functions** → **social-webhook**
2. Click **Overview** tab
3. You should see increased **Invocation Requests** count
4. Response times should be under 5 seconds

## Troubleshooting

### Error: "No pages found to subscribe"

**Cause**: No enabled Facebook pages in the organization

**Solution**:
```sql
-- Check facebook_pages table
SELECT page_id, page_name, is_enabled FROM facebook_pages 
WHERE organization_id = 'YOUR_ORG_ID';
```

If pages exist but `is_enabled = false`, update them:
```sql
UPDATE facebook_pages 
SET is_enabled = true 
WHERE page_id IN ('123456789', '987654321', '555666777');
```

### Error: "Token decryption failed"

**Cause**: Access token is encrypted but vault keys are misconfigured

**Solution**:
- Check that `META_APP_SECRET` environment variable is set in Supabase
- Check Vault is initialized correctly
- Verify access tokens haven't expired

### Error: "Forbidden"

**Cause**: User doesn't have admin permissions

**Solution**:
- Ensure logged-in user has `client_admin` or `super_admin` role
- Check user_roles table

### "Failed to subscribe to webhook" with error details

**Cause**: Meta API rejected the subscription request

**Common reasons**:
- Access token is expired
- Page ID is incorrect
- App doesn't have required permissions on the page

**Solution**:
- Verify page IDs are correct
- Check token expiration in `facebook_pages` table
- Ensure app has `pages_manage_metadata` permission

## What Each Page Needs

### GuilCor Agrimac
- ✅ Store in `facebook_pages` table
- ✅ Has valid `access_token`
- ✅ `is_enabled = true`
- ⚠️ Needs: Webhook subscription

### CoHost Solutions
- ✅ Store in `facebook_pages` table
- ✅ Has valid `access_token`
- ✅ `is_enabled = true`
- ⚠️ Needs: Webhook subscription

### AlCor Nexus (Instagram)
- ⚠️ **Different handling**: Instagram Business Accounts are stored in `social_platforms` table
- Needs separate subscription OR use the new updated `getPlatformConfig` logic
- Instagram uses different Meta API endpoints

## For Instagram (AlCor Nexus)

Instagram accounts are stored in `social_platforms` table, not `facebook_pages`.

Check if it's there:
```sql
SELECT * FROM social_platforms 
WHERE platform = 'instagram' 
AND display_name LIKE '%AlCor%';
```

If it exists and `is_enabled = true`, the bulk function won't touch it. Instagram messages will be handled by the updated `getPlatformConfig` function automatically.

## Database Query to List All Pages

```sql
-- Show all manually-connected pages
SELECT 
  page_id,
  page_name,
  is_enabled,
  token_expires_at,
  created_at,
  updated_at
FROM facebook_pages
WHERE organization_id = (
  SELECT organization_id FROM profiles WHERE id = AUTH.uid()
)
ORDER BY page_name;
```

## Next Steps

1. ✅ Deploy both functions
2. ✅ Run bulk subscription
3. ✅ Verify messages are received
4. ✅ Monitor webhook logs
5. ✅ Ensure AI responses are working

---

**Questions?** Check the logs in Supabase Dashboard → Edge Functions for detailed error messages.
