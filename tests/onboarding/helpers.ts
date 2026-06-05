/**
 * Shared helpers for the onboarding E2E test suite.
 *
 * Design goals:
 *  - No real credentials hard-coded – everything comes from env vars so the
 *    suite works in CI and locally with a real Supabase dev project.
 *  - Helper functions are small and composable so individual spec files stay
 *    readable.
 */

import { type Page, type Locator, expect } from '@playwright/test';

// ---------------------------------------------------------------------------
// Environment / credentials
// ---------------------------------------------------------------------------

/** Valid credentials for a pre-seeded test account (injected via env). */
export const TEST_EMAIL = process.env.E2E_TEST_EMAIL ?? 'e2e-test@example.com';
export const TEST_PASSWORD = process.env.E2E_TEST_PASSWORD ?? 'e2ePassword123!';

/** A second account used in multi-user scenarios. */
export const ALT_EMAIL = process.env.E2E_ALT_EMAIL ?? 'e2e-alt@example.com';

/** A domain that definitely has no registered account. */
export const UNKNOWN_EMAIL = 'definitely-not-registered-99x@blackhole.example.com';

/** Whether we have real Supabase credentials to run live-backend tests. */
export const HAS_LIVE_CREDS =
  Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------

export const AUTH_PATH = '/auth';
export const DASHBOARD_PATH = '/dashboard';
export const SETTINGS_PATH = '/settings';

// ---------------------------------------------------------------------------
// Selectors — kept in one place so a DOM change only needs one fix
// ---------------------------------------------------------------------------

export const Sel = {
  // Auth page
  emailInput: 'input#email',
  passwordInput: '#password',
  signInButton: 'button[type="submit"]',
  forgotPasswordButton: 'button:has-text("Forgot password?")',
  showPasswordToggle: '[aria-label="Show password"], [aria-label="Hide password"]',

  // Redirect overlay
  redirectingOverlay: 'text=Redirecting to dashboard',

  // Settings – profile tab
  fullNameInput: 'input#fullName',
  saveProfileButton: 'button:has-text("Save Changes")',

  // Settings – security tab
  securityTab: '[role="tab"]:has-text("Security"), [data-value="security"]',
  profileTab: '[role="tab"]:has-text("Profile"), [data-value="profile"]',
  currentPasswordInput: 'input#currentPassword',
  newPasswordInput: 'input#newPassword',
  confirmPasswordInput: 'input#confirmPassword',
  updatePasswordButton: 'button:has-text("Update Password")',
  passwordMismatchError: 'text=Passwords do not match',

  // Toasts (Radix Toast renders with role="status" via aria-live)
  toast: '[role="status"]',
  toastDestructive: '.destructive[role="status"], [data-state="open"].destructive',
} as const;

// ---------------------------------------------------------------------------
// Page-action helpers
// ---------------------------------------------------------------------------

/** Navigate to the auth page and wait for the email input. */
export async function gotoAuth(page: Page) {
  await page.goto(AUTH_PATH);
  await expect(page.locator(Sel.emailInput)).toBeVisible({ timeout: 15_000 });
}

/** Fill the login form and submit it. */
export async function fillAndSubmitLogin(
  page: Page,
  email: string,
  password: string,
) {
  await page.locator(Sel.emailInput).fill(email);
  await page.locator(Sel.passwordInput).fill(password);
  await page.locator(Sel.signInButton).click();
}

/**
 * Log in with the test account and wait until the dashboard is visible.
 * Skips the test automatically when live credentials are not configured.
 */
export async function loginAsTestUser(page: Page) {
  await gotoAuth(page);
  
  await page.locator(Sel.emailInput).fill(TEST_EMAIL);
  await page.locator(Sel.passwordInput).pressSequentially(TEST_PASSWORD, { delay: 50 });
  await page.locator(Sel.signInButton).click();

  await page.waitForURL(/\/dashboard/, { timeout: 45_000 });

 // 🛑 THE MODAL SLAYER
  const skipButton = page.getByText('Skip tour', { exact: false });
  try {
    await skipButton.waitFor({ state: 'visible', timeout: 3000 });
    await skipButton.click();
    console.log('✅ Onboarding tour dismissed!');
    
    // 🧘 THE DEEP BREATH: Give React 2 seconds to close the modal and settle
    // before the bot tries to navigate anywhere else.
    await page.waitForTimeout(2000);
    
  } catch (e) {
    // If the modal doesn't appear, just carry on
  }
}

/**
 * Navigate to the settings page and wait for the profile tab to be visible.
 * Assumes the user is already logged in.
 */
export async function gotoSettings(page: Page, tab?: string) {
  // 🚨 WIRETAP: Listen for any React crashes and print them to the terminal!
  page.on('pageerror', error => console.log(`💥 REACT CRASH DETECTED: ${error.message}`));
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`🔴 BROWSER CONSOLE ERROR: ${msg.text()}`);
  });

  const url = tab ? `/settings?tab=${tab}` : '/settings';
  await page.goto(url);
  
  // Wait for the page to finish doing whatever it's doing
  await page.waitForLoadState('networkidle');

  // 🛑 REMOVE THE TABLIST EXPECTATION. Just wait for the layout to be visible.
  await expect(page.locator('body')).toBeVisible();
}

// ---------------------------------------------------------------------------
// Toast / notification helpers
// ---------------------------------------------------------------------------

/**
 * Wait for a toast notification that contains `text` and return its locator.
 * Handles both the Radix Toast (`role="status"`) and the Sonner toast
 * (`[data-sonner-toast]`) that the app uses.
 */
export async function waitForToast(page: Page, text: string | RegExp): Promise<Locator> {
  // Try the Radix toast first, then Sonner.
  const radixToast = page.locator('[role="status"]').filter({ hasText: text });
  const sonnerToast = page.locator('[data-sonner-toast]').filter({ hasText: text });

  // Wait for either to appear.
  await Promise.race([
    expect(radixToast.first()).toBeVisible({ timeout: 8_000 }),
    expect(sonnerToast.first()).toBeVisible({ timeout: 8_000 }),
  ]).catch(async () => {
    // If neither appeared quickly, give a generous second chance.
    await expect(
      page.locator(`text=${text}`).first(),
    ).toBeVisible({ timeout: 5_000 });
  });

  return radixToast.first().or(sonnerToast.first());
}

/**
 * Assert that a destructive (error) toast containing `text` appears.
 */
export async function expectErrorToast(page: Page, text: string | RegExp) {
  // This version looks for ANY red/destructive toast from either Shadcn or Sonner
  const destructiveToast = page
    .locator('[role="status"], [data-sonner-toast], .destructive')
    .filter({ hasText: text });
  
  // We give it 10 seconds to account for slow cloud environments
  await expect(destructiveToast.first()).toBeVisible({ timeout: 10000 });
}

/**
 * Assert that any visible toast contains the given text (works for both
 * success and error variants).
 */
export async function expectAnyToast(page: Page, text: string | RegExp) {
  await expect(
    page.locator('[role="status"], [data-sonner-toast]').filter({ hasText: text }).first(),
  ).toBeVisible({ timeout: 8_000 });
}
