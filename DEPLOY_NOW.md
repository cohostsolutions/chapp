# ✅ CORRECTED: Quick Deploy Commands

## What Happened?

Supabase **automatically provides** these variables to all edge functions:
- `SUPABASE_URL` 
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_ANON_KEY`

You don't need to set them! ✅

---

## Step 1: Set Required Secrets (Copy These)

```bash
# Meta/Facebook secrets (for social messaging)
supabase secrets set META_VERIFY_TOKEN=alcornexus
supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
supabase secrets set FACEBOOK_APP_ID=823361387270732
supabase secrets set FACEBOOK_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
supabase secrets set META_APP_ID=823361387270732
```

## Step 2: Set Your API Keys

### Google API Key (Required for AI)
Get from: https://makersuite.google.com/app/apikey

```bash
supabase secrets set GOOGLE_API_KEY=your-actual-google-api-key
```

### Resend API Key (Required for Email)
Get from: https://resend.com/api-keys

```bash
supabase secrets set RESEND_API_KEY=your-actual-resend-api-key
```

## Step 3: Optional Services

### Twilio (for SMS/Voice)
```bash
supabase secrets set TWILIO_ACCOUNT_SID=your-sid
supabase secrets set TWILIO_AUTH_TOKEN=your-token
supabase secrets set TWILIO_PHONE_NUMBER=your-number
```

### OpenAI (optional AI alternative)
```bash
supabase secrets set OPENAI_API_KEY=your-key
```

### ElevenLabs (for text-to-speech)
```bash
supabase secrets set ELEVENLABS_API_KEY=your-key
```

---

## Step 4: Verify Secrets

```bash
supabase secrets list
```

You should see all the secrets you set (but NOT SUPABASE_* ones - those are automatic).

---

## Step 5: Deploy All Functions

```bash
supabase functions deploy
```

This deploys all 53 functions at once (takes 5-10 minutes).

---

## Step 6: Test Deployment

```bash
# Test health check
curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check'

# Test social webhook verification
curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123'
```

Expected webhook response: `test123`

---

## Step 7: Update External Webhooks

### Facebook/Instagram
1. Go to: https://developers.facebook.com/apps/823361387270732/webhooks/
2. Callback URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
3. Verify Token: `alcornexus`
4. Click "Verify and Save"

### Twilio (if using)
1. Go to: https://console.twilio.com/
2. Voice Webhook: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook`

---

## Summary of What You Need

✅ **Already done:**
- Supabase CLI linked to project
- Project configured in code

🔑 **Secrets to set:**
1. Meta/Facebook keys (commands above in Step 1) ✓ Copy/paste
2. Google API key (Step 2) → You need to get this
3. Resend API key (Step 2) → You need to get this
4. Optional: Twilio, OpenAI, ElevenLabs (Step 3)

🚀 **Then:**
- Deploy: `supabase functions deploy`
- Test endpoints
- Update Facebook webhooks

---

## Quick Commands Recap

```bash
# 1. Set Meta secrets (copy/paste all at once)
supabase secrets set META_VERIFY_TOKEN=alcornexus META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2 FACEBOOK_APP_ID=823361387270732 FACEBOOK_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2 META_APP_ID=823361387270732

# 2. Set your API keys (get these first)
supabase secrets set GOOGLE_API_KEY=your-key RESEND_API_KEY=your-key

# 3. Deploy
supabase functions deploy

# 4. Test
curl 'https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123'
```

---

**Next Step:** Copy the command from Step 1 above and run it!
