# Instagram/Facebook OAuth Troubleshooting

## Quick Fix: "Callback URL Can't Be Verified"

### The Solution ✅

**Only use `/facebook-callback` in your Facebook App settings.**

Instagram Business and WhatsApp Business accounts are accessed through Facebook Pages, so they all use the same Facebook OAuth flow.

### Steps to Fix

1. **Go to Facebook Developers Console**: https://developers.facebook.com/apps
2. **Select your app** → **Facebook Login** → **Settings**
3. **Add ONLY these URLs** to "Valid OAuth Redirect URIs":
   ```
   http://localhost:8080/facebook-callback
   https://yourdomain.com/facebook-callback
   ```
4. **Remove** `/instagram-callback` and `/whatsapp-callback` if you added them
5. **Click "Save Changes"**

## Why This Works

```
┌─────────────────────────────────────────────────────┐
│                   User's Facebook                    │
│                      Account                         │
└───────────────────┬─────────────────────────────────┘
                    │
                    │ Connected to
                    ▼
        ┌───────────────────────┐
        │   Facebook Pages      │
        │  (e.g., Business Page) │
        └───────┬───────────────┘
                │
                ├─── Instagram Business Account
                │    (accessed via Page)
                │
                └─── WhatsApp Business Number
                     (accessed via Page)
```

**One OAuth flow gets everything through Facebook Pages.**

## Common Mistakes

### ❌ Mistake 1: Adding Multiple Callback URLs
```
DO NOT ADD:
- /instagram-callback
- /whatsapp-callback
```
These are not needed for Instagram Business or WhatsApp Business.

### ❌ Mistake 2: Using Instagram Basic Display
Instagram Basic Display API is for **personal accounts only**.
- ❌ Don't use for business features
- ❌ Don't confuse with Instagram Graph API
- ✅ Use Instagram Graph API (via Facebook Pages)

### ❌ Mistake 3: Wrong Instagram Account Type
Your Instagram account must be:
- ✅ Business account OR Creator account
- ✅ Connected to a Facebook Page
- ❌ NOT a personal account

## How to Check Your Setup

### 1. Verify Facebook App Configuration

```bash
# Check redirect URIs in Facebook App
# Should only show /facebook-callback
```

### 2. Verify Instagram is Connected to Facebook Page

1. Open Instagram app
2. Go to **Settings** → **Account** → **Linked accounts**
3. Ensure **Facebook** is connected
4. Go to **Settings** → **Account** → **Switch account type**
5. Verify it says "Business" or "Creator"

### 3. Test the Connection

```bash
# In your browser console after clicking "Connect Facebook":
localStorage.getItem('fb_oauth_state')  # Should exist
# After redirect:
localStorage.getItem('fb_oauth_state')  # Should be cleared
```

## Testing Checklist

- [ ] Facebook App has `/facebook-callback` in OAuth redirect URIs
- [ ] Instagram account is Business or Creator type
- [ ] Instagram is linked to a Facebook Page
- [ ] Facebook App has required permissions:
  - [ ] `pages_show_list`
  - [ ] `instagram_basic`
  - [ ] `instagram_manage_messages`
- [ ] VITE_FACEBOOK_APP_ID is set in `.env`
- [ ] App can connect to Facebook successfully
- [ ] Backend logs show: "Linked Instagram account: {username}"

## Still Having Issues?

### Issue: Instagram Account Not Appearing

**Check backend logs** for:
```
[Facebook Connect] Linked Instagram account: username
```

If not appearing:
1. Instagram might not be connected to the Facebook Page
2. Page might not have Instagram permission
3. User might not be Page admin

**Debug query**:
```bash
curl -X GET \
  "https://graph.facebook.com/v17.0/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=YOUR_USER_TOKEN"
```

### Issue: Permission Errors

Some permissions require **App Review**:
- `instagram_basic`
- `instagram_manage_messages`
- `pages_messaging`

**Solution**: Submit your app for review in Facebook Developers Console

### Issue: Token Expiry

Tokens expire after 60 days. Use the "Refresh Accounts" button to renew them.

**Check token expiry**:
```sql
SELECT 
  display_name,
  credentials->>'token_expires_at' as expires_at
FROM social_platforms
WHERE platform = 'instagram';
```

## API Endpoints Reference

### Get Instagram Account from Page
```bash
GET https://graph.facebook.com/v17.0/{PAGE_ID}
  ?fields=instagram_business_account{id,name,username}
  &access_token={PAGE_ACCESS_TOKEN}
```

### Get Instagram Messages
```bash
GET https://graph.facebook.com/v17.0/{IG_ACCOUNT_ID}/conversations
  ?platform=instagram
  &access_token={PAGE_ACCESS_TOKEN}
```

## Resources

- [Instagram OAuth Guide](./INSTAGRAM_OAUTH_GUIDE.md) - Detailed explanation
- [Facebook SDK Setup](./FACEBOOK_SDK_SETUP.md) - Complete setup guide
- [Instagram Graph API Docs](https://developers.facebook.com/docs/instagram-api)
- [Facebook Login Settings](https://developers.facebook.com/apps)

## Summary

✅ **Use only `/facebook-callback`** in Facebook App settings

✅ **Instagram Business** accounts come through Facebook Pages

✅ **No separate Instagram OAuth** needed for business accounts

✅ **WhatsApp Business** also uses the same flow

The `/instagram-callback` and `/whatsapp-callback` routes exist in your code but are **not used** for the current Instagram Business + WhatsApp Business implementation. They're optional for potential future features.
