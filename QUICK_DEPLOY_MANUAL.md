# Quick Deploy - Edge Functions Migration

The automated script stopped during secrets setup. Here's the manual approach:

## Step 1: Set Secrets (Copy & Paste These Commands)

```bash
# Critical Meta/Facebook secrets
supabase secrets set META_VERIFY_TOKEN=alcornexus
supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
supabase secrets set FACEBOOK_APP_ID=823361387270732
supabase secrets set FACEBOOK_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2

# Core Supabase secrets
supabase secrets set SUPABASE_URL=https://domipubyjkhsrmdwtabh.supabase.co
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRvbWlwdWJ5amtoc3JtZHd0YWJoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODcxODMxMCwiZXhwIjoyMDg0Mjk0MzEwfQ.8DMkPlBDnnu108bNVQl3qpcQy0SmWobieR7uNmDc380
supabase secrets set SUPABASE_ANON_KEY=sb_publishable_WfCeSV9IOdnVa6NpqjdFBQ_Z-40I-js
```

## Step 2: Set Your API Keys (YOU NEED THESE)

```bash
# Get Google API Key from: https://makersuite.google.com/app/apikey
supabase secrets set GOOGLE_API_KEY=your-google-api-key-here

# Get Resend API Key from: https://resend.com/api-keys
supabase secrets set RESEND_API_KEY=your-resend-api-key-here
```

## Step 3: Deploy All Functions

```bash
supabase functions deploy
```

This will deploy all 53 functions at once (takes 5-10 minutes).

## Step 4: Verify Deployment

```bash
# List deployed functions
supabase functions list

# Test health check
curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check'

# Test social webhook
curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123'
```

Expected response from webhook test: `test123`

## Step 5: Update External Webhooks

### Facebook/Instagram
1. Go to: https://developers.facebook.com/apps/823361387270732/webhooks/
2. Callback URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
3. Verify Token: `alcornexus`
4. Click "Verify and Save"

### Twilio (if using)
1. Go to: https://console.twilio.com/
2. Voice Webhook: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook`

## Optional: Set Additional Secrets

```bash
# Twilio (for SMS/Voice)
supabase secrets set TWILIO_ACCOUNT_SID=your-sid
supabase secrets set TWILIO_AUTH_TOKEN=your-token
supabase secrets set TWILIO_PHONE_NUMBER=your-number

# OpenAI (optional alternative AI)
supabase secrets set OPENAI_API_KEY=your-key

# ElevenLabs (for text-to-speech)
supabase secrets set ELEVENLABS_API_KEY=your-key
```

## Check Secrets

```bash
supabase secrets list
```

## View Logs

```bash
# All functions
supabase functions logs --follow

# Specific function
supabase functions logs ai-chat --follow
```

---

## What Went Wrong?

The automated script likely had issues with:
- Reading from .env file
- Setting multiple secrets at once
- Or a timeout issue

The manual approach above is more reliable and gives you better control.

---

## Quick Reference

| Command | Purpose |
|---------|---------|
| `supabase secrets set KEY=value` | Set a secret |
| `supabase secrets list` | List all secrets |
| `supabase functions deploy` | Deploy all functions |
| `supabase functions deploy <name>` | Deploy one function |
| `supabase functions list` | List deployed functions |
| `supabase functions logs <name>` | View function logs |

---

**Next:** Copy and paste the commands from Step 1 above into your terminal!
