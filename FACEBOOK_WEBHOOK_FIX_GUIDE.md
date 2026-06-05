# Facebook Webhook Fix - Complete Solution

## Problem Identified

The AlCor Nexus Facebook page was connected **manually** (directly added to the database) rather than through the "Connect Facebook" OAuth flow. This means:

1. ✅ The page is stored in the `facebook_pages` table
2. ✅ The page is marked as `is_enabled = true`
3. ❌ **The webhook subscription was never set up** - the app wasn't subscribed to receive `messages` events on Meta's side
4. ❌ Result: Webhook notifications don't reach your system

## Root Causes

1. **Missing webhook subscription**: The `subscribed_apps` endpoint was never called for this page
2. **Configuration lookup issue**: The `social-webhook` function was only checking `social_platforms` table, not `facebook_pages` table

## Solution Implemented

### 1. New Edge Function: `subscribe-facebook-webhook`

Created a new function to manually subscribe an already-connected page to webhooks:

**Location**: `/supabase/functions/subscribe-facebook-webhook/index.ts`

**Purpose**: Triggers webhook subscription for Facebook pages that were added manually

**How to use**:
```bash
curl -X POST https://your-supabase-url/functions/v1/subscribe-facebook-webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{"page_id": "YOUR_PAGE_ID"}'
```

### 2. Updated `social-webhook` Function

Modified `/supabase/functions/social-webhook/index.ts` to:

- **First check** `facebook_pages` table for enabled Facebook pages
- **Then check** `social_platforms` table for Instagram/WhatsApp
- **Properly decrypt** access tokens from both sources
- **Return configuration** for either table

This ensures messages from manually-added Facebook pages are properly routed to the AI.

## How to Fix Your Facebook Page Now

### Step 1: Deploy the Updated Functions

From your terminal, run:
```bash
# Deploy the updated social-webhook
supabase functions deploy social-webhook

# Deploy the new subscribe-facebook-webhook function
supabase functions deploy subscribe-facebook-webhook
```

### Step 2: Trigger Webhook Subscription for AlCor Nexus

Use the new function to subscribe the page. You have two options:

#### Option A: Using the Supabase Dashboard
1. Go to **Edge Functions** → **subscribe-facebook-webhook**
2. Click **Test**
3. In the request body, paste:
```json
{
  "page_id": "YOUR_ALCOR_NEXUS_PAGE_ID"
}
```
4. Click **Send**
5. Look for success response

#### Option B: From Your Backend/Postman
```curl
POST /functions/v1/subscribe-facebook-webhook
Authorization: Bearer <YOUR_AUTH_TOKEN>
Content-Type: application/json

{
  "page_id": "YOUR_PAGE_ID"
}
```

### Step 3: Verify It Worked

✅ **Success indicators**:
- Response shows: `"message": "Successfully subscribed AlCor Nexus to webhook"`
- Supabase edge function logs show no errors
- Next Facebook message will trigger the webhook
- `social-webhook` function shows executions in logs

❌ **If it fails**:
- Check the error message - likely token decryption or page not found
- Verify page ID is correct in `facebook_pages` table
- Ensure access token is valid and not expired

## Database Schema Context

### `facebook_pages` table
```
- id: UUID
- organization_id: UUID
- page_id: string (Facebook page ID)
- page_name: string
- access_token: string (encrypted)
- is_enabled: boolean
- token_expires_at: timestamp
- created_at: timestamp
- updated_at: timestamp
```

### Message Flow (After Fix)

```
Facebook Message
    ↓
webhook receives POST on /social-webhook
    ↓
detectPlatform() → "messenger"
    ↓
extractMessageData() → get page_id
    ↓
getPlatformConfig(page_id, "messenger")
    ├─ Check facebook_pages table (page_id match) ✅ NEW
    └─ Fall back to social_platforms table if needed
    ↓
Found! Decrypt access token
    ↓
processMessage() → Generate AI response
    ↓
sendPlatformResponse() → Send back to customer
```

## Key Changes Made

### File: `/supabase/functions/social-webhook/index.ts`

**Lines 938-1025**: Modified `getPlatformConfig()` function to:

```typescript
// For Messenger/Facebook, check both social_platforms and facebook_pages tables
if (platform === 'messenger' || platform === 'facebook') {
  // First, try to find in facebook_pages table
  const { data: fbPageData, error: fbPageError } = await supabase
    .from('facebook_pages')
    .select(`
      *,
      organizations (...)
    `)
    .eq('page_id', pageId)
    .eq('is_enabled', true)
    .single();

  if (!fbPageError && fbPageData) {
    // Found! Use this configuration
    let accessToken = fbPageData.access_token;
    // ... decrypt if needed
    return { platform: fbPageData, organization: fbPageData.organizations, accessToken };
  }
}

// Fall back to social_platforms for other platforms
```

## Next Steps

1. **Deploy the functions** (using supabase CLI or your CI/CD pipeline)
2. **Run subscribe-facebook-webhook** for your AlCor Nexus page
3. **Test**: Send a message to the Facebook page
4. **Verify**: Check `social-webhook` logs for successful message processing
5. **Monitor**: Ensure AI responses are being sent

## Troubleshooting

### The webhook still doesn't execute
- Verify page ID is exactly correct (case-sensitive)
- Check that `is_enabled = true` in `facebook_pages` table
- Ensure `access_token` is not expired
- Check Meta's developers console - webhook might need resubscription there

### "No matching configuration found"
- The page_id format might be different
- Run SQL query to verify exact page_id: 
  ```sql
  SELECT page_id, page_name, is_enabled FROM facebook_pages WHERE organization_id = 'YOUR_ORG_ID'
  ```

### Token decryption errors
- Check that vault encryption is configured correctly
- Verify META_APP_SECRET environment variable is set
- Check Supabase audit logs for decryption failures

## Monitoring

Watch these logs to confirm the fix is working:

1. **Supabase Edge Functions Dashboard**
   - Look for `social-webhook` executions increasing
   - Check response times and error rates

2. **In the webhook logs, you should see**:
```
Looking up messenger platform configuration for page ID: YOUR_PAGE_ID
Found matching facebook page config: ...
Processing messenger message from USER_ID: ...
Generating AI response for lead...
Sending messenger response to...
```

3. **In your ChatLogs page**:
   - New Facebook messages appear
   - AI responses are automatically generated
   - Message status updates work correctly
