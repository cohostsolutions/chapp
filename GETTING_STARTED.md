# 🎯 Complete Implementation Guide - Self-Hosted Monitoring

**Everything you need to get started with zero external dependencies**

---

## ✅ What Was Implemented

### 1. Environment Configuration
- ✅ **File:** `.env.example`
- ✅ Complete template with all variables
- ✅ Setup instructions included
- ✅ Security best practices documented

### 2. Internal Error Dashboard  
- ✅ **File:** `src/pages/ErrorDashboard.tsx`
- ✅ Real-time error monitoring
- ✅ Error analysis by type/component
- ✅ Trend visualization
- ✅ CSV export
- ✅ Route: `/errors` (Super Admin only)

### 3. Database Alerting System
- ✅ **File:** `supabase/migrations/20260109000000_alert_system.sql`
- ✅ 3 tables: `alert_rules`, `alert_notifications`, `email_queue`
- ✅ 2 functions: `check_alert_thresholds()`, `send_alert_notifications()`
- ✅ 4 default alert rules (error rate, response time, vault failures, lock failures)
- ✅ Email notifications via Resend

### 4. CI/CD Workflows
- ✅ **Staging:** `.github/workflows/deploy-staging.yml`
  - Auto-deploy on push to `develop`
  - Smoke tests
  - PR comments with preview URL
  
- ✅ **Production:** `.github/workflows/deploy-production.yml`
  - Quality gate (lint, type-check, test)
  - Health checks
  - Automated rollback
  - GitHub releases

### 5. Test Infrastructure
- ✅ **Config:** `vitest.config.ts`, `playwright.config.ts`
- ✅ **Setup:** `src/__tests__/setup.ts`
- ✅ **Unit Tests:** Auth guard, processing locks, date validation
- ✅ **Smoke Tests:** 10 critical checks (homepage, auth, API, PWA)
- ✅ **Scripts:** Updated in `package.json`

---

## 🚀 Quick Start (30 Minutes)

### Step 1: Environment Setup (5 min)
```bash
# Copy template
cp .env.example .env

# Edit .env and set these at minimum:
# VITE_SUPABASE_URL=your_url
# VITE_SUPABASE_ANON_KEY=your_key
# VAULT_ENCRYPTION_KEY=your_32_char_key
```

### Step 2: Install Dependencies (10 min)
```bash
# Install test dependencies
npm install -D @playwright/test vitest @vitest/ui \
  @testing-library/react @testing-library/jest-dom \
  @testing-library/user-event jsdom @vitest/coverage-v8

# Install Playwright browsers
npx playwright install chromium firefox
```

### Step 3: Database Migration (2 min)
```bash
# Apply alerting system
supabase db push

# Verify tables created
# Check Supabase dashboard: alert_rules, alert_notifications, email_queue should exist
```

### Step 4: Test Everything (10 min)
```bash
# Run linting
npm run lint

# Run type checking
npm run type-check

# Run unit tests
npm run test

# Build application
npm run build

# Start dev server (in background)
npm run dev &

# Run smoke tests
npm run test:smoke
```

### Step 5: Access Error Dashboard (3 min)
```bash
# Start dev server
npm run dev

# Open browser: http://localhost:5173/errors
# (Must be logged in as Super Admin)
```

---

## 📊 What You Get (Zero External Services)

### Error Monitoring
**Instead of Sentry ($29/mo):**
- ✅ Real-time error dashboard at `/errors`
- ✅ Error tracking via `audit_logs` table
- ✅ Trend analysis and filtering
- ✅ CSV export for analysis
- ✅ 30-second auto-refresh

**Cost:** $0/month ✅

### Alerting
**Instead of PagerDuty ($49/mo):**
- ✅ Configurable alert rules
- ✅ Email notifications via Resend (already have it)
- ✅ Cooldown periods
- ✅ Alert history tracking

**Cost:** $0/month ✅ (uses existing Resend API)

### Performance Monitoring
**Instead of Datadog ($15/mo):**
- ✅ `usePerformanceMonitor` hook (already exists)
- ✅ `useQueryMonitor` hook (already exists)
- ✅ `PerformancePanel` component (already exists)
- ✅ Database activity monitoring (already exists)

**Cost:** $0/month ✅

### Testing
**Instead of external CI ($50/mo):**
- ✅ GitHub Actions (free for public repos)
- ✅ Vitest (free, fast)
- ✅ Playwright (free, reliable)
- ✅ Coverage reports (free)

**Cost:** $0/month ✅

**Total Savings:** $93-143/month = **$1,116-1,716/year** 💰

---

## 🎯 How to Use Error Dashboard

