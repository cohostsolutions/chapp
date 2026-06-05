# Technical Recommendations - Implementation Details

**Date:** January 9, 2026  
**Status:** Detailed action items for each identified gap

---

## 1. Testing Infrastructure Setup

### Problem
- Zero automated tests for React components
- No test runner configured
- No coverage tracking
- Risk of regressions in production

### Solution

#### Step 1: Install Dependencies
```bash
npm install --save-dev \
  jest \
  @testing-library/react \
  @testing-library/jest-dom \
  ts-jest \
  @types/jest \
  jest-environment-jsdom
```

#### Step 2: Create Jest Configuration

**File:** `jest.config.ts`
```typescript
import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/main.tsx',
    '!src/vite-env.d.ts',
    '!src/**/*.stories.tsx',
  ],
  coverageThreshold: {
    global: {
      branches: 50,
      functions: 60,
      lines: 60,
      statements: 60,
    },
    './src/lib/': {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};

export default config;
```

#### Step 3: Create Setup File

**File:** `src/setupTests.ts`
```typescript
import '@testing-library/jest-dom';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock service worker if needed
// import { server } from './mocks/server';
// beforeAll(() => server.listen());
// afterEach(() => server.resetHandlers());
// afterAll(() => server.close());
```

#### Step 4: Add Test Scripts

**File:** `package.json`
```json
{
  "scripts": {
    "test": "jest",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "test:ui": "jest --coverage --watchAll"
  }
}
```

#### Step 5: Create Example Tests

**File:** `src/components/__tests__/ErrorBoundary.test.tsx`
```typescript
import React from 'react';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '../ErrorBoundary';

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <div>Test content</div>
      </ErrorBoundary>
    );
    
    expect(screen.getByText('Test content')).toBeInTheDocument();
  });

  it('displays error message when child throws', () => {
    const ThrowError = () => {
      throw new Error('Test error');
    };

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    
    render(
      <ErrorBoundary>
        <ThrowError />
      </ErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();
    
    consoleErrorSpy.mockRestore();
  });
});
```

### Estimated Effort: 4-6 hours
### Impact: CRITICAL - Prevents regressions

---

## 2. CI/CD Pipeline with GitHub Actions

### Problem
- No automated testing on pull requests
- No security scanning
- Manual deployment prone to errors
- No dependency audit

### Solution

#### Step 1: Create Quality Checks Workflow

**File:** `.github/workflows/quality.yml`
```yaml
name: Quality Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]
  schedule:
    # Run daily at 2 AM UTC
    - cron: '0 2 * * *'

jobs:
  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run ESLint
        run: npm run lint
        continue-on-error: false

  type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Type check
        run: npm run type-check

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run tests
        run: npm run test:coverage
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v4
        with:
          files: ./coverage/coverage-final.json

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Audit dependencies
        run: npm audit --audit-level=moderate
        continue-on-error: true
      
      - name: Scan for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

  build:
    runs-on: ubuntu-latest
    needs: [lint, type-check, test, security]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Build
        run: npm run build
      
      - name: Check bundle size
        uses: andresz1/size-limit-action@v1
        with:
          limit: 500kb
          build_dir: dist
        continue-on-error: true
```

#### Step 2: Create Deployment Workflow (Optional)

**File:** `.github/workflows/deploy.yml`
```yaml
name: Deploy to Staging

on:
  push:
    branches: [develop]

jobs:
  deploy:
    runs-on: ubuntu-latest
    needs: [quality]
    environment: staging
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Deploy via Lovable (recommended)
        run: |
          echo "Deployment handled by Lovable pipeline. No action here."
```

### Estimated Effort: 4-6 hours
### Impact: CRITICAL - Automates quality gates

---

## 3. Fix Legacy Edge Function Imports

### Problem
- Some functions use old CDN imports
- Inconsistent with `deno.json` configuration
- May cause reliability issues

### Solution

#### Identify Files to Update
```bash
# Find old imports
grep -r "https://deno.land/" supabase/functions/ | grep -v node_modules
grep -r "https://esm.sh/" supabase/functions/ | grep -v node_modules
```

#### Update Deno Configuration

**File:** `supabase/functions/deno.json`
```json
{
  "compilerOptions": {
    "lib": ["deno.window"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true
  },
  "imports": {
    "@supabase/supabase-js": "npm:@supabase/supabase-js@2",
    "zod": "npm:zod@3.22.4",
    "std/http/server": "https://deno.land/std@0.190.0/http/server.ts",
    "resend": "npm:resend@2.0.0"
  }
}
```

