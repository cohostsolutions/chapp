# Social Webhook Deployment Guide

## Issue
The function deployment failed with: `Module not found "_shared/logger.ts"`

## Solution

The issue is that Supabase's bundler needs to include the `_shared` directory when deploying. Here are the steps:

### Option 1: Deploy from functions directory (Recommended)

```bash
cd /workspaces/canvascapital/supabase/functions
supabase functions deploy social-webhook --project-ref domipubyjkhsrmdwtabh
```

### Option 2: Deploy with --no-verify-jwt flag (if needed)

```bash
cd /workspaces/canvascapital
supabase functions deploy social-webhook --project-ref domipubyjkhsrmdwtabh --no-verify-jwt
```

### Option 3: Ensure _shared is included

The `_shared` directory should automatically be included. If it's not, ensure you're deploying from the correct directory:

```bash
cd /workspaces/canvascapital
supabase functions deploy social-webhook --project-ref domipubyjkhsrmdwtabh
```

### Option 4: Use Supabase Dashboard

1. Go to https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/functions
2. Click "Create a new function" or edit existing
3. Upload the entire `social-webhook` directory INCLUDING the parent `functions` folder structure
4. Or copy-paste the code directly into the online editor

## After Deployment

Set environment secrets:

```bash
supabase secrets set META_VERIFY_TOKEN=alcornexus --project-ref domipubyjkhsrmdwtabh
supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2 --project-ref domipubyjkhsrmdwtabh
supabase secrets set GOOGLE_API_KEY=YOUR_GEMINI_API_KEY --project-ref domipubyjkhsrmdwtabh
supabase secrets set VAULT_ENCRYPTION_KEY=YOUR_VAULT_KEY --project-ref domipubyjkhsrmdwtabh
```

## Webhook Configuration

After successful deployment:

**Callback URL:** `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`  
**Verify Token:** `alcornexus`

Configure in Meta Developer Console for:
- Facebook Messenger
- Instagram
- WhatsApp
