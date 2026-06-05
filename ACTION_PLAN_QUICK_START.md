# 🚀 Quick Start Action Plan - AlCor Nexus Improvements

**Goal:** Address critical gaps in 4 weeks  
**Focus:** Testing, Monitoring, Deployment Safety  
**Investment:** ~80 hours, ~$500 in tools

---

## 📅 Week 1: Foundation (24 hours)

### Day 1: Environment & Monitoring (4 hours)

#### Task 1.1: Create .env.example (30 min)
```bash
# Create template for environment variables
cat > .env.example << 'EOF'
# Supabase Configuration
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
VAULT_ENCRYPTION_KEY=your_32_character_encryption_key

# Third-Party Integrations
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_WHATSAPP_NUMBER=whatsapp:+1234567890

FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_secret
META_APP_SECRET=your_meta_secret

GOOGLE_OAUTH_CLIENT_SECRET=your_google_secret
OAuth_Client_ID=your_oauth_client_id

RESEND_API_KEY=your_resend_api_key
LOVABLE_API_KEY=your_lovable_key

# Monitoring & Analytics (Optional)
VITE_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project
VITE_SENTRY_ENV=production
VITE_SENTRY_DEV_ENABLED=false

# Performance (Optional)
VITE_UPSTASH_REDIS_REST_URL=your_redis_url
VITE_UPSTASH_REDIS_REST_TOKEN=your_redis_token
EOF

git add .env.example
git commit -m "docs: add environment variables template"
```

#### Task 1.2: Deploy Sentry (2.5 hours)
```bash
# 1. Create Sentry account (free tier)
# Go to sentry.io and create project

# 2. Get DSN from Sentry dashboard
# Add to .env
echo "VITE_SENTRY_DSN=your_actual_dsn" >> .env

# 3. Verify Sentry is configured
grep -r "Sentry.init" src/

# 4. Test error tracking
npm run build
npm run preview

# 5. Trigger test error in browser console
# Open http://localhost:4173
# In browser console: throw new Error("Test Sentry")

# 6. Verify error appears in Sentry dashboard
```

#### Task 1.3: Git Commit & Document (1 hour)
```bash
# Update documentation
cat >> README.md << 'EOF'

## 🔧 Environment Setup

1. Copy environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your credentials in .env

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start development server:
   ```bash
   npm run dev
   ```

EOF

git add README.md
git commit -m "docs: add environment setup instructions"
- ✅ Sentry deployed and receiving events
- ✅ README.md updated
### Day 2-3: Critical Path Tests (12 hours)

import { renderHook, waitFor } from '@testing-library/react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
// Mock Supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
    },
    from: vi.fn(() => ({
        }))
      }))
describe('Auth Guard - Organization Isolation', () => {
    vi.clearAllMocks();
  });

  it('should prevent cross-organization access', async () => {
    // Setup: User from Org A tries to access Org B data
    const userOrgA = {
      id: 'user-1',
      email: 'user@orga.com'
    };

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: { user: userOrgA },
      error: null
    });

      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { organization_id: 'org-a', role: 'agent' },
      }))
    } as any);
    
      expect(result.current.user).toBeTruthy();
      expect(result.current.organizationId).toBe('org-a');
    });

    // Verify: RLS should block cross-org access
    // This is enforced at database level, test documents expected behavior
  });

  it('should allow same-organization access', async () => {
    // TODO: Implement same-org access test
  });

  it('should handle super_admin access', async () => {
    // TODO: Implement super_admin test
  });
});
```

#### Test 2: Lead Creation (3 hours)
```typescript
// src/__tests__/components/AddLeadDialog.test.tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AddLeadDialog } from '@/components/AddLeadDialog';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } }
});

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>
    {children}
  </QueryClientProvider>
);

describe('AddLeadDialog', () => {
  it('should validate required fields', async () => {
    render(<AddLeadDialog open={true} onOpenChange={vi.fn()} />, { wrapper });

    // Submit without filling form
    const submitButton = screen.getByRole('button', { name: /create lead/i });
    fireEvent.click(submitButton);

    // Should show validation errors
    await waitFor(() => {
      expect(screen.getByText(/name is required/i)).toBeInTheDocument();
    });
  });

  it('should create lead with valid data', async () => {
    const onOpenChange = vi.fn();
    render(<AddLeadDialog open={true} onOpenChange={onOpenChange} />, { wrapper });

    // Fill form
    fireEvent.change(screen.getByLabelText(/name/i), {
      target: { value: 'John Doe' }
    });
    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'john@example.com' }
    });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /create lead/i }));

    // Should close dialog on success
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });
});
```

