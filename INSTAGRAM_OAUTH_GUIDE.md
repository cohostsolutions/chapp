# Instagram OAuth Integration Guide

## Understanding Instagram + Facebook OAuth

There are **two different Instagram APIs** with different OAuth flows:

### 1. Instagram Graph API (Business Accounts) ✅ Currently Implemented
- **Access via**: Facebook Pages connected to Instagram Business accounts
- **OAuth Flow**: Standard Facebook OAuth (same as Facebook Messenger)
- **Callback URL**: Use `/facebook-callback` only
- **Requirements**:
  - Instagram account must be a Business or Creator account
  - Must be connected to a Facebook Page
  - Facebook Page needs proper permissions

### 2. Instagram Basic Display API (Personal Accounts) ❌ Not Implemented
- **Access via**: Separate Instagram OAuth flow
- **OAuth Flow**: Instagram-specific OAuth
- **Callback URL**: Separate `/instagram-callback`
- **Use Case**: Personal Instagram accounts (not Business)
- **Not recommended**: Limited features, requires separate app setup

## Current Implementation (Instagram Graph API)

Your app currently uses **Instagram Graph API** which is the correct approach for business use:

```
User → Facebook OAuth → Gets Pages → Checks each Page for Instagram Business Account
```

### How It Works

1. User clicks "Connect Facebook" in Social Platforms
2. Facebook OAuth requests these permissions:
   - `pages_show_list` - List user's Facebook Pages
   - `instagram_basic` - Access Instagram accounts
   - `instagram_manage_messages` - Manage Instagram DMs
3. After authorization, backend:
   - Fetches all Facebook Pages
   - For each Page, checks: `/{page-id}?fields=instagram_business_account`
   - If Instagram account found, stores it in `social_platforms`

## Solving "Callback URL Can't Be Verified" Error

### Solution 1: Use Facebook Callback Only (Recommended)

**Remove the separate Instagram callback** - it's not needed for Instagram Business accounts.

1. **In Facebook App Settings**:
   - Go to **Facebook Login** → **Settings**
   - Add only:
     ```
     http://localhost:8080/facebook-callback
     https://yourdomain.com/facebook-callback
     ```

2. **Don't add** `/instagram-callback` to Facebook Login product

3. **In your app**: All Instagram connections go through Facebook OAuth flow

### Solution 2: If You Need Instagram Basic Display

If you specifically need personal Instagram accounts (rare), you must:

1. **Add Instagram Basic Display Product** to your Facebook App
2. **Configure separate OAuth**:
   - Client ID (different from Facebook App ID)
   - Redirect URI: `https://yourdomain.com/instagram-callback`
   - Scopes: `user_profile`, `user_media`
3. **Use different OAuth endpoint**: `https://api.instagram.com/oauth/authorize`

## Common Issues & Solutions

### Issue 1: "Invalid Redirect URI"
**Cause**: Callback URL not whitelisted in Facebook App
**Solution**: Add only `/facebook-callback` to Facebook Login settings

### Issue 2: "Instagram Account Not Found"
**Cause**: Instagram account not connected to Facebook Page
**Solution**: 
1. Go to Instagram app → Settings → Account → Linked accounts
2. Connect to Facebook
3. Convert to Business/Creator account
4. Link to a Facebook Page

### Issue 3: "Permissions Not Granted"
**Cause**: Instagram permissions not approved by Meta
**Solution**:
1. Submit app for review
2. Request these permissions:
   - `instagram_basic`
   - `instagram_manage_messages`
   - `pages_show_list`
   - `pages_manage_metadata`

### Issue 4: "Token Can't Be Verified"
**Cause**: Using Page token instead of User token for Instagram API
**Solution**: Already handled in your implementation - Page tokens work for Instagram Business API

## Recommended Configuration

### Facebook App Settings

**Products Required**:
- ✅ Facebook Login
- ✅ Messenger
- ✅ Instagram (under Messenger Platform)
- ❌ Instagram Basic Display (NOT needed)

**Facebook Login Settings**:
```
Valid OAuth Redirect URIs:
- http://localhost:8080/facebook-callback
- https://yourdomain.com/facebook-callback
```

**Permissions**:
```
Standard Access (automatically approved):
- email
- public_profile

Advanced Access (requires review):
- pages_show_list
- pages_read_engagement
- pages_manage_metadata
- pages_messaging
- instagram_basic
- instagram_manage_messages
```

## Implementation Changes Needed

Since Instagram Business accounts use Facebook OAuth:

1. **Keep** `/facebook-callback` - handles everything
2. **Optional**: Keep `/instagram-callback` for future Instagram Basic Display
3. **Remove** separate Instagram OAuth initiation (not needed)
4. **Update** UI to clarify Instagram requires Facebook Page connection

## Testing Instagram Integration

### Step 1: Verify Instagram Business Setup
```bash
# Check if Instagram is connected to Facebook Page
curl -X GET \
  "https://graph.facebook.com/v17.0/{PAGE_ID}?fields=instagram_business_account&access_token={PAGE_TOKEN}"
```

### Step 2: Test OAuth Flow
1. Click "Connect Facebook" in Social Platforms
2. Authorize all permissions including Instagram
3. Check backend logs for: "Linked Instagram account: {username}"
4. Verify in database: `social_platforms` table, `platform='instagram'`

### Step 3: Verify Token Validity
```sql
SELECT 
  display_name,
  platform,
  is_enabled,
  credentials->>'instagram_account_id' as ig_id,
  credentials->>'instagram_username' as ig_username,
  credentials->>'token_expires_at' as expires
FROM social_platforms
WHERE platform = 'instagram'
  AND organization_id = '{YOUR_ORG_ID}';
```

## Code Updates Recommended

### Update SocialPlatformsTab.tsx

Change the UI to clarify Instagram connection:

```tsx
// Add info alert for Instagram
<Alert>
  <Info className="h-4 w-4" />
  <AlertTitle>Instagram Business Accounts</AlertTitle>
  <AlertDescription>
    Instagram Business accounts are connected through Facebook Pages.
    Click "Connect Facebook" to link both Facebook and Instagram accounts.
  </AlertDescription>
</Alert>
```

### Simplify Callback Routes

You can optionally remove separate Instagram/WhatsApp callbacks:

```tsx
// In App.tsx - These are optional, not used in current flow
<Route path="/instagram-callback" element={...} />  // Optional
<Route path="/whatsapp-callback" element={...} />   // Optional
```

## Summary

**For Instagram Business (recommended)**:
- ✅ Use Facebook OAuth flow
- ✅ Single callback: `/facebook-callback`
- ✅ Instagram accounts fetched via connected Facebook Pages
- ✅ No separate Instagram callback needed

**For Instagram Personal (not recommended)**:
- Requires separate Instagram Basic Display API
- Different OAuth flow and callback
- Limited business features
- More complex setup

## Next Steps

1. **Remove** `/instagram-callback` from Facebook App OAuth settings
2. **Keep** only `/facebook-callback`
3. **Test** the flow - Instagram accounts will appear automatically
4. **Update** UI to clarify Instagram comes through Facebook Pages
5. **Submit** app for Instagram permission review if needed

## Resources

- [Instagram Graph API](https://developers.facebook.com/docs/instagram-api)
- [Instagram Business Account Requirements](https://developers.facebook.com/docs/instagram-api/getting-started)
- [Facebook Pages + Instagram Connection](https://developers.facebook.com/docs/instagram-api/overview#instagram-user-access-tokens)
