# Facebook SDK Integration - Quick Start

## ✅ Completed Changes

### 1. **Facebook SDK in index.html**
- Added Facebook SDK initialization script
- Configured with `VITE_FACEBOOK_APP_ID` from environment variables
- SDK version: v17.0

### 2. **Vite Configuration Updated**
- Added `htmlEnvPlugin` to inject environment variables into HTML
- Replaces `%VITE_FACEBOOK_APP_ID%` at build time

### 3. **Environment Variables**
- Added `VITE_FACEBOOK_APP_ID` to `.env.example`
- This variable must be added to your `.env` file

## 🚀 Next Steps

### Required: Configure Environment Variables

Add to your `.env` file:
```env
VITE_FACEBOOK_APP_ID=your_facebook_app_id_here
FACEBOOK_APP_SECRET=your_facebook_app_secret_here
```

### How to Get Your Facebook App ID:

1. Go to https://developers.facebook.com/apps
2. Create a new app or select an existing one
3. Copy the **App ID** from the dashboard
4. Copy the **App Secret** from Settings > Basic
5. Add both to your `.env` file

### Verify Setup:

Run this command to verify the integration:
```bash
# Check if environment variables are set
grep "VITE_FACEBOOK_APP_ID" .env

# Check if SDK is in HTML
grep "facebook-jssdk" index.html

# Check if plugin is in vite config
grep "htmlEnvPlugin" vite.config.ts
```

## 📍 Where to Use

The Facebook SDK is now available in the **Settings > Social Platforms** tab:

- **Connect Facebook** - OAuth flow for connecting Facebook accounts
- **Refresh Accounts** - Re-fetch connected pages and accounts
- **Platform Management** - Enable/disable individual platforms

## 🔧 Technical Details

### SDK Access
The SDK is globally available via `window.FB`:

```typescript
const fbWindow = window as any;
if (fbWindow.FB) {
  // SDK is loaded and ready
  fbWindow.FB.login((response: any) => {
    // Handle login
  });
}
```

### Existing Integration Points
The SDK works with:
- `/src/components/settings/SocialPlatformsTab.tsx` - Main UI
- `/src/pages/FacebookCallback.tsx` - Facebook OAuth callback handler
- `/src/pages/InstagramCallback.tsx` - Instagram OAuth callback handler  
- `/src/pages/WhatsAppCallback.tsx` - WhatsApp OAuth callback handler
- `/supabase/functions/facebook-connect/` - Backend OAuth handler

## 📚 Documentation

See [FACEBOOK_SDK_SETUP.md](./FACEBOOK_SDK_SETUP.md) for:
- Detailed setup instructions
- OAuth configuration
- Required permissions
- Troubleshooting guide
- Security best practices

## ⚠️ Important Security Notes

1. **Never commit** your `.env` file
2. `VITE_FACEBOOK_APP_ID` is **public** (client-side, safe to expose)
3. `FACEBOOK_APP_SECRET` is **private** (server-side only, keep secret)

## 🎯 Quick Test

After configuring your `.env` file:

```bash
# Start the development server
npm run dev

# Navigate to Settings > Social Platforms
# Click "Connect Facebook" button
# You should see the Facebook OAuth dialog
```

## Files Modified

1. ✅ `/index.html` - Added Facebook SDK script
2. ✅ `/vite.config.ts` - Added HTML environment plugin
3. ✅ `/.env.example` - Added VITE_FACEBOOK_APP_ID variable
4. ✅ `/src/App.tsx` - Added callback routes
5. ✅ `/src/pages/InstagramCallback.tsx` - Instagram OAuth handler
6. ✅ `/src/pages/WhatsAppCallback.tsx` - WhatsApp OAuth handler
7. 📄 `/FACEBOOK_SDK_SETUP.md` - Complete documentation
8. 📄 `/FACEBOOK_SDK_QUICKSTART.md` - This file

## OAuth Callback URIs

Add these to your Facebook App settings:

**Development:**
```
http://localhost:8080/facebook-callback
http://localhost:8080/instagram-callback
http://localhost:8080/whatsapp-callback
```

**Production:**
```
https://yourdomain.com/facebook-callback
https://yourdomain.com/instagram-callback
https://yourdomain.com/whatsapp-callback
```

---

**Status**: Ready to use after configuring environment variables and OAuth redirect URIs
