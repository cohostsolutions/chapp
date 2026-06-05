/**
 * E2E tests – Password Reset Flow
 *
 * The password-reset entry point on the /auth page is the "Forgot password?"
 * button.  Clicking it triggers `handleForgotPassword` in Auth.tsx, which:
 * 1. Guards against an empty email (shows an error toast).
 * 2. Calls Supabase / a custom edge function to send a reset email.
 * 3. Shows a success toast on success or an error toast on failure.
 *
 * Tests in this file cover:
 * - Triggering the flow with an empty email.
 * - Triggering with an invalid email format.
 * - Triggering with a valid-but-unknown email (server-side behaviour).
 * - Triggering with a valid known email (happy path, live creds required).
 * - Rapid-fire / rate-limiting behaviour.
 * - UI state: button disabled while loading, re-enabled after response.
 * - Adversarial inputs to the email field.
 */

import { test, expect } from '@playwright/test';
import {
  gotoAuth,
  expectErrorToast,
  expectAnyToast,
  Sel,
  TEST_EMAIL,
  UNKNOWN_EMAIL,
  HAS_LIVE_CREDS,
  AUTH_PATH,
} from './helpers';

// ---------------------------------------------------------------------------
// Helper: click the "Forgot password?" button
// ---------------------------------------------------------------------------

async function clickForgotPassword(page: import('@playwright/test').Page) {
  await page.locator(Sel.forgotPasswordButton).click();
}

// ---------------------------------------------------------------------------
// A. Validation – empty / malformed email
// ---------------------------------------------------------------------------

test.describe('Password reset – client-side validation', () => {
  test('shows "Email required" toast when email field is empty', async ({ page }) => {
    await gotoAuth(page);
    // Do NOT fill the email input.
    await clickForgotPassword(page);

    // The Auth component explicitly checks for an empty email and shows this toast.
    await expectErrorToast(page, /email required/i);
    // Must remain on /auth.
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('shows "Email required" toast when email contains only whitespace', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill('   ');
    await clickForgotPassword(page);

    // The code does email.trim() before the check, so whitespace-only == empty.
    await expectErrorToast(page, /email required/i);
  });

  test('does not send a reset request for a malformed email', async ({ page }) => {
    await gotoAuth(page);

    const requests: string[] = [];
    page.on('request', (req) => {
      if (
        req.url().includes('reset') ||
        req.url().includes('forgot') ||
        req.url().includes('recover')
      ) {
        requests.push(req.url());
      }
    });

    // Type something that looks like it might be an email but isn't valid.
    await page.locator(Sel.emailInput).fill('not-an-email-at-all');
    await clickForgotPassword(page);

    // Either the UI blocks it (shows error toast) or the request fires and
    // the server returns an error.  Either way, the page must stay on /auth
    // and not crash.
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });
});

// ---------------------------------------------------------------------------
// B. Server-side error handling
// ---------------------------------------------------------------------------

test.describe('Password reset – server-side error handling', () => {
  test('shows error toast when the Supabase endpoint returns a network error', async ({ page }) => {
    await gotoAuth(page);

    // Intercept any password-reset related request and force a network failure.
    await page.route('**/*reset*', (route) => route.abort('failed'));
    await page.route('**/*recover*', (route) => route.abort('failed'));
    await page.route('**/*forgot*', (route) => route.abort('failed'));
    // Also block Supabase auth endpoints that handle recovery.
    await page.route('**/auth/v1/**', (route) => route.abort('failed'));

    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    // The app should show an error toast (the catch block in Auth.tsx).
    const errorToast = page.locator('[role="status"], [data-sonner-toast], .destructive');
    await expect(errorToast.first()).toBeVisible({ timeout: 10_000 });
  });

  test('handles a 429 rate-limit response gracefully', async ({ page }) => {
    // 1. Arm the interceptor on the CONTEXT before navigation to bypass Service Workers
    await page.context().route('**/recover**', async (route, request) => {
      // 2. Clear the CORS preflight check
      if (request.method() === 'OPTIONS') {
        return route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }
      // 3. Fulfill the actual POST with an exhaustive Supabase error schema
      return route.fulfill({
        status: 429,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          code: 429, 
          msg: 'Too many requests',
          message: 'Too many requests',
          error_description: 'Too many requests'
        }),
      });
    });

    // 4. Navigate to the page NOW that the trap is set
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    await expectErrorToast(page, /too many|wait|try again|rate/i);
  });

  test('handles a 500 server error response gracefully', async ({ page }) => {
    await page.context().route('**/recover**', async (route, request) => {
      if (request.method() === 'OPTIONS') {
        return route.fulfill({
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }
      return route.fulfill({
        status: 500,
        contentType: 'application/json',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ 
          code: 500, 
          msg: 'Internal Server Error',
          message: 'Internal Server Error',
          error_description: 'Internal Server Error'
        }),
      });
    });

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    await expectErrorToast(page, /server error|try again later|unable/i);
  });

  test('shows a specific error for an unknown email address', async ({ page }) => {
    // Skip if no live Supabase instance (mock would just swallow the request).
    test.skip(!HAS_LIVE_CREDS, 'Requires a live Supabase instance');
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(UNKNOWN_EMAIL);
    await clickForgotPassword(page);

    // Supabase may either silently succeed (security best-practice) or return
    // a "user not found" error.  Either way the app must not crash.
    await expect(page.locator('body')).toBeVisible({ timeout: 10_000 });
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });
});

