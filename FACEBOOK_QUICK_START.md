# 🚀 Quick Start: Fix All Facebook Pages

## TL;DR - Do This Now

### 1️⃣ Deploy Functions
```bash
cd /workspaces/canvascapital
supabase functions deploy social-webhook
supabase functions deploy subscribe-facebook-webhook
supabase functions deploy subscribe-facebook-webhooks-bulk
```

### 2️⃣ Subscribe All Pages (Pick ONE)

**Option A - Easiest (Shell Script)**:
```bash
chmod +x subscribe-all-facebook-pages.sh

# Get your auth token from browser console:
# JSON.parse(localStorage.getItem('supabase.auth.token')).session.access_token

./subscribe-all-facebook-pages.sh "YOUR_AUTH_TOKEN" "https://yourproject.supabase.co"
```

**Option B - Direct curl**:
```bash
curl -X POST https://yourproject.supabase.co/functions/v1/subscribe-facebook-webhooks-bulk \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{}'
```

**Option C - Supabase Dashboard**:
1. Edge Functions → subscribe-facebook-webhooks-bulk
2. Click "Test"
3. Click "Send"

### 3️⃣ Verify Success
```json
Expected response:
{
  "success": true,
  "total": 3,
  "successful": 3,
  "failed": 0
}
```

### 4️⃣ Test It
1. Send message to GuilCor Agrimac Facebook page
2. Check ChatLogs - should appear
3. AI should respond automatically ✅

---

## Pages Fixed

- ✅ **GuilCor Agrimac** (Facebook)
- ✅ **CoHost Solutions** (Facebook)
- ✅ **AlCor Nexus** (Facebook + Instagram)

---

## What Was Changed

| Component | Change | Why |
|-----------|--------|-----|
| `social-webhook` | Now checks `facebook_pages` table | Routes messages from manual pages |
| New function | `subscribe-facebook-webhook` | Subscribe single page |
| New function | `subscribe-facebook-webhooks-bulk` | Subscribe all pages at once |
| New script | `subscribe-all-facebook-pages.sh` | Easy CLI tool |

---

## If Something Goes Wrong

**Pages not appearing in ChatLogs?**
- Check Supabase logs: Edge Functions → social-webhook → Logs
- Look for: "Found matching facebook page config"

**Token error?**
- Check: `SELECT * FROM facebook_pages WHERE is_enabled = true`
- Verify access tokens aren't expired

**Forbidden error?**
- Need admin role to run subscription
- User must be client_admin or super_admin

---

## Detailed Docs

For more details, see:
- `/FACEBOOK_PAGES_FIX_SUMMARY.md` - Full implementation summary
- `/BULK_FACEBOOK_PAGES_GUIDE.md` - Comprehensive bulk guide
- `/FACEBOOK_WEBHOOK_FIX_GUIDE.md` - Single page guide

---

**That's it!** Your Facebook pages will start receiving messages and AI responses automatically. 🎉
