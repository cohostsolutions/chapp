# Security Testing Guide

This document outlines security testing practices and CI/CD integration for AlCor Nexus CRM.

## Automated Security Testing Pipeline

### Pre-Commit Hooks

Add these checks to your development workflow:

```bash
# Install husky for git hooks
npm install -D husky

# Add pre-commit hook
npx husky add .husky/pre-commit "npm run security:check"
```

### Package.json Security Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "security:audit": "npm audit --audit-level=moderate",
    "security:check": "npm run security:audit && npm run lint",
    "security:fix": "npm audit fix",
    "security:secrets-scan": "npx secretlint '**/*'"
  }
}
```

## CI/CD Pipeline Configuration

### GitHub Actions Workflow

Create `.github/workflows/security.yml`:

```yaml
name: Security Checks

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    # Run daily at midnight UTC
    - cron: '0 0 * * *'

jobs:
  dependency-audit:
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
      
      - name: Run npm audit
        run: npm audit --audit-level=moderate
        continue-on-error: true
      
      - name: Check for vulnerable dependencies
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  secrets-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      
      - name: TruffleHog OSS - Secrets Scanning
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD
          extra_args: --only-verified

  code-analysis:
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
      
      - name: Run ESLint security plugin
        run: npx eslint . --ext .ts,.tsx --config eslint.config.js

  supabase-security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Supabase CLI
        uses: supabase/setup-cli@v1
        with:
          version: latest
      
      # Note: This requires Supabase project access
      - name: Run Supabase linter
        run: |
          supabase db lint --linked
        env:
          SUPABASE_ACCESS_TOKEN: ${{ secrets.SUPABASE_ACCESS_TOKEN }}
        continue-on-error: true
```

## Security Checklist for Pull Requests

### Automated Checks (CI/CD)

- [ ] npm audit passes with no high/critical vulnerabilities
- [ ] No secrets detected in code changes
- [ ] ESLint security rules pass
- [ ] Supabase RLS linter passes

### Manual Review Checklist

- [ ] **Authentication**: Changes don't bypass auth checks
- [ ] **Authorization**: RLS policies updated for new tables
- [ ] **Input Validation**: User inputs are validated with Zod
- [ ] **SQL Injection**: No raw SQL with user input
- [ ] **XSS Prevention**: No dangerouslySetInnerHTML with user input
- [ ] **Secrets**: No hardcoded API keys or credentials
- [ ] **Logging**: Sensitive data not logged to console
- [ ] **Edge Functions**: Public functions have rate limiting

## Recommended Security Tools

### Development Dependencies

```bash
npm install -D \
  eslint-plugin-security \
  @secretlint/secretlint-rule-preset-recommend \
  secretlint
```

### ESLint Security Configuration

Add to `eslint.config.js`:

```javascript
import security from 'eslint-plugin-security';

export default [
  // ... existing config
  {
    plugins: { security },
    rules: {
      'security/detect-object-injection': 'warn',
      'security/detect-non-literal-fs-filename': 'warn',
      'security/detect-eval-with-expression': 'error',
      'security/detect-non-literal-require': 'warn',
      'security/detect-possible-timing-attacks': 'warn',
    },
  },
];
```

### Secretlint Configuration

Create `.secretlintrc.json`:

```json
{
  "rules": [
    {
      "id": "@secretlint/secretlint-rule-preset-recommend"
    }
  ]
}
```

## Vulnerability Response Process

1. **Detection**: Automated scans run on every PR and daily
2. **Triage**: Security findings reviewed within 24 hours
3. **Remediation**: 
   - Critical: Fix immediately (same day)
   - High: Fix within 7 days
   - Medium: Fix within 30 days
   - Low: Fix in next release cycle
4. **Verification**: Re-run security scans after fix
5. **Documentation**: Update SECURITY.md with lessons learned

## Security Headers (Edge Functions)

All edge functions should include these headers:

```typescript
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};
```

## Contact

For security concerns, contact the Super Admin through the Security Dashboard.
