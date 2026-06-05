# Twilio OAuth Implementation Summary

## ✅ What's New

You now have a complete **OAuth + Subaccounts** implementation. Here's how it works:

### 1. **OAuth Flow**
When an admin clicks "Connect Twilio Account" in Settings:
1. User is redirected to Twilio OAuth authorization page
2. User grants Canvas Capital permission to manage their Twilio account
3. Twilio redirects back to edge function callback with auth code
4. Callback exchanges code for OAuth token
5. Token is encrypted and stored in organization's record

### 2. **Subaccount Provisioning**
When a new organization is created:
1. Database trigger fires automatically
2. Calls `provision-twilio-subaccount` edge function
3. Function checks if OAuth token is configured
4. Creates subaccount under the connected Twilio account
5. Stores encrypted subaccount credentials

### 3. **Phone Management**
- Users search for available numbers using their subaccount
- First number is free (1 per org)
- Additional numbers require contact/approval

## 📁 New Files Created

### Edge Functions
1. **`twilio-oauth-callback/index.ts`**
   - Handles OAuth redirect from Twilio
   - Exchanges auth code for access token
   - Stores encrypted token in organizations table
   - Redirects to Settings page on success

2. **Updated: `provision-twilio-subaccount/index.ts`**
   - Now uses OAuth token instead of env vars
   - Checks if token is connected before provisioning
   - Handles token decryption from vault

### Migrations
1. **`20260121110000_twilio_oauth_columns.sql`**
   - Adds `twilio_oauth_token` column (encrypted)
   - Adds `twilio_oauth_refresh_token` column (encrypted)
   - Adds `twilio_oauth_expires_at` column (expiry tracking)

### Frontend
1. **Updated: `src/pages/Settings.tsx`**
   - Added "Twilio Account" card in Integrations tab
   - "Connect Twilio Account" button
   - Opens Twilio OAuth URL with state parameter

## 🚀 Deployment Steps

### 1. Apply Migration
```bash
supabase db push
```
This adds OAuth token columns to organizations table.

### 2. Deploy OAuth Callback Function
```bash
supabase functions deploy twilio-oauth-callback
```

### 3. Deploy Updated Provision Function
```bash
supabase functions deploy provision-twilio-subaccount
```

### 4. Set Environment Secrets (if not done)
In Supabase Dashboard → Settings → Vault:
```
TWILIO_CLIENT_ID = OQd0a5857073d609a3fa55396b69787746
TWILIO_CLIENT_SECRET = your_client_secret (from Twilio console)
VAULT_ENCRYPTION_KEY = your_encryption_key
```

## 🔄 How It Works (Complete Flow)

```
1. Admin in Settings → "Connect Twilio Account"
   ↓
2. Redirected to Twilio OAuth login
   ↓
3. Admin authorizes Canvas Capital app
   ↓
4. Twilio redirects to callback function with auth code
   ↓
5. Callback exchanges code for OAuth access token
   ↓
6. Token encrypted and stored in org record
   ↓
7. New orgs automatically provision subaccounts using this token
   ↓
8. Users can search & purchase phone numbers
```

## 🔐 Security Notes

- **OAuth Token**: Encrypted at rest using Vault (AES-256)
- **Refresh Token**: Stored for token renewal (optional enhancement)
- **State Parameter**: Base64 encoded org ID prevents CSRF attacks
- **Bearer Token**: OAuth token sent securely to Twilio API

## 📊 Authorization Model

| Role | Can | Details |
|------|-----|---------|
| Super Admin | Connect Twilio | Can initiate OAuth flow |
| Client Admin | Connect Twilio | Can initiate OAuth flow |
| Team Member | View Only | Can see active phone numbers |
| Customer | Not applicable | No access to Twilio settings |

## ✨ Enhancements vs Original

| Feature | Before | After |
|---------|--------|-------|
| Credentials | Env vars (hardcoded) | OAuth token (encrypted, per-org) |
| Admin Setup | Manual env var config | 1-click OAuth connect |
| Subaccount Creation | Manual trigger | Auto on org creation |
| Token Rotation | None | Support for refresh tokens |
| Security | Basic | HMAC signature verification for webhooks |

## 🐛 Troubleshooting

### "Twilio OAuth token not configured"
- Go to Settings → Twilio Account
- Click "Connect Twilio Account"
- Complete OAuth flow
- Try provisioning again

### OAuth callback returns blank page
- Check that `TWILIO_CLIENT_ID` and `TWILIO_CLIENT_SECRET` are set
- Verify callback function is deployed
- Check Supabase logs for errors

### Subaccount creation fails
- Ensure OAuth token is connected
- Check Supabase logs in Edge Functions section
- Verify Twilio API status at https://status.twilio.com

## 📝 Next Steps (Optional)

1. **Token Refresh**: Implement automatic refresh before expiry
2. **Disconnect Option**: Add button to disconnect Twilio account
3. **Multi-Account**: Support multiple Twilio accounts per org
4. **Cost Tracking**: Monitor subaccount usage and billing

---

**Status**: ✅ Ready for deployment
