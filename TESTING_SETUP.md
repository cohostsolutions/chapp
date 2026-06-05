# Testing Setup - Next Steps

**Status:** ✅ Configuration complete, dependencies needed

---

## Runner Separation (current setup)

- **Unit tests:** Vitest (`npm test`), scoped to `src/` only.
- **E2E/Smoke:** Playwright (`npm run test:smoke` or `npm run test:e2e`).
- **Supabase Edge (Deno):** Run with Deno (excluded from Vitest).

Vitest excludes `tests/**` and `supabase/functions/_tests/**` to avoid cross-runner conflicts.

---

## 📦 Install Testing Dependencies

Run this command to install all testing packages:

```bash
npm install --save-dev \
  jest \
  @testing-library/react \
  @testing-library/jest-dom \
  @testing-library/user-event \
  ts-jest \
  @types/jest \
  jest-environment-jsdom \
  identity-obj-proxy
```

Or all at once:
```bash
npm install --save-dev jest @testing-library/react @testing-library/jest-dom @testing-library/user-event ts-jest @types/jest jest-environment-jsdom identity-obj-proxy
```

**Time:** ~2 minutes  
**Files Added:** 100+ to node_modules

---

## ✅ Verify Installation

After installing, verify everything works:

```bash
# Check Jest is installed
npm test -- --version
# Should show: version X.X.X

# Try running tests (should find 0 tests)
npm test
# Output: No tests found

# Check coverage works
npm run test:coverage
# Output: FAIL (expected, no tests yet)
```

---

## 🧪 Create Your First Test

Create a simple test file to verify everything works:

**File:** `src/lib/__tests__/utils.test.ts`

```typescript
describe('Utils', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

Then run:
```bash
npm test
# Should show: ✓ 1 test passed
```

---

## 📝 Creating Tests - Basic Patterns

### Unit Test (Utility Function)

**File:** `src/lib/__tests__/cache.test.ts`

```typescript
import { cache, CacheTTL } from '../cache';

describe('Cache Utilities', () => {
  beforeEach(async () => {
    await cache.clear?.();
  });

  it('should set and get values', async () => {
    await cache.set('test-key', { data: 'test' }, CacheTTL.SHORT);
    const result = await cache.get('test-key');
    expect(result).toEqual({ data: 'test' });
  });

  it('should return null for missing keys', async () => {
    const result = await cache.get('nonexistent');
    expect(result).toBeNull();
  });
});
```

### Component Test (React)

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

    const consoleErrorSpy = jest.spyOn(console, 'error')
      .mockImplementation(() => {});

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

### Hook Test

**File:** `src/hooks/__tests__/useAuth.test.ts`

```typescript
import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';

describe('useAuth', () => {
  it('should return user when authenticated', async () => {
    const { result } = renderHook(() => useAuth());

    await act(async () => {
      // Simulate login
      // await result.current.login('user@example.com', 'password');
    });

    // expect(result.current.user).toBeDefined();
  });
});
```

---

## 🎯 Priority Test Files to Create

### Week 1 - Utilities (High Impact, Easy)
1. **Cache utilities** - `src/lib/__tests__/cache.test.ts`
   - 5-10 tests
   - Simple, pure functions
   - High reusability

2. **Auth helpers** - `src/lib/__tests__/auth.test.ts`
   - 5-8 tests
   - Token validation, role checking
   - Security-critical

3. **Formatting utilities** - `src/lib/__tests__/formatters.test.ts`
   - 10-15 tests
   - Date, currency, phone formatting
   - Good learning tests

### Week 2 - Components (Medium, More Complex)
1. **ErrorBoundary** - `src/components/__tests__/ErrorBoundary.test.tsx`
   - 4-5 tests
   - Error handling

2. **LeadImportExport** - `src/components/__tests__/LeadImportExport.test.tsx`
   - 6-8 tests
   - File handling, UI interaction

3. **TokenExpiryAlert** - `src/components/__tests__/TokenExpiryAlert.test.tsx`
   - 5-7 tests
   - Modal display, cleanup

### Week 3 - Edge Functions (Critical Security)
1. **ai-chat auth** - `supabase/functions/_tests/ai-chat-auth.test.ts`
   - 5-8 tests
   - Auth validation, org isolation

2. **process-document validation** - `supabase/functions/_tests/document-validation.test.ts`
   - 5-8 tests
   - File type checking, size validation

3. **Rate limiting** - `supabase/functions/_tests/rate-limit.test.ts`
   - 4-6 tests
   - Limit enforcement

---

## 📊 Testing Checklist

Before pushing to production:

- [ ] Install all testing dependencies
- [ ] Run `npm test` and see "No tests found" (expected)
- [ ] Create first test file (utils)
- [ ] Run `npm test` and see ✓ tests pass
- [ ] Create component test
- [ ] Add edge function test
- [ ] Run `npm run test:coverage`
- [ ] Verify coverage report shows test runs

---

## 🔍 Debugging Tests

### Run specific test
```bash
npm test -- --testNamePattern="ErrorBoundary"
```

### Watch mode with verbose output
```bash
npm run test:watch -- --verbose
```

### Debug single test
```bash
npm run test:debug -- --testNamePattern="MyTest"
```

Then open `chrome://inspect` in Chrome

### See what's in test environment
```typescript
// Inside any test
console.log(screen.debug()); // Shows rendered HTML
```

---

## 📚 Testing Resources

- **Jest Docs:** https://jestjs.io/docs/getting-started
- **React Testing Library:** https://testing-library.com/docs/react-testing-library/intro/
- **Testing Best Practices:** https://kentcdodds.com/blog/common-mistakes-with-react-testing-library

---

## ✨ What Happens Next

1. **GitHub Actions** will fail initially (no tests)
2. As you add tests, pass rate increases
3. Coverage report builds up
4. Team gets confidence in changes
5. Regressions caught before production

---

## 🚀 Commands to Remember

```bash
npm test                  # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
npm run test:debug      # Debug mode

npm run lint            # Check code style
npm run type-check      # Check types
npm run build           # Build for production
```

---

**Ready to add tests?** Start with utilities - they're the easiest and have high impact! 🚀