### Access
1. Log in as Super Admin
2. Navigate to `/errors`
3. Dashboard loads automatically

### Features

#### Real-Time Monitoring
- Refreshes every 30 seconds
- Shows total errors, last hour, error types, trend

#### Time Range Filtering
- Last Hour
- Last 24 Hours
- Last 7 Days
- Last 30 Days

#### Error Analysis
**Recent Errors Tab:**
- List of all errors with timestamps
- Filter by error type
- View stack traces (click "View Stack Trace")
- See component, URL, user info

**By Type Tab:**
- Bar chart of errors by type
- Click to filter

**By Component Tab:**
- Bar chart of errors by component
- Identify problem areas

#### Export
- Click "Export" button
- Downloads CSV with all error data
- Opens in Excel/Google Sheets

---

## 🚨 How to Configure Alerts

### Default Alert Rules
Already configured in database:

1. **High Error Rate**
   - Threshold: >10 errors in 5 minutes
   - Action: Send email

2. **Slow Response Time**
   - Threshold: >3000ms average
   - Action: Send email

3. **Vault Failures**
   - Threshold: >3 failures in 5 minutes
   - Action: Send email

4. **Lock Failures**
   - Threshold: >5 failures in 5 minutes
   - Action: Send email

### Customize Alerts

**Option 1: SQL (Direct)**
```sql
-- Update threshold
UPDATE alert_rules
SET threshold = 20  -- New threshold
WHERE rule_name = 'high_error_rate';

-- Change email recipients
UPDATE alert_rules
SET notification_emails = ARRAY['admin@yourcompany.com', 'dev@yourcompany.com']
WHERE rule_name = 'high_error_rate';

-- Disable rule
UPDATE alert_rules
SET enabled = false
WHERE rule_name = 'slow_response_time';
```

**Option 2: Create Admin UI (Future Enhancement)**
```typescript
// src/pages/AlertConfig.tsx
// TODO: Create UI for managing alert rules
// - List all rules
// - Edit thresholds
// - Add/remove email recipients
// - Enable/disable rules
```

### Test Alerts
```sql
-- Manually trigger alert
INSERT INTO alert_notifications (
  rule_id,
  message,
  severity
)
SELECT 
  id,
  'Test alert - please ignore',
  'info'
FROM alert_rules
WHERE rule_name = 'high_error_rate';

-- Check if alert was created
SELECT * FROM alert_notifications 
ORDER BY triggered_at DESC 
LIMIT 5;
```

### Set Up Cron Job (Supabase)
```sql
-- Run alert checks every 5 minutes
SELECT cron.schedule(
  'check-alerts-every-5-min',
  '*/5 * * * *',
  'SELECT check_alert_thresholds()'
);

-- Verify cron job
## Deployment

Important: Deployments are handled by Lovable. Any prior Vercel-specific instructions are deprecated and can be ignored. CI on GitHub Actions is limited to quality gates and dependency audits; deployment and Supabase migrations run in Lovable’s pipeline.

Ensure Lovable has environment variables for your Supabase project (e.g., `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and any runtime configuration) and triggers builds on merges to `main`.

SELECT * FROM cron.job;
```

---

## 🧪 Running Tests

### Unit Tests (Vitest)
```bash
# Run once
npm run test

# Watch mode (auto-rerun on changes)
npm run test:watch

# With coverage report
npm run test:coverage

# Open UI (visual test runner)
npm run test:ui
```

### Smoke Tests (Playwright)
```bash
# Run smoke tests (requires dev server running)
npm run dev &
npm run test:smoke

# Run all E2E tests
npm run test:e2e

# Run with UI (visual mode)
npm run test:e2e:ui

# Run specific test file
npx playwright test tests/smoke/basic.test.ts
```

### Coverage Reports
```bash
# Generate coverage
npm run test:coverage

