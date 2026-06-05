# Facebook Pages Webhook Fix - Complete Implementation Summary

## Problem Statement

Multiple Facebook pages were connected **manually** to your system before the OAuth flow was implemented:

1. **GuilCor Agrimac** (Facebook Page)
2. **CoHost Solutions** (Facebook Page)
3. **AlCor Nexus** (Instagram)
4. **AlCor Nexus** (Facebook Page - original issue)

**The Issue**: These pages don't have webhook subscriptions set up on Meta's servers, so they're not receiving message events.

## Solution Implemented

### 1. ✅ Updated `social-webhook` Function
**File**: `/supabase/functions/social-webhook/index.ts`

**Changes**:
- Modified `getPlatformConfig()` function (lines 938-1025)
- Now checks `facebook_pages` table FIRST for manually-connected pages
- Falls back to `social_platforms` table for Instagram/WhatsApp
- Properly decrypts tokens from both sources

**Why**: Enables message routing for pages stored in `facebook_pages` table

---

### 2. ✅ New Function: Single Page Subscription
**File**: `/supabase/functions/subscribe-facebook-webhook/index.ts`

**Purpose**: Subscribe a single Facebook page to webhooks

**Usage**:
```bash
curl -X POST https://your-supabase/functions/v1/subscribe-facebook-webhook \
  -H "Authorization: Bearer TOKEN" \
  -d '{"page_id": "123456789"}'
```

**Response**:
```json
{
  "success": true,
  "message": "Successfully subscribed AlCor Nexus to webhook",
  "page_id": "123456789",
  "page_name": "AlCor Nexus"
}
```

---

### 3. ✅ New Function: Bulk Subscription (RECOMMENDED)
**File**: `/supabase/functions/subscribe-facebook-webhooks-bulk/index.ts`

**Purpose**: Subscribe ALL manually-connected pages at once

**Features**:
- Subscribes all enabled pages in one call
- Can specify specific page IDs if needed
- Detailed results showing success/failure for each
- Handles token decryption automatically
- Works for all pages regardless of how they were connected

**Usage**:
```bash
# Subscribe ALL pages
curl -X POST https://your-supabase/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Authorization: Bearer TOKEN" \
  -d '{}'

# Or subscribe specific pages
curl -X POST https://your-supabase/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Authorization: Bearer TOKEN" \
  -d '{"page_ids": ["123456789", "987654321"]}'
```

**Response**:
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

---

### 4. ✅ Helper Shell Script
**File**: `/subscribe-all-facebook-pages.sh`

**Purpose**: Easy command-line tool to bulk subscribe all pages

**Usage**:
```bash
chmod +x subscribe-all-facebook-pages.sh
./subscribe-all-facebook-pages.sh "YOUR_AUTH_TOKEN" "https://yourproject.supabase.co"
```

---

## Files Created/Modified

### New Files
- ✅ `/supabase/functions/subscribe-facebook-webhook/index.ts` - Single page subscription
- ✅ `/supabase/functions/subscribe-facebook-webhooks-bulk/index.ts` - Bulk subscription (222 lines)
- ✅ `/subscribe-all-facebook-pages.sh` - Helper script
- ✅ `/FACEBOOK_WEBHOOK_FIX_GUIDE.md` - Detailed single page guide
- ✅ `/BULK_FACEBOOK_PAGES_GUIDE.md` - Comprehensive bulk guide (400+ lines)
- ✅ `/FACEBOOK_PAGES_FIX_SUMMARY.md` - This file

### Modified Files
- ✅ `/supabase/functions/social-webhook/index.ts` - Updated getPlatformConfig (88 lines changed)

---

## How to Deploy and Fix

### Step 1: Deploy Functions

```bash
cd /workspaces/canvascapital

# Deploy updated social-webhook
supabase functions deploy social-webhook

# Deploy single page subscription
supabase functions deploy subscribe-facebook-webhook

# Deploy bulk subscription (RECOMMENDED)
supabase functions deploy subscribe-facebook-webhooks-bulk
```

### Step 2: Subscribe All Pages (Choose One Method)

#### Method A: Using the Shell Script (Easiest)
```bash
# Get your auth token from browser console:
# JSON.parse(localStorage.getItem('supabase.auth.token')).session.access_token

./subscribe-all-facebook-pages.sh "YOUR_TOKEN" "https://yourproject.supabase.co"
```

#### Method B: Using curl Directly
```bash
curl -X POST https://yourproject.supabase.co/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{}'
```

#### Method C: Using Supabase Dashboard
1. Go to **Edge Functions** → **subscribe-facebook-webhooks-bulk**
2. Click **Test**
3. Leave body as: `{}`
4. Click **Send**

### Step 3: Verify Success

Expected response:
```json
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0,
  ...
}
```

---

