# Quick Start: Edge Functions Migration

**Target:** New Supabase project `domipubyjkhsrmdwtabh`  
**Date:** January 19, 2026

## 🚀 Quick Deploy (3 Steps)

### 1. Verify Current Status

```bash
chmod +x scripts/verify-functions-migration.sh
./scripts/verify-functions-migration.sh
```

This shows:
- ✅ Which functions are already deployed
- ❌ Which functions are missing
- 🧪 Tests critical endpoints

### 2. Deploy All Functions

```bash
chmod +x scripts/deploy-all-functions.sh
./scripts/deploy-all-functions.sh
```

This will:
- Link to your Supabase project
- Deploy all 53 edge functions
- Verify deployments
- Test critical endpoints

### 3. Update Webhooks

After deployment, update these external services:

**Facebook/Instagram:**
- Go to: https://developers.facebook.com/apps/823361387270732/webhooks/
- Callback URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
- Verify Token: `alcornexus`

**Twilio:**
- Go to: https://console.twilio.com/
- Voice Webhook: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook`

---

## 📋 Manual Deployment (Alternative)

If you prefer manual control:

```bash
# 1. Login and link
supabase login
supabase link --project-ref domipubyjkhsrmdwtabh

# 2. Deploy all functions
supabase functions deploy

# 3. Verify
supabase functions list

# 4. Test
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check"
```

---

## 🔑 Required Environment Secrets

Before deployment, ensure these secrets are set in Supabase:

```bash
# Meta/Facebook
supabase secrets set META_VERIFY_TOKEN=alcornexus
supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
supabase secrets set META_APP_ID=823361387270732

# Check secrets
supabase secrets list
```

**Set secrets via Dashboard:**
https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions

---

## 🧪 Testing After Deployment

```bash
# List all deployed functions
supabase functions list

# Test health endpoint
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check"

# Test social webhook
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123"

# View logs (follow mode)
supabase functions logs --follow

# View logs for specific function
supabase functions logs ai-chat --follow
```

---

## 📦 What Gets Deployed

**53 Edge Functions:**

### Core (8 functions)
- `ai-chat` - AI conversation handler
- `social-webhook` - Meta message receiver
- `facebook-connect` - OAuth connection
- `send-social-message` - Message sender
- `process-pending-messages` - Batch processor
- `send-email` / `send-email-smtp` - Email delivery
- `send-sms` - SMS via Twilio
- `health-check` - System monitoring

### Communication (7 functions)
- `send-email-digest`, `send-followup-email`, `send-welcome-email`
- `send-reaction`, `retry-message`, `upload-chat-file`

### AI & Automation (6 functions)
- `generate-summary`, `reengage-lead`
- `agent-takeover`, `agent-handback`
- `demo-ai-chat`, `evaluate-training-session`

### Social Media (4 functions)
- `refresh-facebook-tokens`, `refresh-single-token`
- `test-social-connection`, `backfill-facebook-messages`

### Calendar & Booking (6 functions)
- `google-calendar`, `sync-booking-calendar`
- `sync-calendar-events`, `sync-bookings-from-events`
- `auto-update-booking-status`, `book-demo`

### User Management (5 functions)
- `manage-user`, `change-password`
- `login-alert`, `manage-2fa`, `revoke-session`

### Document & Media (4 functions)
- `process-document`, `elevenlabs-tts`
- `migrate-assets`, `undo-migration`

### Twilio (2 functions)
- `twilio-voice-token`, `twilio-voice-webhook`

### Organization & Maintenance (11 functions)
- `delete-organization`, `cleanup-expired-roles`
- `cleanup-old-data`, `generate-recurring-expenses`
- `geolocate-ip`, `webhook-health-check`
- `send-scheduled-reports`, and more...

---

## 🆘 Troubleshooting

### Issue: "Not logged in"
```bash
supabase login
```

### Issue: "Project not linked"
```bash
supabase link --project-ref domipubyjkhsrmdwtabh
```

### Issue: "Function failed to deploy"
```bash
# Check logs
supabase functions logs <function-name>

# Redeploy specific function
supabase functions deploy <function-name>
```

### Issue: "Import errors"
- Verify `_shared/` and `_helpers/` directories exist
- Check `deno.json` for dependencies
- Ensure TypeScript types are correct

### Issue: "Webhook not responding"
- Verify secrets are set: `supabase secrets list`
- Check function logs: `supabase functions logs social-webhook`
- Test webhook URL directly with curl

---

## ✅ Verification Checklist

After migration, verify:

- [ ] All 53 functions deployed (`supabase functions list`)
- [ ] Health check responds (`curl health-check endpoint`)
- [ ] Social webhook verification works
- [ ] Function logs accessible
- [ ] External webhooks updated (Facebook, Twilio)
- [ ] Frontend `.env` variables correct
- [ ] Vercel environment variables updated
- [ ] End-to-end test successful

---

## 📚 Documentation

- **Full Checklist:** [EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md](./EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md)
- **Deployment Guide:** [DEPLOY_FUNCTIONS_GUIDE.md](./DEPLOY_FUNCTIONS_GUIDE.md)
- **Health Check Report:** [POST_DEPLOYMENT_HEALTH_CHECK_JAN18.md](./POST_DEPLOYMENT_HEALTH_CHECK_JAN18.md)

---

## 🎯 Summary

**Before migration:**
- Old project had functions
- New project `domipubyjkhsrmdwtabh` needs them

**After migration:**
- All 53 functions deployed to new project
- Webhooks updated
- System fully operational on new infrastructure

**Time estimate:** 15-30 minutes

---

**Last Updated:** January 19, 2026  
**Status:** Ready to deploy

Need help? Check the logs:
```bash
supabase functions logs --follow
```