#### Update Functions

**Example: book-demo/index.ts**
```typescript
// ❌ OLD
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// ✅ NEW
import { serve } from "std/http/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
```

**Files to Update:**
1. `supabase/functions/book-demo/index.ts`
2. `supabase/functions/health-check/index.ts`
3. Any others with old imports

### Verification
```bash
# Verify all imports match deno.json
grep -r "https://esm.sh\|https://deno.land" supabase/functions/ \
  | grep -v "std/http/server\|std@" \
  | grep -v node_modules
```

### Estimated Effort: 1-2 hours
### Impact: MEDIUM - Consistency and reliability

---

## 4. Enable Strict TypeScript

### Problem
- Edge functions have `"strict": false`
- Type errors not caught until runtime
- Inconsistent with app code

### Solution

#### Update deno.json
```json
{
  "compilerOptions": {
    "lib": ["deno.window"],
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noImplicitThis": true,
    "alwaysStrict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false
  }
}
```

#### Fix Type Errors
Run type check and fix errors:
```bash
deno check supabase/functions/*/index.ts
```

**Common Fixes:**
```typescript
// ❌ Old - Implicit any
function processRequest(req) {
  return req.json();
}

// ✅ New - Explicit type
function processRequest(req: Request) {
  return req.json();
}

// ❌ Old - Any type
const data: any = await fetch(...);

// ✅ New - Proper type
const data: { id: string; name: string } = await fetch(...).then(r => r.json());
```

### Estimated Effort: 3-4 hours
### Impact: HIGH - Better type safety

---

## 5. Add Comprehensive Logging

### Problem
- Console.error() only
- No structured logging
- Hard to track issues across requests

### Solution

#### Create Logging Utility

**File:** `supabase/functions/_shared/logging.ts`
```typescript
interface LogContext {
  userId?: string;
  organizationId?: string;
  requestId?: string;
  [key: string]: any;
}

interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

export class Logger {
  private context: LogContext = {};

  setContext(context: Partial<LogContext>) {
    this.context = { ...this.context, ...context };
  }

  private log(level: string, message: string, error?: Error): void {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level: level as any,
      message,
      context: this.context,
    };

    if (error) {
      entry.error = {
        name: error.name,
        message: error.message,
        stack: error.stack,
      };
    }

    // Log to stdout (Supabase collects automatically)
    console.log(JSON.stringify(entry));
  }

  info(message: string) {
    this.log('info', message);
  }

  warn(message: string) {
    this.log('warn', message);
  }

  error(message: string, error?: Error) {
    this.log('error', message, error);
  }

  debug(message: string) {
    this.log('debug', message);
  }
}

export function createLogger(context?: LogContext) {
  const logger = new Logger();
  if (context) logger.setContext(context);
  return logger;
}
```

#### Usage in Functions
```typescript
const logger = createLogger({
  functionName: 'ai-chat',
  userId: authContext.user.id,
  organizationId: organizationId,
});

logger.info('Starting AI chat processing');
try {
  const response = await aiChat(message);
  logger.info('AI response generated successfully');
} catch (error) {
  logger.error('AI chat failed', error instanceof Error ? error : new Error(String(error)));
}
```

### Estimated Effort: 3-4 hours
### Impact: HIGH - Better observability

---

## 6. Add Error Tracking (Sentry)

### Problem
- No centralized error tracking
- Errors only visible in function logs
- Hard to aggregate and prioritize

### Solution

#### Install Sentry
```bash
npm install @sentry/react @sentry/vite-plugin
```

#### Configure in App

**File:** `src/main.tsx`
```typescript
import * as Sentry from "@sentry/react";
import { BrowserTracing } from "@sentry/tracing";

if (import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_SENTRY_ENV || 'production',
    integrations: [
      new BrowserTracing(),
      new Sentry.Replay({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

#### Configure in Edge Functions

**File:** `supabase/functions/ai-chat/index.ts`
```typescript
import * as Sentry from "https://esm.sh/@sentry/deno@7.99.0?no-check";

Sentry.init({
  dsn: Deno.env.get('SENTRY_DSN'),
  environment: Deno.env.get('ENVIRONMENT') || 'production',
  tracesSampleRate: 0.1,
});