## What Happens After Deployment

### Message Flow (After Fix)

```
Customer messages Facebook page
    ↓
Meta sends webhook POST to your endpoint
    ↓
/social-webhook receives request
    ↓
detectPlatform() identifies "messenger"
    ↓
extractMessageData() gets page_id and message
    ↓
getPlatformConfig(page_id, "messenger")
    ├─ First checks facebook_pages table ✨ NEW
    │  └─ Finds: GuilCor Agrimac, CoHost Solutions, AlCor Nexus
    └─ Falls back to social_platforms if needed
    ↓
Decrypts access token (if encrypted)
    ↓
processMessage() analyzes message
    ↓
generateAIResponse() creates reply using Gemini
    ↓
sendPlatformResponse() sends reply via Facebook API
    ↓
Lead receives AI response automatically! ✅
```

---

## Testing the Fix

### Test 1: Send Message to GuilCor Agrimac
1. Log into your personal Facebook account
2. Find GuilCor Agrimac page
3. Send a message: "Hello test"
4. Check ChatLogs page - message should appear
5. AI should respond within 5-8 seconds

### Test 2: Send Message to CoHost Solutions
1. Find CoHost Solutions page
2. Send a message
3. Verify it appears in ChatLogs
4. Verify AI responds

### Test 3: Send Message to AlCor Nexus Instagram
1. Send DM to AlCor Nexus on Instagram
2. Verify message appears in ChatLogs
3. Verify AI responds

### Monitor Logs
1. Supabase Dashboard → **Edge Functions** → **social-webhook**
2. Click **Logs** tab
3. Send a test message
4. You should see:
   ```
   Processing messenger message from SENDER_ID: test message
   Found matching facebook page config: ...
   Generating AI response for lead...
   Sending messenger response to...
   ```

---

## Pages That Will Be Fixed

| Page Name | Type | Status | After Fix |
|-----------|------|--------|-----------|
| GuilCor Agrimac | Facebook | ❌ No webhooks | ✅ Receives messages |
| CoHost Solutions | Facebook | ❌ No webhooks | ✅ Receives messages |
| AlCor Nexus | Facebook | ❌ No webhooks | ✅ Receives messages |
| AlCor Nexus | Instagram | ⚠️ Needs config | ✅ Handled by getPlatformConfig |

---

## Database Details

### facebook_pages Table
Stores manually-connected Facebook pages:

```sql
SELECT 
  page_id,
  page_name,
  is_enabled,
  access_token,  -- Encrypted
  token_expires_at,
  created_at
FROM facebook_pages
WHERE organization_id = 'YOUR_ORG_ID';
```

### What the Bulk Function Does

1. Queries `facebook_pages` table for all `is_enabled = true` pages
2. For each page:
   - Decrypts the `access_token`
   - Calls `https://graph.facebook.com/v18.0/{page_id}/subscribed_apps`
   - Records success/failure
3. Returns detailed results

---

## Troubleshooting

### No pages found
**Solution**: Check SQL:
```sql
SELECT * FROM facebook_pages WHERE organization_id = 'YOUR_ORG_ID' AND is_enabled = true;
```

### Token decryption failed
**Solution**: Check vault is initialized:
- Verify `META_APP_SECRET` environment variable is set
- Check vault configuration in Supabase

### "Forbidden" error
**Solution**: User needs admin role:
```sql
SELECT role FROM user_roles WHERE user_id = 'YOUR_USER_ID';
```

### Meta API errors
**Causes**: Expired token, invalid page ID, missing permissions
**Solution**: 
- Verify page IDs are correct
- Check token expiration
- Verify app has required Facebook permissions

---

## Key Improvements

✅ **Centralized solution**: One function to rule them all  
✅ **Bulk operations**: Subscribe multiple pages at once  
✅ **Detailed feedback**: See exactly which pages succeeded/failed  
✅ **Automatic handling**: Updated webhook now handles both table sources  
✅ **No manual API calls**: Shell script and curl examples provided  
✅ **Comprehensive docs**: Three detailed guides included  

---

## Next Steps

1. Deploy the three functions
2. Run bulk subscription with one of the three methods
3. Send test messages to each page
4. Monitor logs to verify messages are processed
5. Confirm AI responses are being sent

That's it! All pages will start receiving messages and AI responses automatically.

---

**Files to Review**:
- `/FACEBOOK_WEBHOOK_FIX_GUIDE.md` - Single page details
- `/BULK_FACEBOOK_PAGES_GUIDE.md` - Comprehensive guide
- `/supabase/functions/subscribe-facebook-webhook/index.ts` - Single subscription code
- `/supabase/functions/subscribe-facebook-webhooks-bulk/index.ts` - Bulk subscription code
- `/supabase/functions/social-webhook/index.ts` - Updated message routing