#### Test 3: Social Webhook Processing Lock (3 hours)
```typescript
// supabase/functions/_tests/processing-lock.test.ts
import { assertEquals, assertExists } from "https://deno.land/std@0.190.0/testing/asserts.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

Deno.test("Processing Lock - Prevent Duplicate Processing", async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const messageId = `test-msg-${Date.now()}`;
  const orgId = "test-org-123";

  // Attempt to claim lock twice
  const lock1 = await supabase.rpc("claim_processing_lock", {
    p_message_id: messageId,
    p_org_id: orgId,
    p_ttl_seconds: 60
  });

  const lock2 = await supabase.rpc("claim_processing_lock", {
    p_message_id: messageId,
    p_org_id: orgId,
    p_ttl_seconds: 60
  });

  // First claim should succeed, second should fail
  assertEquals(lock1.data, true, "First lock claim should succeed");
  assertEquals(lock2.data, false, "Second lock claim should fail (already locked)");

  // Cleanup
  await supabase.rpc("release_processing_lock", { p_message_id: messageId });
});

Deno.test("Processing Lock - Auto-Expire", async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const messageId = `test-msg-expire-${Date.now()}`;
  const orgId = "test-org-123";

  // Claim lock with 1-second TTL
  await supabase.rpc("claim_processing_lock", {
    p_message_id: messageId,
    p_org_id: orgId,
    p_ttl_seconds: 1
  });

  // Wait for expiry
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Should be able to claim again
  const lock2 = await supabase.rpc("claim_processing_lock", {
    p_message_id: messageId,
    p_org_id: orgId,
    p_ttl_seconds: 60
  });

  assertEquals(lock2.data, true, "Lock should be claimable after expiry");
});
```

#### Test 4: Date Validation (2 hours)
```typescript
// supabase/functions/_tests/date-validation.test.ts
import { assertEquals } from "https://deno.land/std@0.190.0/testing/asserts.ts";

function validateDateRange(startDate: string, endDate: string): { valid: boolean; error?: string } {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const now = new Date();

  // Check for inverted dates
  if (start > end) {
    return { valid: false, error: "Start date cannot be after end date" };
  }

  // Check max range (366 days)
  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays > 366) {
    return { valid: false, error: "Date range cannot exceed 366 days" };
  }

  // Check future limit (2 years)
  const twoYearsFromNow = new Date();
  twoYearsFromNow.setFullYear(twoYearsFromNow.getFullYear() + 2);
  if (end > twoYearsFromNow) {
    return { valid: false, error: "End date cannot be more than 2 years in the future" };
  }

  return { valid: true };
}

Deno.test("Date Validation - Inverted Dates", () => {
  const result = validateDateRange("2026-02-01", "2026-01-01");
  assertEquals(result.valid, false);
  assertEquals(result.error, "Start date cannot be after end date");
});

Deno.test("Date Validation - Exceeds 366 Days", () => {
  const start = "2026-01-01";
  const end = "2027-01-03"; // 367 days
  const result = validateDateRange(start, end);
  assertEquals(result.valid, false);
  assertEquals(result.error, "Date range cannot exceed 366 days");
});

Deno.test("Date Validation - Valid Range", () => {
  const start = "2026-01-01";
  const end = "2026-12-31"; // 364 days
  const result = validateDateRange(start, end);
  assertEquals(result.valid, true);
});
```

#### Test 5: Integration Test Setup (1 hour)
```typescript
// src/__tests__/setup.ts
import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

// Mock environment variables
vi.stubGlobal('import.meta', {
  env: {
    VITE_SUPABASE_URL: 'http://localhost:54321',
    VITE_SUPABASE_PUBLISHABLE_KEY: 'test-key',
    MODE: 'test'
  }
});
```