# View HTML report
open coverage/index.html
# or
xdg-open coverage/index.html  # Linux
```

---

## 🔧 GitHub Actions Setup

### Required Secrets

**For Staging:**
1. Go to GitHub repo → Settings → Secrets → Actions
2. Add these secrets:
   - `VERCEL_TOKEN` (from vercel.com → Settings → Tokens)
   - `STAGING_SUPABASE_URL`
   - `STAGING_SUPABASE_KEY`
   - `STAGING_PROJECT_ID`

**For Production:**
   - `PRODUCTION_SUPABASE_URL`
   - `PRODUCTION_SUPABASE_KEY`
   - `PRODUCTION_PROJECT_ID`

### Workflows

**Automatically Run On:**
- Push to `develop` → Staging deployment
- Push to `main` → Production deployment
- Pull requests → Quality checks only

**Manual Trigger:**
1. Go to Actions tab
2. Select workflow
3. Click "Run workflow"

---

## 📈 Monitoring Best Practices

### Daily
- [ ] Check error dashboard (`/errors`)
- [ ] Review alert notifications
- [ ] Check for new error types

### Weekly
- [ ] Analyze error trends
- [ ] Review alert thresholds
- [ ] Export error data for analysis
- [ ] Update alert rules if needed

### Monthly
- [ ] Review test coverage
- [ ] Analyze performance metrics
- [ ] Clean up old alert notifications
- [ ] Rotate secrets (tracked in `secret_rotation_tracking`)

---

## 🐛 Troubleshooting

### Error Dashboard Not Loading
**Problem:** Blank page or spinner  
**Solution:**
1. Check you're logged in as Super Admin
2. Verify `audit_logs` table exists
3. Check browser console for errors
4. Verify RLS policies allow super_admin access

### No Errors Showing
**Problem:** Dashboard shows "No errors found"  
**Solution:**
1. Trigger test error: `throw new Error("Test error")`
2. Check `audit_logs` table: `SELECT * FROM audit_logs WHERE action = 'error'`
3. Verify error logging is configured in `src/lib/errorTracking.ts`

### Alerts Not Firing
**Problem:** No email notifications  
**Solution:**
1. Check cron job is set up: `SELECT * FROM cron.job`
2. Verify alert rules are enabled: `SELECT * FROM alert_rules WHERE enabled = true`
3. Test manual alert trigger (see "Test Alerts" section)
4. Check Resend API key is configured
5. Verify email queue: `SELECT * FROM email_queue`

### Tests Failing
**Problem:** Tests fail locally  
**Solution:**
```bash
# Clear node_modules and reinstall
rm -rf node_modules package-lock.json
npm install

# Verify Vitest config
cat vitest.config.ts

# Run with verbose output
npm run test -- --reporter=verbose

# Check specific test
npm run test -- auth-guard.test.tsx
```

### Smoke Tests Timeout
**Problem:** Playwright tests timeout  
**Solution:**
```bash
# Ensure dev server is running
npm run dev

# Wait for server to be ready (check http://localhost:5173)
curl http://localhost:5173

# Run with headed mode to see what's happening
npx playwright test --headed

# Increase timeout in playwright.config.ts
```

---

## 📚 Additional Resources

### Documentation Files
- `PROJECT_AUDIT_JAN2026.md` - Full project audit
- `ACTION_PLAN_QUICK_START.md` - 4-week implementation plan
- `IMPLEMENTATION_STATUS.md` - Complete implementation summary
- `DEPLOYMENT.md` - Deployment guide
- `SECURITY.md` - Security documentation
- `CONTRIBUTING.md` - Development guidelines

### Key Files to Know
- `src/pages/ErrorDashboard.tsx` - Error monitoring UI
- `supabase/migrations/20260109000000_alert_system.sql` - Alert infrastructure
- `src/lib/errorTracking.ts` - Error tracking utilities
- `src/hooks/usePerformanceMonitor.ts` - Performance monitoring
- `src/hooks/useErrorHandling.ts` - Error handling hook

### External Resources
- [Vitest Docs](https://vitest.dev)
- [Playwright Docs](https://playwright.dev)
- [React Testing Library](https://testing-library.com/react)
- [Supabase Docs](https://supabase.com/docs)

---

## ✅ Verification Checklist

Before considering implementation complete:

- [ ] `.env` file created and configured
- [ ] Database migration applied
- [ ] Error dashboard accessible at `/errors`
- [ ] Alert rules visible in database
- [ ] Test dependencies installed
- [ ] Unit tests passing (`npm run test`)
- [ ] Smoke tests passing (`npm run test:smoke`)
- [ ] GitHub secrets configured
- [ ] Staging workflow tested
- [ ] Team trained on error dashboard
- [ ] Alert email addresses configured
- [ ] Monitoring added to daily routine

---

## 🎉 You're Ready!

**Everything is implemented and ready to use:**
- ✅ Error monitoring: $0/month (vs $29 Sentry)
- ✅ Alerting: $0/month (vs $49 PagerDuty)
- ✅ Performance monitoring: $0/month (vs $15 Datadog)
- ✅ Testing: $0/month (vs $50 CI)

**Total savings: $143/month = $1,716/year** 💰

**Next steps:**
1. Apply database migration
2. Configure .env
3. Access error dashboard
4. Set up alert emails
5. Run tests
6. Deploy to staging

**Questions?** Check the troubleshooting section or review the detailed documentation files!
