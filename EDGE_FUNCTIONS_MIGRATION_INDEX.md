# Edge Functions Migration - Complete Package

**Project:** Canvas Capital  
**Target:** Supabase Project `domipubyjkhsrmdwtabh`  
**Status:** ✅ Ready for Deployment  
**Date:** January 19, 2026

---

## 📚 Documentation Index

### Quick Access

| Document | Purpose | When to Use |
|----------|---------|-------------|
| **[EDGE_FUNCTIONS_QUICK_START.md](./EDGE_FUNCTIONS_QUICK_START.md)** | Fast deployment guide | Start here for quickest migration |
| **[EDGE_FUNCTIONS_MIGRATION_SUMMARY.md](./EDGE_FUNCTIONS_MIGRATION_SUMMARY.md)** | Executive overview | Understand what's being migrated |
| **[EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md](./EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md)** | Detailed checklist | Track progress through migration |
| **[DEPLOY_FUNCTIONS_GUIDE.md](./DEPLOY_FUNCTIONS_GUIDE.md)** | Alternative deployment methods | Troubleshoot or manual deploy |

### Migration Scripts

Located in `scripts/` directory:

| Script | Purpose | Command |
|--------|---------|---------|
| **migrate-edge-functions.sh** | Complete workflow | `./scripts/migrate-edge-functions.sh` |
| **setup-functions-secrets.sh** | Configure secrets | `./scripts/setup-functions-secrets.sh` |
| **deploy-all-functions.sh** | Deploy all functions | `./scripts/deploy-all-functions.sh` |
| **verify-functions-migration.sh** | Verify deployment | `./scripts/verify-functions-migration.sh` |

---

## 🚀 Quick Start Guide

### Step 1: Choose Your Path

#### Path A: Fully Automated (Recommended)
```bash
chmod +x scripts/migrate-edge-functions.sh
./scripts/migrate-edge-functions.sh
```
This runs the complete workflow including verification and testing.

#### Path B: Semi-Automated
```bash
# 1. Setup secrets
chmod +x scripts/setup-functions-secrets.sh
./scripts/setup-functions-secrets.sh

# 2. Deploy functions
chmod +x scripts/deploy-all-functions.sh
./scripts/deploy-all-functions.sh

# 3. Verify
chmod +x scripts/verify-functions-migration.sh
./scripts/verify-functions-migration.sh
```

#### Path C: Manual
```bash
supabase login
supabase link --project-ref domipubyjkhsrmdwtabh
supabase secrets set META_VERIFY_TOKEN=alcornexus
# ... set other secrets ...
supabase functions deploy
```

### Step 2: Update External Services

After deployment, update webhooks:

**Facebook/Instagram:**
- Go to: https://developers.facebook.com/apps/823361387270732/webhooks/
- Callback: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook`
- Verify Token: `alcornexus`

**Twilio (if using):**
- Go to: https://console.twilio.com/
- Webhook: `https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/twilio-voice-webhook`

**Vercel:**
- Update environment variables with new Supabase URL

### Step 3: Test & Verify

```bash
# Test health
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/health-check"

# Test webhook
curl "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/social-webhook?hub.mode=subscribe&hub.verify_token=alcornexus&hub.challenge=test"