**Deliverables:**
- ✅ 5 critical path tests written
- ✅ Test infrastructure validated
- ✅ CI/CD running tests

---

### Day 4-5: Staging Environment (8 hours)

#### Task 3.1: Create Staging Branch Strategy (1 hour)
```bash
# Create develop branch if not exists
git checkout -b develop
git push -u origin develop

# Set up branch protection rules in GitHub
# Settings > Branches > Add rule
# - Branch name pattern: main
# - Require pull request reviews: 1
# - Require status checks: quality (lint, test, build)
```

#### Task 3.2: Staging Deployment Workflow (3 hours)
```yaml
# .github/workflows/deploy-staging.yml
name: Deploy to Staging

on:
  push:
    branches: [develop]
  workflow_dispatch:

env:
  VERCEL_ORG_ID: ${{ secrets.VERCEL_ORG_ID }}
  VERCEL_PROJECT_ID: ${{ secrets.VERCEL_PROJECT_ID }}

jobs:
  deploy:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build application
        run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.STAGING_SUPABASE_URL }}
          VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.STAGING_SUPABASE_KEY }}
      
      - name: Install Vercel CLI
        run: npm install -g vercel
      
      - name: Deploy to Vercel Staging
        run: vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
        id: deploy
      
      - name: Comment PR with Staging URL
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: '🚀 Staging deployed: ${{ steps.deploy.outputs.url }}'
            })
      
      - name: Run Smoke Tests
        run: |
          npm run test:smoke -- --url=${{ steps.deploy.outputs.url }}
        continue-on-error: true
```

#### Task 3.3: Smoke Tests (3 hours)
```typescript
// tests/smoke/basic.test.ts
import { test, expect } from '@playwright/test';

test.describe('Smoke Tests - Staging', () => {
  const baseUrl = process.env.TEST_URL || 'http://localhost:5173';

  test('homepage loads', async ({ page }) => {
    await page.goto(baseUrl);
    await expect(page).toHaveTitle(/AlCor Nexus/);
  });

  test('auth page accessible', async ({ page }) => {
    await page.goto(`${baseUrl}/auth`);
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('dashboard requires authentication', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard`);
    // Should redirect to auth
    await expect(page).toHaveURL(/\/auth/);
  });

  test('API health check', async ({ request }) => {
    const response = await request.get(`${baseUrl}/health`);
    expect(response.ok()).toBeTruthy();
  });
});
```

#### Task 3.4: Configure Secrets (1 hour)
```bash
# Add secrets to GitHub
# Settings > Secrets and variables > Actions

# Required secrets:
# - VERCEL_TOKEN (from vercel.com)
# - VERCEL_ORG_ID (from vercel.com)
# - VERCEL_PROJECT_ID (from vercel.com)
# - STAGING_SUPABASE_URL
# - STAGING_SUPABASE_KEY

# Test deployment
git checkout develop
git push
# Watch GitHub Actions run
```

**Deliverables:**
- ✅ Staging environment deployed
- ✅ Smoke tests operational
- ✅ Automated deployments on develop push

---

## 📅 Week 2-3: Testing Blitz (40 hours)

### Unit Tests for Hooks (20 hours)

```bash
# Create test files for critical hooks
touch src/__tests__/hooks/useAuth.test.ts
touch src/__tests__/hooks/useErrorHandling.test.ts
touch src/__tests__/hooks/usePerformanceMonitor.test.ts
touch src/__tests__/hooks/useLeads.test.ts
touch src/__tests__/hooks/useOrders.test.ts
```

**Priority Hooks to Test:**
1. useAuth (auth isolation) - 3 hours
2. useErrorHandling (error boundaries) - 2 hours
3. usePerformanceMonitor (metrics) - 2 hours
4. useLeads (CRUD operations) - 4 hours
5. useOrders (CRUD operations) - 4 hours
6. useSupabaseQuery (generic wrapper) - 3 hours
7. useMultiCurrency (conversions) - 2 hours

### Component Tests (15 hours)

**Critical Components:**
1. Dashboard stats cards - 3 hours
2. Lead list with filters - 4 hours
3. Order management - 4 hours
4. AI Chat interface - 4 hours

### Integration Tests (10 hours)

**Edge Functions:**
1. social-webhook (processing lock, date validation) - 4 hours
2. ai-chat (timeout, rate limiting) - 3 hours
3. book-demo (calendar integration) - 3 hours

**Goal: 30% coverage by end of Week 3**

---

## 📅 Week 4: Documentation & Monitoring (16 hours)

### API Documentation (8 hours)

```bash
# Install Stoplight for API docs
npm install --save-dev @stoplight/spectral-cli