try {
  // ... function code
} catch (error) {
  Sentry.captureException(error, {
    tags: {
      function: 'ai-chat',
      organizationId,
    },
  });
  throw error;
}
```

#### Environment Variables
```bash
VITE_SENTRY_DSN=https://xxx@sentry.io/xxx
VITE_SENTRY_ENV=production
SENTRY_DSN=https://xxx@sentry.io/xxx
```

### Estimated Effort: 4 hours
### Impact: HIGH - Production debugging

---

## 7. API Documentation

### Problem
- Edge functions not formally documented
- New developers struggle with API format
- No OpenAPI spec

### Solution

#### Option A: Generate from Comments

**File:** `supabase/functions/ai-chat/index.ts`
```typescript
/**
 * @api {post} /functions/v1/ai-chat AI Chat
 * @apiName AIChat
 * @apiGroup AI
 * @apiAuth Bearer token
 * 
 * @apiParam {string} message The user message
 * @apiParam {string[]} [imageUrls] Optional image URLs
 * @apiParam {string} [leadId] Lead ID for context
 * @apiParam {string} [conversationId] Conversation ID
 * @apiParam {string} [organizationId] Organization (admin only)
 * 
 * @apiSuccess {string} response AI response
 * @apiSuccess {string} conversationId Conversation ID
 * 
 * @apiError {401} Unauthorized Invalid or missing token
 * @apiError {403} Forbidden Cross-organization access
 * @apiError {429} TooManyRequests Rate limited
 */
```

#### Option B: Manual OpenAPI Spec

**File:** `docs/openapi.yml`
```yaml
openapi: 3.0.0
info:
  title: AlCor Nexus API
  version: 1.0.0
  description: Multi-tenant CRM platform API

servers:
  - url: https://your-project.supabase.co/functions/v1

paths:
  /ai-chat:
    post:
      summary: Send message to AI
      operationId: aiChat
      tags:
        - AI
      security:
        - bearer: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              required:
                - message
              properties:
                message:
                  type: string
                  maxLength: 10000
                imageUrls:
                  type: array
                  items:
                    type: string
                    format: url
                leadId:
                  type: string
                  format: uuid
                conversationId:
                  type: string
                  format: uuid
      responses:
        '200':
          description: Success
          content:
            application/json:
              schema:
                type: object
                properties:
                  response:
                    type: string
                  conversationId:
                    type: string
        '401':
          description: Unauthorized
        '403':
          description: Forbidden
        '429':
          description: Too many requests
```

#### Option C: Generate with Swagger UI

```bash
npm install swagger-ui-express

# Serve docs at /api-docs
```

### Estimated Effort: 3-4 hours
### Impact: MEDIUM - Developer onboarding

---

## 8. Consolidate Documentation

### Problem
- Security info in 3 different files
- Recommendations scattered
- Hard to find information

### Solution

#### Create Unified Structure

```
docs/
├── README.md                 # Quick start
├── SECURITY.md              # Security architecture
├── PERFORMANCE.md           # Performance guide
├── DEPLOYMENT.md            # Deployment guide
├── CONTRIBUTING.md          # Developer guide
├── API.md                   # API documentation
├── TROUBLESHOOTING.md       # Common issues
└── architecture/
    ├── database.md
    ├── auth.md
    ├── ai-functions.md
    └── pwa.md
```

#### Deduplication
- Security info → consolidate into one `SECURITY.md`
- Performance tips → one `PERFORMANCE.md`
- Deployment steps → one `DEPLOYMENT.md`

#### Cross-referencing
```markdown
# Security

See [API Documentation](./API.md) for endpoint details.

For performance considerations, see [Performance Guide](./PERFORMANCE.md).

Troubleshooting? Check [Common Issues](./TROUBLESHOOTING.md).
```

### Estimated Effort: 4-5 hours
### Impact: MEDIUM - Documentation quality

---

## Summary: Implementation Order

1. **Week 1:** Fix imports + create CI/CD (6 hours)
2. **Week 2-3:** Set up testing (25 hours)
3. **Week 4:** Add error tracking + docs (12 hours)

**Total: ~43 hours of focused work**

---

## Success Metrics

After implementation:
- ✅ 0 security vulnerabilities in automated scan
- ✅ 70%+ test coverage
- ✅ All PRs require passing CI checks
- ✅ Error tracking <5 minute response time
- ✅ <5% production incident rate

---

**Next:** Review these recommendations and prioritize with your team.