# View logs
supabase functions logs --follow
```

---

## 📦 What's Being Migrated

### 53 Edge Functions Across 8 Categories

#### 1. Core Communication (8 functions)
Critical for messaging and AI interactions:
- `ai-chat` - Main AI conversation handler
- `social-webhook` - Receives messages from Meta platforms
- `facebook-connect` - OAuth connection flow
- `send-social-message` - Sends messages to social platforms
- `process-pending-messages` - Batch message processing
- `send-email` / `send-email-smtp` - Email delivery
- `send-sms` - SMS via Twilio
- `health-check` - System health monitoring

#### 2. Email Services (7 functions)
- `send-email-digest` - Digest reports
- `send-followup-email` - Automated follow-ups
- `send-welcome-email` - Welcome emails
- `send-reaction` - Message reactions
- `retry-message` - Retry logic
- `upload-chat-file` - File uploads

#### 3. AI & Automation (6 functions)
- `generate-summary` - Conversation summaries
- `reengage-lead` - Lead re-engagement
- `agent-takeover` - Human takeover
- `agent-handback` - AI takeback
- `demo-ai-chat` - Demo functionality
- `evaluate-training-session` - Training evaluation

#### 4. Social Media Integration (4 functions)
- `refresh-facebook-tokens` - Token refresh
- `refresh-single-token` - Single token refresh
- `test-social-connection` - Connection testing
- `backfill-facebook-messages` - Historical messages

#### 5. Calendar & Booking (6 functions)
- `google-calendar` - Calendar integration
- `sync-booking-calendar` - Booking sync
- `sync-calendar-events` - Event sync
- `sync-bookings-from-events` - Create bookings
- `auto-update-booking-status` - Status updates
- `book-demo` - Demo booking

#### 6. User Management (5 functions)
- `manage-user` - User operations
- `change-password` - Password changes
- `login-alert` - Login notifications
- `manage-2fa` - 2FA management
- `revoke-session` - Session revocation

#### 7. Document & Media (4 functions)
- `process-document` - Document OCR
- `elevenlabs-tts` - Text-to-speech
- `migrate-assets` - Asset migration
- `undo-migration` - Rollback

#### 8. Organization & Maintenance (13 functions)
- `delete-organization` - Org deletion
- `cleanup-expired-roles` - Role cleanup
- `cleanup-old-data` - Data cleanup
- `generate-recurring-expenses` - Expense generation
- `geolocate-ip` - IP geolocation
- `webhook-health-check` - Webhook monitoring
- `send-scheduled-reports` - Scheduled reports
- `twilio-voice-token` - Voice tokens
- `twilio-voice-webhook` - Voice webhooks
- And more...

---

## 🔑 Required Configuration

### Environment Secrets

Must be set before deployment:

```bash
# Core Supabase (Required)
SUPABASE_URL=https://domipubyjkhsrmdwtabh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-key>
SUPABASE_ANON_KEY=<your-key>

# Meta/Facebook (Required for social)
META_VERIFY_TOKEN=alcornexus
META_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2
FACEBOOK_APP_ID=823361387270732
FACEBOOK_APP_SECRET=d17a6665e2b0dae5c774dd2cafc5dfd2

# AI Services (Required)
GOOGLE_API_KEY=<your-key>  # For Gemini AI

# Email (Required)
RESEND_API_KEY=<your-key>

# Optional Services
OPENAI_API_KEY=<your-key>
ELEVENLABS_API_KEY=<your-key>
TWILIO_ACCOUNT_SID=<your-sid>
TWILIO_AUTH_TOKEN=<your-token>
TWILIO_PHONE_NUMBER=<your-number>
```

Set via:
1. **Dashboard:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions
2. **CLI:** `supabase secrets set KEY=value`
3. **Script:** `./scripts/setup-functions-secrets.sh`

---

## ✅ Pre-Migration Status

### Current Configuration
- ✅ Project ID updated in `supabase/config.toml`
- ✅ Local `.env` file configured
- ✅ All 53 functions present in codebase
- ✅ Migration scripts created
- ✅ Documentation complete

### What's Needed
- [ ] Deploy functions to new project
- [ ] Set environment secrets
- [ ] Update external webhooks
- [ ] Test deployment
- [ ] Update Vercel environment

---

## 📊 Migration Progress Tracking

Use this checklist to track your progress:

- [ ] **Pre-Migration**
  - [ ] Review documentation
  - [ ] Backup current configuration
  - [ ] Note down all webhook URLs

- [ ] **Setup Phase**
  - [ ] Verify Supabase CLI installed
  - [ ] Login to Supabase
  - [ ] Link to new project
  - [ ] Set environment secrets

- [ ] **Deployment Phase**
  - [ ] Deploy all 53 functions
  - [ ] Verify deployments
  - [ ] Test critical endpoints

- [ ] **Configuration Phase**
  - [ ] Update Facebook webhooks
  - [ ] Update Twilio webhooks
  - [ ] Update Vercel environment
  - [ ] Update any CI/CD pipelines

- [ ] **Testing Phase**
  - [ ] Test AI chat functionality
  - [ ] Test social message receiving/sending
  - [ ] Test email sending
  - [ ] Test calendar integration
  - [ ] Test webhook health

- [ ] **Monitoring Phase**
  - [ ] Set up log monitoring
  - [ ] Verify no errors in logs
  - [ ] Test end-to-end workflows
  - [ ] Update team documentation

---

## 🆘 Troubleshooting

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| CLI not found | `curl -fsSL https://github.com/supabase/cli/releases/latest/download/supabase_linux_amd64.tar.gz \| tar -xz && sudo mv supabase /usr/local/bin/` |
| Not logged in | `supabase login` |
| Project not linked | `supabase link --project-ref domipubyjkhsrmdwtabh` |
| Function failed to deploy | Check logs: `supabase functions logs <name> --follow` |
| Webhook verification failed | Verify `META_VERIFY_TOKEN=alcornexus` is set |
| Import errors | Check `_shared/` and `_helpers/` directories |