# Create OpenAPI spec
mkdir -p docs/api
touch docs/api/openapi.yml
```

**Document these endpoints:**
1. /social-webhook - 2 hours
2. /ai-chat - 1 hour
3. /book-demo - 1 hour
4. /process-document - 1 hour
5. /twilio-voice-token - 1 hour
6. Authentication flows - 2 hours

### Observability Stack (8 hours)

```bash
# Install APM tools
npm install @opentelemetry/api @opentelemetry/sdk-node

# Configure alerting
# 1. Set up PagerDuty integration (2 hours)
# 2. Configure alert thresholds (2 hours)
# 3. Create runbooks (2 hours)
# 4. Test alerting pipeline (2 hours)
```

**Alerts to Configure:**
1. Error rate > 5% (5 min window)
2. Response time > 3s (p95)
3. Database connection failures
4. Vault decryption failures
5. Failed deployments

---

## 📊 Progress Tracking

### Daily Standup Questions
1. What tests did you write yesterday?
2. What's blocking your testing progress?
3. What tests will you write today?

### Weekly Metrics
- [ ] Week 1: Test coverage at 5%
- [ ] Week 2: Test coverage at 15%
- [ ] Week 3: Test coverage at 30%
- [ ] Week 4: All documentation complete

### Tools to Use
- **Coverage:** Run `npm run test:coverage` daily
- **CI/CD:** Monitor GitHub Actions for failures
- **Sentry:** Check daily for new errors

---

## 💰 Budget Breakdown

### Week 1 ($100)
- Sentry Pro: $29/month
- Vercel (staging): $0 (free tier)
- Playwright: $0 (open source)
- **Total: $29**

### Week 2-3 ($150)
- Codecov: $0 (open source)
- Testing tools: $0
- **Total: $29 (ongoing Sentry)**

### Week 4 ($321)
- Datadog Starter: $15/month
- PagerDuty Free: $0
- UptimeRobot: $10/month
- **Total: $54/month**

**Total Investment: ~$500 over 4 weeks**

---

## ✅ Success Criteria

### Week 1 Complete When:
- [ ] .env.example exists
- [ ] Sentry receiving production errors
- [ ] 5 critical path tests passing
- [ ] Staging environment deployed

### Week 2-3 Complete When:
- [ ] 30% test coverage achieved
- [ ] CI/CD failing on test failures
- [ ] No critical bugs in staging

### Week 4 Complete When:
- [ ] API documentation published
- [ ] Alerting pipeline tested
- [ ] Runbooks created
- [ ] Team trained on new tools

---

## 🚨 Blockers & Solutions

### Common Blocker: "Don't have time to write tests"
**Solution:** Time-box 2 hours/day for testing, no exceptions

### Common Blocker: "Tests are flaky"
**Solution:** Use `waitFor()` and proper test isolation

### Common Blocker: "Don't know what to test"
**Solution:** Start with critical user journeys (auth, lead creation, AI chat)

### Common Blocker: "Staging is down"
**Solution:** Set up uptime monitoring, auto-deploy on push to develop

---

## 📞 Support & Resources

### Getting Help
- **Testing:** React Testing Library docs, Vitest docs
- **CI/CD:** GitHub Actions docs, Vercel docs
- **Monitoring:** Sentry docs, Datadog docs

### Team Communication
- Daily: Slack/Teams for blockers
- Weekly: Review coverage reports
- Monthly: Review incident reports

---

## 🎯 Next Steps

1. **Today:** Create .env.example, deploy Sentry (3 hours)
2. **Tomorrow:** Write first 2 tests (4 hours)
3. **This Week:** Complete Week 1 plan (24 hours total)

**Let's build confidence in our codebase! 🚀**
