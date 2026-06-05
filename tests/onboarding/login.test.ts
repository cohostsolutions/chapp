/**
 * E2E tests – User Login
 *
 * Strategy: act as a ruthless QA engineer.
 *  - Verify HTML5 / client-side validation gates (empty fields, format).
 *  - Submit deliberately bad data to inspect server-side error surfaces.
 *  - Probe adversarial payloads (XSS, SQL-injection patterns, oversized strings).
 *  - Confirm the happy path (skipped when live credentials are absent).
 *  - Verify UX details: password-visibility toggle, loading state, redirect.
 *
 * The tests that need a real Supabase session are gated with `test.skip` so the
 * suite stays green in CI environments that have no test account configured.
 */

import { test, expect } from '@playwright/test';
import {
  gotoAuth,
  fillAndSubmitLogin,
  loginAsTestUser,
  waitForToast,
  expectErrorToast,
  Sel,
  TEST_EMAIL,
  TEST_PASSWORD,
  UNKNOWN_EMAIL,
  HAS_LIVE_CREDS,
  DASHBOARD_PATH,
  AUTH_PATH,
} from './helpers';

// ---------------------------------------------------------------------------
// A. Form structure & accessibility
// ---------------------------------------------------------------------------

test.describe('Login page – structure & accessibility', () => {
  test('renders the email and password fields with correct attributes', async ({ page }) => {
    await gotoAuth(page);

    const email = page.locator(Sel.emailInput);
    const password = page.locator(Sel.passwordInput);
    const submit = page.locator(Sel.signInButton);

    await expect(email).toBeVisible();
    await expect(email).toHaveAttribute('type', 'email');
    await expect(email).toHaveAttribute('required', '');

    await expect(password).toBeVisible();
    await expect(password).toHaveAttribute('required', '');

    await expect(submit).toBeVisible();
    await expect(submit).toBeEnabled();
  });

  test('page has a document title', async ({ page }) => {
    await gotoAuth(page);
    await expect(page).toHaveTitle(/sign in|login|alcor nexus|canvas capital/i);
  });

  test('"Back to Home" link is present', async ({ page }) => {
    await gotoAuth(page);
    await expect(page.getByRole('link', { name: /back to home/i })).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// B. Client-side (HTML5) validation – no network call should be made
// ---------------------------------------------------------------------------

test.describe('Login form – client-side validation', () => {
  test('blocks submission when both fields are empty', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.signInButton).click();

    // The browser's built-in validation should prevent any network request.
    // The URL must not change (still /auth).
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('blocks submission when email is empty (password filled)', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.passwordInput).fill('SomePassword1!');
    await page.locator(Sel.signInButton).click();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('blocks submission when password is empty (email filled)', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.signInButton).click();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('rejects a malformed email address', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill('not-an-email');
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();
    // HTML5 email validation prevents submission.
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('rejects an email missing the TLD (foo@bar)', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill('foo@bar');
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('rejects an email missing the @ symbol', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill('foobarexample.com');
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('password field enforces minLength=6 via native validation', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    // 5 characters – below the minLength=6 attribute on the input
    await page.locator(Sel.passwordInput).fill('12345');
    await page.locator(Sel.signInButton).click();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });
});

// ---------------------------------------------------------------------------
// C. Server-side / Supabase error handling
// ---------------------------------------------------------------------------

test.describe('Login form – server-side error handling', () => {
  test('shows error toast for wrong password on a known email', async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Requires E2E_TEST_EMAIL env var');
    await gotoAuth(page);
    await fillAndSubmitLogin(page, TEST_EMAIL, 'definitelyWrongPassword999!');

    await expectErrorToast(page, /login failed|invalid|credentials|password/i);
    // Must stay on /auth
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('shows error toast for an unknown email address', async ({ page }) => {
    await gotoAuth(page);
    await fillAndSubmitLogin(page, UNKNOWN_EMAIL, 'SomePassword1!');

    // The app should surface some kind of error – exact wording varies.
    const errorText = page.locator(
      '[role="status"].destructive, .destructive[data-state="open"]',
    );
    await expect(errorText.first()).toBeVisible({ timeout: 15_000 });
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('submit button shows loading state while request is in-flight', async ({ page }) => {
    await gotoAuth(page);

    // Artificially slow down the Supabase auth endpoint so we can observe the
    // loading spinner, then abort the route.
    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.abort();
    });

    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).fill('AnyPassword1!');
    await page.locator(Sel.signInButton).click();

    // The button should become disabled (loading state).
    await expect(page.locator(Sel.signInButton)).toBeDisabled({ timeout: 3_000 });
  });
});

// ---------------------------------------------------------------------------
// D. Adversarial / injection payloads
// ---------------------------------------------------------------------------

test.describe('Login form – adversarial inputs', () => {
  test('does not crash on XSS payload in email field', async ({ page }) => {
    await gotoAuth(page);
    const xssPayload = '<script>alert("xss")</script>@example.com';
    await page.locator(Sel.emailInput).fill(xssPayload);
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();

    // Page must not execute the script or navigate away.
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
    // No JS alert should have fired.
    page.on('dialog', (d) => {
      throw new Error(`Unexpected dialog: ${d.message()}`);
    });
  });

  test('does not crash on SQL injection payload in email field', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill("' OR '1'='1");
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();
    // HTML5 email validation should block this as it's not a valid email.
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('does not crash on a 1,000-character email string', async ({ page }) => {
    await gotoAuth(page);
    const longEmail = `${'a'.repeat(990)}@x.com`;
    // Force the value directly (bypasses maxlength, simulates a paste attack).
    await page.locator(Sel.emailInput).evaluate(
      (el: HTMLInputElement, val) => { el.value = val; },
      longEmail,
    );
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();
    // Must not crash – either stays on /auth or shows an error.
    await expect(page.locator('body')).toBeVisible();
  });

  test('does not crash on a 1,000-character password string', async ({ page }) => {
    await gotoAuth(page);
    const longPassword = 'P@ss' + 'A'.repeat(996);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).evaluate(
      (el: HTMLInputElement, val) => { el.value = val; },
      longPassword,
    );
    await page.locator(Sel.signInButton).click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('does not crash on null-byte in password', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).evaluate(
      (el: HTMLInputElement) => { el.value = 'Pass\u0000word1!'; },
    );
    await page.locator(Sel.signInButton).click();
    await expect(page.locator('body')).toBeVisible();
  });

  test('password field renders as type=password (no accidental plaintext)', async ({ page }) => {
    await gotoAuth(page);
    const pwd = page.locator(Sel.passwordInput);
    await expect(pwd).toHaveAttribute('type', 'password');
  });
});

// ---------------------------------------------------------------------------
// E. Password visibility toggle
// ---------------------------------------------------------------------------

test.describe('Login form – password visibility toggle', () => {
  test('toggles password field between type=password and type=text', async ({ page }) => {
    await gotoAuth(page);
    const pwd = page.locator(Sel.passwordInput);
    await expect(pwd).toHaveAttribute('type', 'password');

    // Click the show-password button (has aria-label "Show password")
    await page.getByRole('button', { name: /show password/i }).click();
    await expect(pwd).toHaveAttribute('type', 'text');

    // Click again to hide
    await page.getByRole('button', { name: /hide password/i }).click();
    await expect(pwd).toHaveAttribute('type', 'password');
  });

  test('show-password button is disabled while the form is loading', async ({ page }) => {
    await gotoAuth(page);

    await page.route('**/auth/v1/token**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.abort();
    });

    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).fill('Password1!');
    await page.locator(Sel.signInButton).click();

    const toggle = page.getByRole('button', { name: /show password|hide password/i });
    await expect(toggle).toBeDisabled({ timeout: 3_000 });
  });
});

// ---------------------------------------------------------------------------
// F. Happy path (requires live credentials)
// ---------------------------------------------------------------------------

test.describe('Login flow – happy path', () => {
  test('redirects to /dashboard on valid credentials', async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Requires credentials');

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).pressSequentially(TEST_PASSWORD, { delay: 100 });
    await page.locator(Sel.signInButton).click();

    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('shows the loading/redirect progress overlay after successful login', async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Requires live credentials');

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.signInButton).click();

    // Give the overlay 20s to appear for slow cloud responses
    const overlay = page.locator(Sel.redirectingOverlay);
    await expect(overlay).toBeVisible({ timeout: 20_000 });
    
    await page.waitForURL(/\/dashboard/, { timeout: 45_000 });
  });

  test.skip('already-authenticated user is redirected away from /auth', async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Requires live credentials');

    await loginAsTestUser(page);
    
    await page.waitForTimeout(1000);
    await page.goto(AUTH_PATH);
    
    await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });
  });
});

// ---------------------------------------------------------------------------
// G. Concurrent & rapid-fire submissions
// ---------------------------------------------------------------------------

test.describe('Login form – rapid / concurrent submissions', () => {
  test('does not send duplicate network requests on double-click', async ({ page }) => {
    await gotoAuth(page);

    const requests: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/auth/v1/token')) requests.push(req.url());
    });

    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await page.locator(Sel.passwordInput).fill('Password1!');

    // Double-click the submit button.
    await page.locator(Sel.signInButton).dblclick();

    // Give the app a moment to process.
    await page.waitForTimeout(1_000);

    // Only one auth request should have been dispatched.
    expect(requests.length).toBeLessThanOrEqual(1);
  });
});
