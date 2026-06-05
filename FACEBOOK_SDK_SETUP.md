# Facebook SDK Setup Guide

## Overview
The Facebook SDK has been integrated into the Social Platforms tab in settings to enable seamless Meta platform integrations (Facebook Messenger, WhatsApp Business, and Instagram DMs).

## Implementation Details

### 1. SDK Integration in `index.html`
The Facebook SDK is loaded asynchronously in the main HTML file:

```html
<script>
  window.fbAsyncInit = function() {
    FB.init({
      appId      : '%VITE_FACEBOOK_APP_ID%',
      cookie     : true,
      xfbml      : true,
      version    : 'v17.0'
    });
      
    FB.AppEvents.logPageView();   
  };

  (function(d, s, id){
     var js, fjs = d.getElementsByTagName(s)[0];
     if (d.getElementById(id)) {return;}
     js = d.createElement(s); js.id = id;
     js.src = "https://connect.facebook.net/en_US/sdk.js";
     fjs.parentNode.insertBefore(js, fjs);
   }(document, 'script', 'facebook-jssdk'));
</script>
```

### 2. Vite Configuration
A custom Vite plugin (`htmlEnvPlugin`) replaces the `%VITE_FACEBOOK_APP_ID%` placeholder at build time:

```typescript
function htmlEnvPlugin(): Plugin {
  return {
    name: 'html-env-plugin',
    transformIndexHtml(html) {
      return html.replace(
        /%VITE_FACEBOOK_APP_ID%/g,
        process.env.VITE_FACEBOOK_APP_ID || ''
      );
    },
  };
}
```

### 3. Environment Variables
Add the following to your `.env` file:

```env
VITE_FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
```

**Important:** The `VITE_` prefix exposes the variable to the client-side code, which is necessary for the Facebook SDK to function properly.

## Configuration Steps

### Step 1: Create a Facebook App
1. Go to [Facebook Developers](https://developers.facebook.com/)
2. Create a new app or use an existing one
3. Note your **App ID** and **App Secret**

### Step 2: Configure Environment Variables
1. Copy your App ID and Secret to your `.env` file:
   ```env
   VITE_FACEBOOK_APP_ID=123456789012345
   FACEBOOK_APP_SECRET=your_app_secret_here
   ```

### Step 3: Set Up OAuth Redirect URIs

**Important: Instagram Business and WhatsApp use Facebook OAuth**

Instagram Business accounts and WhatsApp Business numbers are accessed through Facebook Pages, so they all use the same OAuth flow and callback URL.

In your Facebook App settings (**Facebook Login** → **Settings**), add these redirect URIs:

**Development:**
- `http://localhost:8080/facebook-callback`

**Production:**
- `https://yourdomain.com/facebook-callback`

**Note:** 
- ❌ Do NOT add `/instagram-callback` or `/whatsapp-callback` to Facebook Login settings
- ✅ All three platforms (Facebook, Instagram Business, WhatsApp Business) use `/facebook-callback`
- These platforms are accessed through Facebook Pages they're connected to
- The separate callback pages exist only for potential future features (like Instagram Basic Display for personal accounts)

For detailed information about Instagram OAuth, see [INSTAGRAM_OAUTH_GUIDE.md](./INSTAGRAM_OAUTH_GUIDE.md)

### Step 4: Configure Required Permissions
Your app needs these permissions:
- `pages_show_list` - List pages
- `pages_read_engagement` - Read page engagement
- `pages_manage_metadata` - Manage page metadata
- `pages_messaging` - Send/receive messages
- `instagram_basic` - Basic Instagram access
- `instagram_manage_messages` - Instagram DM management
- `whatsapp_business_management` - WhatsApp Business management
- `whatsapp_business_messaging` - WhatsApp messaging

## Usage in the Application

### Social Platforms Tab
The SDK is automatically available in the **Settings > Social Platforms** tab:

1. **Connect Facebook Button**: Initiates OAuth flow
2. **Refresh Accounts Button**: Re-fetches connected pages/accounts
3. **Platform Management**: Enable/disable connected platforms

### Code Example
The SDK is accessed via the global `FB` object:

```typescript
const fbWindow = window as any;
if (fbWindow.FB) {
  fbWindow.FB.login((response: any) => {
    if (response.authResponse) {
      const accessToken = response.authResponse.accessToken;
      // Use the access token...
    }
  }, { scope: 'pages_show_list,pages_messaging' });
}
```

## Existing Implementation

The Facebook SDK integration works with these existing components:

1. **`SocialPlatformsTab.tsx`**: Main UI for managing social platforms
   - Location: `/src/components/settings/SocialPlatformsTab.tsx`
   - Handles Facebook OAuth and account management

2. **`FacebookCallback.tsx`**: OAuth callback handler
   - Processes OAuth responses from Facebook
   - Exchanges tokens with backend

3. **`InstagramCallback.tsx`**: Instagram-specific OAuth callback
   - Handles Instagram account connections
   - Location: `/src/pages/InstagramCallback.tsx`

4. **`WhatsAppCallback.tsx`**: WhatsApp-specific OAuth callback
   - Handles WhatsApp Business account connections
   - Location: `/src/pages/WhatsAppCallback.tsx`

5. **Backend Functions**:
   - `facebook-connect`: Handles OAuth token exchange
   - `refresh-facebook-tokens`: Refreshes expired tokens
   - `social-webhook`: Receives webhooks from Meta platforms

## Troubleshooting

### SDK Not Loading
- Check browser console for errors
- Verify `VITE_FACEBOOK_APP_ID` is set in `.env`
- Ensure the app is running on the correct domain (matches Facebook App settings)

### OAuth Errors
- Verify redirect URIs in Facebook App settings
- Check that all required permissions are configured
- Ensure App ID matches between `.env` and Facebook Developer Console

### Token Expiry
- Tokens expire after 60 days by default
- Use the "Refresh Accounts" button to renew tokens
- Backend automatically attempts token refresh for expired tokens

## Security Notes

1. **Never commit** `.env` files to version control
2. The `VITE_FACEBOOK_APP_ID` is **public** (client-side)
3. The `FACEBOOK_APP_SECRET` must remain **private** (server-side only)
4. Use the `META_APP_SECRET` for webhook verification

## API Version

Current SDK version: **v17.0**

To update the version, modify the `version` parameter in `index.html`:
```javascript
FB.init({
  // ...
  version: 'v17.0'  // Update this
});
```

## Resources

- [Facebook SDK for JavaScript](https://developers.facebook.com/docs/javascript/)
- [Facebook Login Flow](https://developers.facebook.com/docs/facebook-login/web)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)
- [Instagram Messaging API](https://developers.facebook.com/docs/messenger-platform/instagram)

## Related Files

- `/index.html` - SDK initialization
- `/vite.config.ts` - Environment variable injection
- `/src/components/settings/SocialPlatformsTab.tsx` - Main UI
- `/src/pages/FacebookCallback.tsx` - Facebook OAuth callback handler
- `/src/pages/InstagramCallback.tsx` - Instagram OAuth callback handler
- `/src/pages/WhatsAppCallback.tsx` - WhatsApp OAuth callback handler
- `/src/App.tsx` - Route definitions
- `/supabase/functions/facebook-connect/index.ts` - Backend OAuth handler
- `/.env.example` - Environment variable template
