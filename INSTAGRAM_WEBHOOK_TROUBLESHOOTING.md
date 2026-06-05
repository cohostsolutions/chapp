# Instagram Webhook Troubleshooting - "Cannot Validate Callback URL"

## The Problem

You're seeing this error when trying to save the webhook in Instagram settings:
```
The callback URL or verify token couldn't be validated. 
Please verify the provided information or try again later.
```

**Your Configuration:**
- Callback URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
- Verify Token: `alcornexus`

## Root Causes & Solutions

### 1. META_VERIFY_TOKEN Not Set in Supabase ⚠️ MOST LIKELY

**The Issue:** The webhook function needs the `META_VERIFY_TOKEN` environment variable to validate Facebook's verification request.

**How to Fix:**

#### Option A: Using Supabase Dashboard (Recommended)
1. Go to https://supabase.com/dashboard
2. Select your project (domipubyjkhsrmdwtabh)
3. Go to **Settings** → **Edge Functions** → **Environment Variables**
4. Click **Add New Variable**
5. Set:
   - Name: `META_VERIFY_TOKEN`
   - Value: `alcornexus`
6. Click **Save**
7. **Redeploy the function** (important!)

#### Option B: Using Supabase CLI
```bash
# Install Supabase CLI if not installed
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref domipubyjkhsrmdwtabh

# Set the secret
supabase secrets set META_VERIFY_TOKEN=alcornexus

# Redeploy the function
supabase functions deploy social-webhook
```

### 2. Webhook Function Not Deployed

**Check if function exists:**

Test the endpoint manually:
```bash
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123"
```

**Expected Response:** `test123` (the challenge value)

**If you get an error:**
- Function might not be deployed
- Function might have errors

**Solution:**
```bash
cd /path/to/canvascapital
supabase functions deploy social-webhook
```

### 3. META_APP_SECRET Not Set (Also Required)

The webhook also needs `META_APP_SECRET` for message signature verification.

**Set it the same way:**
```bash
supabase secrets set META_APP_SECRET=your_app_secret_from_facebook
```

Get your App Secret from: Facebook Developers → Your App → Settings → Basic

### 4. CORS or Network Issues

**Check function logs:**
```bash
supabase functions logs social-webhook --tail
```

While the logs are running, try to save the webhook in Facebook again. You should see the verification request.

### 5. Function Has Runtime Errors

**Check the verification code in your function:**

The function should have this code (already in your `social-webhook/index.ts`):
```typescript
if (req.method === 'GET') {
  const url = new URL(req.url);
  const mode = url.searchParams.get('hub.mode');
  const token = url.searchParams.get('hub.verify_token');
  const challenge = url.searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === META_VERIFY_TOKEN) {
    console.log('Webhook verified');
    return new Response(challenge, { status: 200 });
  } else {
    console.warn('Verification failed: Invalid mode or token');
    return new Response('Forbidden', { status: 403 });
  }
}
```

## Step-by-Step Fix

### Step 1: Set Environment Variables

**Via Supabase Dashboard:**
1. Go to https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions
2. Add these environment variables:
   - `META_VERIFY_TOKEN` = `alcornexus`
   - `META_APP_SECRET` = `[your app secret from Facebook]`

### Step 2: Redeploy Function

**Option A: Via Dashboard**
1. Go to Edge Functions → social-webhook
2. Click "Deploy" or "Redeploy"

**Option B: Via CLI**
```bash
supabase functions deploy social-webhook
```

### Step 3: Test Manually

Open this URL in your browser (replace with your values):
```
https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123
```

**You should see:** `test123`

**If you see:** 
- `Forbidden` → Wrong verify token or META_VERIFY_TOKEN not set
- `Internal Server Error` → Check function logs for errors
- Nothing/timeout → Function not deployed or crashed

### Step 4: Try Facebook Again

Once the test URL works, go back to Facebook and click "Verify and save" again.

## Quick Diagnostic Commands

### Test the webhook endpoint:
```bash
# Should return "test123"
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123"
```

### Check what happens with wrong token:
```bash
# Should return "Forbidden"
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test123"
```

### View function logs:
```bash
supabase functions logs social-webhook --tail
```

## Common Errors & Fixes

| Error | Cause | Fix |
|-------|-------|-----|
| "Cannot validate callback URL" | META_VERIFY_TOKEN not set | Set environment variable in Supabase |
| "Forbidden" in test | Wrong verify token | Check token matches exactly: `alcornexus` |
| "Internal Server Error" | Function code error | Check logs: `supabase functions logs` |
| Timeout | Function not deployed | Deploy: `supabase functions deploy` |
| 404 Not Found | Wrong URL | Verify URL is correct |

## Instagram-Specific Notes

Instagram webhooks have the same requirements as Facebook Messenger:
- ✅ Same webhook URL
- ✅ Same verify token
- ✅ Must be configured in Instagram product settings (not Facebook Login)

**Make sure:**
1. Instagram is added as a product in your Facebook App
2. You're configuring webhook in **Instagram** → **Configuration** → **Webhooks** (not Facebook Login)
3. Your Instagram account is a Business or Creator account
4. Instagram account is connected to a Facebook Page

## Still Not Working?

### Check Supabase Project Status
- Go to https://status.supabase.com/
- Verify no outages

### Verify Function is Running
- Go to Supabase Dashboard → Edge Functions
- Check if `social-webhook` shows as "Active"
- Check recent invocations

### Check Environment Variables
- Dashboard → Settings → Edge Functions → Environment Variables
- Verify `META_VERIFY_TOKEN` is set to `alcornexus`
- Verify `META_APP_SECRET` is set

### Try Alternative Token
Sometimes special characters cause issues. Try a simple token:
```
supabase secrets set META_VERIFY_TOKEN=alcornexus
```

## Next Steps After Fixing

Once the webhook validates successfully:

1. **Subscribe to fields** in Instagram webhook settings:
   - ✅ messages
   - ✅ messaging_postbacks
   - ✅ message_echoes

2. **Test by sending a message** to your Instagram account

3. **Check logs** to verify messages are received:
   ```bash
   supabase functions logs social-webhook --tail
   ```

4. **Verify in database** that messages are being stored:
   ```sql
   SELECT * FROM communications ORDER BY created_at DESC LIMIT 10;
   ```

## Contact Support

If still not working after trying all solutions:
1. Share function logs: `supabase functions logs social-webhook`
2. Share test result from: `curl https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test`
3. Verify META_VERIFY_TOKEN is set in Supabase dashboard

---

**Most Common Solution:** Set `META_VERIFY_TOKEN=alcornexus` in Supabase Edge Functions environment variables, then redeploy the function.
