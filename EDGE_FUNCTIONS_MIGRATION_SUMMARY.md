# Edge Functions Migration - Summary

**Status:** ✅ Ready for Migration  
**Target Project:** `domipubyjkhsrmdwtabh`  
**Date:** January 19, 2026

---

## 📊 Migration Overview

### What Needs to be Migrated

**53 Edge Functions** organized into 8 categories:

| Category | Count | Examples |
|----------|-------|----------|
| Core Communication | 8 | `ai-chat`, `social-webhook`, `send-social-message` |
| Email Services | 7 | `send-email`, `send-email-smtp`, `send-welcome-email` |
| AI & Automation | 6 | `generate-summary`, `reengage-lead`, `agent-takeover` |
| Social Media | 4 | `facebook-connect`, `refresh-facebook-tokens` |
| Calendar & Booking | 6 | `google-calendar`, `sync-booking-calendar` |
| User Management | 5 | `manage-user`, `change-password`, `manage-2fa` |
| Document & Media | 4 | `process-document`, `elevenlabs-tts` |
| Maintenance | 13 | `cleanup-expired-roles`, `health-check` |

---

## 🚀 Quick Start (3 Commands)

### Option A: Automated (Recommended)

```bash
# Run complete migration workflow
chmod +x scripts/migrate-edge-functions.sh
./scripts/migrate-edge-functions.sh
```

### Option B: Step by Step

```bash
# 1. Verify current status
chmod +x scripts/verify-functions-migration.sh
./scripts/verify-functions-migration.sh

# 2. Deploy all functions
chmod +x scripts/deploy-all-functions.sh
./scripts/deploy-all-functions.sh

# 3. Update webhooks (manual step)
# See checklist below
```

### Option C: Manual

```bash
supabase login
supabase link --project-ref domipubyjkhsrmdwtabh
supabase functions deploy
```

---

## ✅ Post-Migration Checklist

### 1. Verify Deployments

```bash
# List all deployed functions
supabase functions list

# Test critical endpoints
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check"
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test"
```

### 2. Update External Services

**Facebook/Instagram:**
- URL: `https://developers.facebook.com/apps/823361387270732/webhooks/`
- Callback: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
- Token: `alcornexus`

**Twilio:**
- URL: `https://console.twilio.com/`
- Webhook: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook`

**Vercel:**
- `VITE_SUPABASE_URL` → `https://domipubyjkhsrmdwtabh.supabase.co`
- `VITE_SUPABASE_PUBLISHABLE_KEY` → Get from Supabase dashboard

### 3. Test Core Functionality

- [ ] Send a Facebook/Instagram message → AI responds
- [ ] Create a booking → Calendar syncs
- [ ] Send an email → Delivery confirmed
- [ ] Make a phone call → Twilio webhook works
- [ ] Test social webhook verification

---

## 🔑 Required Secrets

Must be set before deployment:

```bash
# Core (Required)
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ANON_KEY

# Meta/Facebook (Required for social)
META_VERIFY_TOKEN=alcornexus
META_APP_SECRET
FACEBOOK_APP_ID=823361387270732
FACEBOOK_APP_SECRET

# AI (Required)
GOOGLE_API_KEY  # For Gemini AI

# Email (Required)
RESEND_API_KEY

# Optional
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
OPENAI_API_KEY
ELEVENLABS_API_KEY
```

Set via:
- **Dashboard:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions
- **CLI:** `supabase secrets set KEY=value`
- **Script:** `./scripts/setup-functions-secrets.sh`

---

## 📁 Files Created

| File | Purpose |
|------|---------|
| `EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md` | Comprehensive checklist with all 53 functions |
| `EDGE_FUNCTIONS_QUICK_START.md` | Quick reference guide |
| `scripts/migrate-edge-functions.sh` | Master migration workflow |
| `scripts/deploy-all-functions.sh` | Deploy all functions |
| `scripts/verify-functions-migration.sh` | Verify deployment status |
| `scripts/setup-functions-secrets.sh` | Configure environment secrets |
| `EDGE_FUNCTIONS_MIGRATION_SUMMARY.md` | This file |

---

## 🆘 Common Issues

### "Not logged in"
```bash
supabase login
```

### "Project not linked"
```bash
supabase link --project-ref domipubyjkhsrmdwtabh
```

### "Function failed to deploy"
```bash
# View logs
supabase functions logs <function-name> --follow

# Redeploy
supabase functions deploy <function-name>
```

### "Import errors"
- Check `_shared/` and `_helpers/` directories exist
- Verify `deno.json` dependencies
- Ensure TypeScript types are correct

### "Webhook verification failed"
- Verify `META_VERIFY_TOKEN` is set to `alcornexus`
- Check function logs: `supabase functions logs social-webhook`
- Test URL: `curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test"`

---

## 📊 Configuration Status

### Current Project ID
- **Old:** (if applicable)
- **New:** `domipubyjkhsrmdwtabh`

### Configuration Files
- ✅ `supabase/config.toml` - Updated with new project ID
- ✅ `.env` - Contains new Supabase URL
- ⚠️ External services - Need manual update (Facebook, Twilio, Vercel)

### Environment Variables
```
VITE_SUPABASE_PROJECT_ID="domipubyjkhsrmdwtabh"
VITE_SUPABASE_URL="https://domipubyjkhsrmdwtabh.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY="sb_publishable_WfCeSV9IOdnVa6NpqjdFBQ_Z-40I-js"
SUPABASE_SERVICE_ROLE_KEY=<redacted>
```

---

## 🎯 Success Criteria

Migration is complete when:

- [x] Project configuration updated (`config.toml`)
- [x] Scripts created and ready
- [ ] All 53 functions deployed
- [ ] Critical endpoints tested and responding
- [ ] External webhooks updated
- [ ] End-to-end application test successful
- [ ] No errors in function logs

---

## 📞 Support

**Supabase Dashboard:**  
https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh

**View Logs:**
```bash
supabase functions logs --follow
supabase functions logs <function-name> --follow
```

**Documentation:**
- Edge Functions: https://supabase.com/docs/guides/functions
- CLI Reference: https://supabase.com/docs/reference/cli

---

## 📈 Next Steps After Migration

1. **Monitor Function Health**
   - Set up monitoring/alerts
   - Review logs regularly
   - Track error rates

2. **Optimize Performance**
   - Review function execution times
   - Optimize cold start times
   - Consider caching strategies

3. **Update CI/CD**
   - Update deployment pipelines
   - Add function deployment to CI
   - Test automated deployments

4. **Documentation**
   - Update team documentation
   - Document any custom configurations
   - Share webhook URLs with team

---

**Estimated Migration Time:** 15-30 minutes

**Last Updated:** January 19, 2026

**Status:** ✅ Ready to execute