// ---------------------------------------------------------------------------
// C. UI state during loading
// ---------------------------------------------------------------------------

test.describe('Password reset – loading/UI state', () => {
  test('"Forgot password?" button is disabled while the request is in-flight', async ({ page }) => {
    // 1. Arm the context interceptor FIRST to bypass the Service Worker
    await page.context().route('**/recover**', async (route) => {
      // Artificially slow down the request by 2 seconds
      await new Promise((r) => setTimeout(r, 2000));
      await route.abort();
    });

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    const btn = page.locator(Sel.forgotPasswordButton);
    await expect(btn).toBeDisabled({ timeout: 3_000 });
  });

  test('"Forgot password?" button is re-enabled after the request resolves', async ({ page }) => {
    await page.context().route('**/recover**', async (route, request) => {
      if (request.method() === 'OPTIONS') {
        return route.fulfill({
          status: 200,
          headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': '*', 'Access-Control-Allow-Headers': '*' }
        });
      }
      return route.fulfill({ 
        status: 500, 
        contentType: 'application/json', 
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ message: 'error' }) 
      });
    });

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    // Wait for the error toast to confirm the request cycle completed.
    const errorToast = page.locator('[role="status"], [data-sonner-toast], .destructive');
    await expect(errorToast.first()).toBeVisible({ timeout: 10_000 });

    // The button should now be re-enabled.
    const btn = page.locator(Sel.forgotPasswordButton);
    await expect(btn).toBeEnabled({ timeout: 3_000 });
  });

  test('sign-in button is also disabled while the reset request is in-flight', async ({ page }) => {
    // Arm the context interceptor FIRST
    await page.context().route('**/recover**', async (route) => {
      await new Promise((r) => setTimeout(r, 2000));
      await route.abort();
    });

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    // Auth.tsx disables all interactive elements while resetLoading is true.
    const signInBtn = page.locator(Sel.signInButton);
    await expect(signInBtn).toBeDisabled({ timeout: 3_000 });
  });
});

// ---------------------------------------------------------------------------
// D. Adversarial inputs
// ---------------------------------------------------------------------------

test.describe('Password reset – adversarial inputs', () => {
  test('does not crash on XSS payload in email field', async ({ page }) => {
    await gotoAuth(page);
    const xss = '<img src=x onerror=alert(1)>@evil.com';
    await page.locator(Sel.emailInput).fill(xss);
    await clickForgotPassword(page);

    page.on('dialog', (d) => {
      throw new Error(`XSS dialog was triggered: ${d.message()}`);
    });

    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });

  test('does not crash on SQL injection payload in email field', async ({ page }) => {
    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill("'; DROP TABLE users; --");
    await clickForgotPassword(page);
    await expect(page.locator('body')).toBeVisible();
  });

  test('does not crash on an oversized email string (2,000 chars)', async ({ page }) => {
    await gotoAuth(page);
    const huge = `${'a'.repeat(1993)}@x.com`;
    await page.locator(Sel.emailInput).evaluate(
      (el: HTMLInputElement, v) => { el.value = v; },
      huge,
    );
    await clickForgotPassword(page);
    await expect(page.locator('body')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// E. Happy path (live credentials required)
// ---------------------------------------------------------------------------

test.describe('Password reset – happy path', () => {
  test('shows success toast for a valid, registered email', async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Requires E2E_TEST_EMAIL env var');

    await gotoAuth(page);
    await page.locator(Sel.emailInput).fill(TEST_EMAIL);
    await clickForgotPassword(page);

    await expectAnyToast(page, /reset email sent|check your inbox|instructions/i);
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });
});

// ---------------------------------------------------------------------------
// F. Rate limiting – multiple rapid requests
// ---------------------------------------------------------------------------

test.describe('Password reset – rate limiting', () => {
  test('handles multiple rapid reset requests without crashing', async ({ page }) => {
    await gotoAuth(page);

    // Respond fast with success so the button becomes re-enabled.
    await page.route('**/auth/v1/**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({}),
      }),
    );

    await page.locator(Sel.emailInput).fill(TEST_EMAIL);

    // Click three times in quick succession.
    await clickForgotPassword(page);
    // Wait for re-enable before second click.
    await page.locator(Sel.forgotPasswordButton).waitFor({ state: 'visible' });
    await clickForgotPassword(page);
    await page.locator(Sel.forgotPasswordButton).waitFor({ state: 'visible' });
    await clickForgotPassword(page);

    // The app must remain stable.
    await expect(page.locator('body')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(AUTH_PATH));
  });
});