# Edge Functions Migration Checklist for New Supabase Project

**Target Project:** `domipubyjkhsrmdwtabh`  
**Project URL:** `https://domipubyjkhsrmdwtabh.supabase.co`  
**Date:** January 19, 2026

## Current Status

Based on workspace analysis, you have **53 edge functions** in your codebase that need to be deployed to the new Supabase project.

## Critical Functions (Deploy First)

These functions are essential for core functionality:

- [ ] `ai-chat` - Main conversation handler for AI responses
- [ ] `social-webhook` - Receives messages from Meta (Facebook/Instagram/WhatsApp)
- [ ] `facebook-connect` - OAuth connection for social platforms
- [ ] `send-social-message` - Sends messages to social platforms
- [ ] `process-pending-messages` - Batch processes queued messages
- [ ] `send-email` - Email sending functionality
- [ ] `send-sms` - SMS sending via Twilio
- [ ] `health-check` - System health monitoring

## Communication Functions

- [ ] `send-email-smtp` - SMTP email delivery
- [ ] `send-email-digest` - Digest email reports
- [ ] `send-followup-email` - Automated follow-up emails
- [ ] `send-welcome-email` - Welcome email for new users
- [ ] `send-reaction` - Message reactions
- [ ] `retry-message` - Message retry logic
- [ ] `upload-chat-file` - File uploads in chat

## AI & Automation Functions

- [ ] `generate-summary` - Conversation summarization
- [ ] `reengage-lead` - Lead re-engagement automation
- [ ] `agent-takeover` - Human agent takes over from AI
- [ ] `agent-handback` - AI takes back from human agent
- [ ] `demo-ai-chat` - Demo AI chat functionality
- [ ] `evaluate-training-session` - Training evaluation

## Social Media Integration

- [ ] `refresh-facebook-tokens` - Token refresh for Facebook
- [ ] `refresh-single-token` - Single token refresh
- [ ] `test-social-connection` - Test social media connections
- [ ] `backfill-facebook-messages` - Backfill historical messages

## Calendar & Booking Functions

- [ ] `google-calendar` - Google Calendar integration
- [ ] `sync-booking-calendar` - Sync bookings to calendar
- [ ] `sync-calendar-events` - Sync calendar events
- [ ] `sync-bookings-from-events` - Create bookings from calendar events
- [ ] `auto-update-booking-status` - Automatic booking status updates
- [ ] `book-demo` - Demo booking functionality

## User Management Functions

- [ ] `manage-user` - User management operations
- [ ] `change-password` - Password change functionality
- [ ] `login-alert` - Login notifications
- [ ] `manage-2fa` - Two-factor authentication management
- [ ] `revoke-session` - Session revocation

## Document & Media Processing

- [ ] `process-document` - Document OCR and processing
- [ ] `elevenlabs-tts` - Text-to-speech via ElevenLabs
- [ ] `migrate-assets` - Asset migration utility
- [ ] `undo-migration` - Rollback asset migration

## Twilio Integration

- [ ] `twilio-voice-token` - Voice call tokens
- [ ] `twilio-voice-webhook` - Voice call webhooks

## Organization & Role Management

- [ ] `delete-organization` - Organization deletion
- [ ] `cleanup-expired-roles` - Automatic role cleanup
- [ ] `generate-recurring-expenses` - Recurring expense generation

## Maintenance & Utilities

- [ ] `cleanup-old-data` - Data cleanup jobs
- [ ] `geolocate-ip` - IP geolocation
- [ ] `webhook-health-check` - Webhook health monitoring
- [ ] `send-scheduled-reports` - Scheduled report generation

---

## Pre-Deployment Steps

### 1. Verify Supabase CLI Installation

```bash
supabase --version
```

If not installed:
```bash
curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz | tar -xz
sudo mv supabase /usr/local/bin/supabase
```

### 2. Link to New Supabase Project

```bash
supabase link --project-ref domipubyjkhsrmdwtabh
```

### 3. Set Environment Secrets

Required secrets for edge functions:

```bash
# Meta/Facebook Integration
supabase secrets set META_VERIFY_TOKEN=alcornexus
supabase secrets set META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
supabase secrets set META_APP_ID=823361387270732

# Supabase Credentials
supabase secrets set SUPABASE_SERVICE_ROLE_KEY="<your-service-role-key>"
supabase secrets set SUPABASE_URL="https://domipubyjkhsrmdwtabh.supabase.co"

# AI/ML Services
supabase secrets set LOVABLE_API_KEY="<your-lovable-api-key>"
supabase secrets set OPENAI_API_KEY="<your-openai-key>"
supabase secrets set ELEVENLABS_API_KEY="<your-elevenlabs-key>"

# Communication Services
supabase secrets set TWILIO_ACCOUNT_SID="<your-twilio-sid>"
supabase secrets set TWILIO_AUTH_TOKEN="<your-twilio-token>"
supabase secrets set TWILIO_PHONE_NUMBER="<your-twilio-number>"

# Email Services
supabase secrets set SMTP_HOST="<your-smtp-host>"
supabase secrets set SMTP_PORT="<your-smtp-port>"
supabase secrets set SMTP_USER="<your-smtp-user>"
supabase secrets set SMTP_PASS="<your-smtp-pass>"

# Google Services
supabase secrets set GOOGLE_CLIENT_ID="<your-google-client-id>"
supabase secrets set GOOGLE_CLIENT_SECRET="<your-google-client-secret>"
```