### Getting Help

1. **View Logs:**
   ```bash
   supabase functions logs --follow
   supabase functions logs <function-name> --follow
   ```

2. **Check Function Status:**
   ```bash
   supabase functions list
   ```

3. **Test Endpoints:**
   ```bash
   curl -v "https://domipubyjkhsrmdwtabh.supabase.co/functions/v1/<function-name>"
   ```

4. **Review Documentation:**
   - Supabase Edge Functions: https://supabase.com/docs/guides/functions
   - CLI Reference: https://supabase.com/docs/reference/cli

---

## 📈 Post-Migration

### Immediate Actions
1. Monitor function logs for 24-48 hours
2. Test all critical user workflows
3. Verify webhook deliveries
4. Check email/SMS delivery
5. Monitor error rates

### Optimization
1. Review function performance
2. Optimize cold start times
3. Review and adjust timeouts
4. Consider function bundling
5. Implement caching where appropriate

### Documentation
1. Update team runbooks
2. Document new URLs
3. Update CI/CD documentation
4. Train team on new setup

---

## 🎯 Success Criteria

Migration is successful when:

- ✅ All 53 functions deployed
- ✅ No errors in function logs
- ✅ Critical endpoints responding
- ✅ Webhooks receiving events
- ✅ End-to-end workflows functional
- ✅ External services configured
- ✅ Team informed of changes

---

## 📞 Support & Resources

### Dashboards
- **Supabase:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh
- **Functions:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/functions
- **Secrets:** https://supabase.com/dashboard/project/domipubyjkhsrmdwtabh/settings/functions

### External Services
- **Facebook:** https://developers.facebook.com/apps/823361387270732
- **Twilio:** https://console.twilio.com/
- **Vercel:** https://vercel.com/dashboard

### Documentation
- [Quick Start Guide](./EDGE_FUNCTIONS_QUICK_START.md)
- [Full Checklist](./EDGE_FUNCTIONS_MIGRATION_CHECKLIST.md)
- [Migration Summary](./EDGE_FUNCTIONS_MIGRATION_SUMMARY.md)
- [Deployment Guide](./DEPLOY_FUNCTIONS_GUIDE.md)

---

## 🚦 Current Status

**Migration Status:** ✅ Ready for Execution  
**Estimated Time:** 15-30 minutes  
**Risk Level:** Low (can rollback if needed)  
**Downtime:** None (deploy to new project)

**Next Action:** Run `./scripts/migrate-edge-functions.sh`

---

**Last Updated:** January 19, 2026  
**Prepared By:** GitHub Copilot  
**Project:** Canvas Capital - Supabase Migration