### 4. Verify config.toml

Ensure `/workspaces/canvascapital/supabase/config.toml` has:
```toml
project_id = "domipubyjkhsrmdwtabh"
```

✅ **Already configured correctly**

---

## Deployment Commands

### Option A: Deploy All Functions at Once

```bash
# Navigate to project root
cd /workspaces/canvascapital

# Deploy all functions
supabase functions deploy
```

### Option B: Deploy Functions Individually

Critical functions first:

```bash
# Core messaging & AI
supabase functions deploy ai-chat
supabase functions deploy social-webhook
supabase functions deploy facebook-connect
supabase functions deploy send-social-message
supabase functions deploy process-pending-messages

# Communication
supabase functions deploy send-email
supabase functions deploy send-sms
supabase functions deploy send-email-smtp

# Automation
supabase functions deploy generate-summary
supabase functions deploy reengage-lead
supabase functions deploy agent-takeover
supabase functions deploy agent-handback

# Calendar & Booking
supabase functions deploy google-calendar
supabase functions deploy sync-booking-calendar
supabase functions deploy auto-update-booking-status

# Utilities
supabase functions deploy health-check
supabase functions deploy webhook-health-check
```

### Option C: Deploy Using Script

```bash
# Make script executable
chmod +x /workspaces/canvascapital/scripts/deploy-all-functions.sh

# Run deployment script
./scripts/deploy-all-functions.sh
```

---

## Post-Deployment Verification

### 1. List Deployed Functions

```bash
supabase functions list
```

### 2. Test Critical Endpoints

```bash
# Test health check
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check"

# Test social webhook verification
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test123"

# Test webhook health
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/webhook-health-check"
```

### 3. Check Function Logs

```bash
# View logs for specific function
supabase functions logs ai-chat --follow

# View all function logs
supabase functions logs --follow
```

### 4. Update Webhook URLs

After deployment, update these external services:

#### Facebook/Instagram Webhooks
- URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
- Verify Token: `alcornexus`
- Dashboard: https://developers.facebook.com/apps/823361387270732/webhooks/

#### Twilio Voice Webhooks
- URL: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook`
- Dashboard: https://console.twilio.com/

### 5. Verify Database Triggers

Some functions are triggered by database changes. Verify triggers in Supabase Dashboard:
- https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/database/triggers

---

## Rollback Plan

If issues occur:

1. **Check function logs:**
   ```bash
   supabase functions logs <function-name> --follow
   ```

2. **Redeploy specific function:**
   ```bash
   supabase functions deploy <function-name>
   ```

3. **Restore from previous version:**
   - Go to Supabase Dashboard
   - Edge Functions → Select function → Version History
   - Rollback to previous version

---

## Environment Variables Update

After migration, update your frontend environment variables:

### Vercel Environment Variables
Update in Vercel Dashboard:
- `VITE_SUPABASE_URL` = `https://domipubyjkhsrmdwtabh.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` = `<new-anon-key>`

### Local Development (.env)
Already configured correctly:
```
VITE_SUPABASE_URL="https://domipubyjkhsrmdwtabh.supabase.co"
VITE_SUPABASE_PROJECT_ID="domipubyjkhsrmdwtabh"
```

---

## Common Issues & Solutions

### Issue: "Project not linked"
```bash
supabase link --project-ref domipubyjkhsrmdwtabh
```

### Issue: "Authentication required"
```bash
supabase login
```

### Issue: "Function deployment failed"
- Check function logs for errors
- Verify all dependencies are in `deno.json`
- Ensure environment secrets are set

### Issue: "Import errors"
- Verify import paths use relative paths
- Check shared modules in `_shared/` and `_helpers/`
- Ensure all TypeScript types are properly defined

---

## Migration Complete Checklist

- [ ] Supabase CLI installed and configured
- [ ] Project linked to `domipubyjkhsrmdwtabh`
- [ ] All environment secrets configured
- [ ] All 53 functions deployed successfully
- [ ] Function tests passing
- [ ] External webhooks updated
- [ ] Frontend environment variables updated
- [ ] Vercel redeployed with new variables
- [ ] Monitoring and logging verified
- [ ] Old project deprecated (after verification)

---

## Quick Command Reference

```bash
# Link project
supabase link --project-ref domipubyjkhsrmdwtabh

# Deploy all functions
supabase functions deploy

# List deployed functions
supabase functions list

# View function logs
supabase functions logs <function-name> --follow

# Set a secret
supabase secrets set KEY=value

# List all secrets
supabase secrets list
```

---

## Support Resources

- **Supabase Dashboard:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh
- **Edge Functions Docs:** https://supabase.com/docs/guides/functions
- **CLI Reference:** https://supabase.com/docs/reference/cli/introduction
- **Project Config:** `/workspaces/canvascapital/supabase/config.toml`

---

**Last Updated:** January 19, 2026  
**Status:** Ready for deployment
