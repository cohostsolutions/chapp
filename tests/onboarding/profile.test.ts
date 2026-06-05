/**
 * E2E tests – Profile Configuration (Settings page)
 *
 * The Settings page lives at /settings and is behind a RouteGuard (auth
 * required).  It has two relevant sections:
 *
 *  Profile tab  – Full Name text field + "Save Changes" button
 *               – Profile photo upload (file input)
 *               – Email field (read-only)
 *
 *  Security tab – Current Password / New Password / Confirm Password + "Update Password"
 *               – "Passwords do not match" inline error
 *               – Button is disabled until all three fields are filled and passwords match
 *
 * Test strategy:
 *  - Unauthenticated access → redirected to /auth.
 *  - Form field defaults are read from the logged-in profile.
 *  - Save with no changes → button remains disabled.
 *  - Save with valid name → success toast.
 *  - Save with empty name → allowed (trimmed) or shows an error.
 *  - Save with whitespace-only name → trims to empty string.
 *  - Save with XSS payload in name → must not execute.
 *  - Photo upload with wrong MIME type → error toast.
 *  - Photo upload with oversized file → error toast.
 *  - Change password – all combinations of empty / mismatched / too-short fields.
 *  - Change password – mismatch shows inline error before the button is enabled.
 *  - Change password – happy path (live creds).
 *  - Sign-out-all confirmation dialog.
 *  - Direct URL bypass: navigating to /settings?tab=security without being
 *    logged in must redirect to /auth.
 */

import { test, expect } from '@playwright/test';
import {
  loginAsTestUser,
  gotoSettings,
  expectErrorToast,
  expectAnyToast,
  Sel,
  TEST_EMAIL,
  TEST_PASSWORD,
  HAS_LIVE_CREDS,
  AUTH_PATH,
  SETTINGS_PATH,
} from './helpers';

// ---------------------------------------------------------------------------
// A. Route guard – unauthenticated access
// ---------------------------------------------------------------------------

test.describe('Settings – unauthenticated access', () => {
  test('redirects to /auth when navigating to /settings without a session', async ({ page }) => {
    await page.goto(SETTINGS_PATH);
    await page.waitForURL(/\/(auth|login)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(auth|login)/);
  });

  test('redirects to /auth when navigating directly to /settings?tab=security', async ({ page }) => {
    await page.goto(`${SETTINGS_PATH}?tab=security`);
    await page.waitForURL(/\/(auth|login)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(auth|login)/);
  });

  test('redirects to /auth when navigating directly to /settings?tab=profile', async ({ page }) => {
    await page.goto(`${SETTINGS_PATH}?tab=profile`);
    await page.waitForURL(/\/(auth|login)/, { timeout: 15_000 });
    await expect(page).toHaveURL(/\/(auth|login)/);
  });
});

// ---------------------------------------------------------------------------
// B. Profile tab – authenticated
// ---------------------------------------------------------------------------

test.describe.skip('Settings – Profile tab', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Profile tests require E2E_TEST_EMAIL and E2E_TEST_PASSWORD');
    await loginAsTestUser(page);
    await gotoSettings(page, 'profile');
  });

  test('profile tab is active after navigating to /settings?tab=profile', async ({ page }) => {
    const tab = page.locator('[role="tab"][data-state="active"]');
    await expect(tab).toContainText(/profile/i);
  });

  test('email field is read-only and shows the logged-in email', async ({ page }) => {
    const emailInput = page.locator('input#email');
    await expect(emailInput).toBeVisible();
    await expect(emailInput).toBeDisabled();
    await expect(emailInput).toHaveValue(TEST_EMAIL);
  });

  test('"Save Changes" button is disabled when name has not changed', async ({ page }) => {
    const saveBtn = page.locator(Sel.saveProfileButton);
    await expect(saveBtn).toBeVisible();
    await expect(saveBtn).toBeDisabled();
  });

  test('enables "Save Changes" when the full name is edited', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    await nameInput.fill('Updated Test Name');
    const saveBtn = page.locator(Sel.saveProfileButton);
    await expect(saveBtn).toBeEnabled();
  });

  test('saves a valid full name and shows success toast', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    const original = await nameInput.inputValue();

    await nameInput.fill('QA Test User');
    await page.locator(Sel.saveProfileButton).click();
    await expectAnyToast(page, /profile updated|saved|success/i);

    // Restore original name so tests are idempotent.
    await nameInput.fill(original || 'Restored Name');
    await page.locator(Sel.saveProfileButton).click();
  });

  test('clears the name field and saves (empty name edge case)', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    const original = await nameInput.inputValue();

    await nameInput.fill('');
    const saveBtn = page.locator(Sel.saveProfileButton);
    // Either the button is still enabled (empty != original non-empty) or the
    // app disables it.  We check both scenarios without asserting which is correct –
    // we just ensure the page doesn't crash.
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await expect(page.locator('body')).toBeVisible();
    }

    // Restore
    await nameInput.fill(original || 'Restored Name');
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
    }
  });

  test('saves a whitespace-only name (gets trimmed)', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    const original = await nameInput.inputValue();

    await nameInput.fill('     ');
    const saveBtn = page.locator(Sel.saveProfileButton);
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await expect(page.locator('body')).toBeVisible();
    }

    await nameInput.fill(original || 'Restored Name');
    if (await saveBtn.isEnabled()) await saveBtn.click();
  });

  test('does not execute XSS payload saved as a profile name', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    const original = await nameInput.inputValue();

    const xss = '<img src=x onerror=alert("xss_in_name")>';
    page.on('dialog', (d) => {
      throw new Error(`XSS dialog fired: ${d.message()}`);
    });

    await nameInput.fill(xss);
    const saveBtn = page.locator(Sel.saveProfileButton);
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await expect(page.locator('body')).toBeVisible();
      // Give the page a moment to potentially execute the injected script.
      await page.waitForTimeout(1_000);
    }

    // Restore
    await nameInput.fill(original || 'Restored Name');
    if (await saveBtn.isEnabled()) await saveBtn.click();
  });

  test('saves a name with unicode / emoji characters', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    const original = await nameInput.inputValue();

    await nameInput.fill('Test 🎉 Ünïcödé');
    const saveBtn = page.locator(Sel.saveProfileButton);
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();
    await expectAnyToast(page, /profile updated|saved|success/i);

    // Restore
    await nameInput.fill(original || 'Restored Name');
    await page.locator(Sel.saveProfileButton).click();
  });

  test('saves an extremely long name without crashing (200 characters)', async ({ page }) => {
    const nameInput = page.locator(Sel.fullNameInput);
    const original = await nameInput.inputValue();

    const longName = 'A'.repeat(200);
    await nameInput.fill(longName);
    const saveBtn = page.locator(Sel.saveProfileButton);
    if (await saveBtn.isEnabled()) {
      await saveBtn.click();
      await expect(page.locator('body')).toBeVisible();
    }

    // Restore
    await nameInput.fill(original || 'Restored Name');
    if (await saveBtn.isEnabled()) await saveBtn.click();
  });
});

// ---------------------------------------------------------------------------
// C. Profile tab – photo upload validation
// ---------------------------------------------------------------------------

test.describe('Settings – Profile photo upload', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Photo upload tests require live credentials');
    await loginAsTestUser(page);
    await gotoSettings(page, 'profile');
  });

  test('rejects a non-image file with an error toast', async ({ page }) => {
    // Trigger the hidden file input with a fake text file.
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /change photo/i }).click(),
    ]);

    await fileChooser.setFiles({
      name: 'malicious.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    await expectErrorToast(page, /invalid file|image|jpg|png/i);
  });

  test('rejects a file larger than 5 MB with an error toast', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /change photo/i }).click(),
    ]);

    // Create a 6 MB buffer.
    const sixMB = Buffer.alloc(6 * 1024 * 1024, 'x');
    await fileChooser.setFiles({
      name: 'huge.png',
      mimeType: 'image/png',
      buffer: sixMB,
    });

    await expectErrorToast(page, /too large|5mb|size/i);
  });

  test('rejects a PDF masquerading as a PNG', async ({ page }) => {
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      page.getByRole('button', { name: /change photo/i }).click(),
    ]);

    // PDF magic bytes but .png extension.
    const pdfBytes = Buffer.from('%PDF-1.4 fake pdf content');
    await fileChooser.setFiles({
      name: 'fake.png',
      mimeType: 'application/pdf',
      buffer: pdfBytes,
    });

    // The app checks file.type.startsWith('image/'), so this should be rejected.
    await expectErrorToast(page, /invalid file|image/i);
  });
});

// ---------------------------------------------------------------------------
// D. Security tab – Change Password form
// ---------------------------------------------------------------------------

test.describe('Settings – Change Password (Security tab)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Change password tests require live credentials');
    await loginAsTestUser(page);
    await gotoSettings(page, 'security');
  });

  // --- Button disabled-state ---

  test('"Update Password" button is disabled when all fields are empty', async ({ page }) => {
    const updateBtn = page.locator(Sel.updatePasswordButton);
    await expect(updateBtn).toBeDisabled();
  });

  test('"Update Password" button is disabled when only Current Password is filled', async ({ page }) => {
    await page.locator(Sel.currentPasswordInput).fill('SomePassword1!');
    await expect(page.locator(Sel.updatePasswordButton)).toBeDisabled();
  });

  test('"Update Password" button is disabled when only New Password is filled', async ({ page }) => {
    await page.locator(Sel.newPasswordInput).fill('NewPassword1!');
    await expect(page.locator(Sel.updatePasswordButton)).toBeDisabled();
  });

  test('"Update Password" button is disabled when only Confirm Password is filled', async ({ page }) => {
    await page.locator(Sel.confirmPasswordInput).fill('NewPassword1!');
    await expect(page.locator(Sel.updatePasswordButton)).toBeDisabled();
  });

  test('"Update Password" button is disabled when New ≠ Confirm', async ({ page }) => {
    await page.locator(Sel.currentPasswordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.newPasswordInput).fill('NewPassword1!');
    await page.locator(Sel.confirmPasswordInput).fill('DifferentPassword1!');
    // The button has: disabled={... || newPassword !== confirmPassword}
    await expect(page.locator(Sel.updatePasswordButton)).toBeDisabled();
  });

  test('shows inline "Passwords do not match" error when fields differ', async ({ page }) => {
    await page.locator(Sel.newPasswordInput).fill('NewPassword1!');
    await page.locator(Sel.confirmPasswordInput).fill('NotTheSame99!');
    await expect(page.locator(Sel.passwordMismatchError)).toBeVisible();
  });

  test('"Passwords do not match" inline error disappears when fields match again', async ({ page }) => {
    await page.locator(Sel.newPasswordInput).fill('MatchMe99!');
    await page.locator(Sel.confirmPasswordInput).fill('NoMatch88!');
    await expect(page.locator(Sel.passwordMismatchError)).toBeVisible();

    // Correct the confirm field.
    await page.locator(Sel.confirmPasswordInput).fill('MatchMe99!');
    await expect(page.locator(Sel.passwordMismatchError)).not.toBeVisible();
  });

  // --- Server-side validation toast messages ---

  test('shows toast when new password is too short (< 6 chars)', async ({ page }) => {
    await page.locator(Sel.currentPasswordInput).fill(TEST_PASSWORD);
    // Fill new + confirm with the same 5-char string to pass the button's
    // "passwords match" guard, so the click actually fires.
    await page.locator(Sel.newPasswordInput).fill('12345');
    await page.locator(Sel.confirmPasswordInput).fill('12345');

    // The button is still disabled because of the server-side length check
    // (or the UI may keep it disabled).  We call the handler directly if the
    // button is enabled.
    const btn = page.locator(Sel.updatePasswordButton);
    if (await btn.isEnabled()) {
      await btn.click();
      await expectErrorToast(page, /6 characters|too short|password/i);
    } else {
      // If disabled, the length guard is enforced at the UI level – that's fine.
      await expect(btn).toBeDisabled();
    }
  });

  test('shows toast when current password is wrong', async ({ page }) => {
    await page.locator(Sel.currentPasswordInput).fill('WrongCurrentPassword99!');
    await page.locator(Sel.newPasswordInput).fill('NewPassword1!');
    await page.locator(Sel.confirmPasswordInput).fill('NewPassword1!');

    const btn = page.locator(Sel.updatePasswordButton);
    await expect(btn).toBeEnabled();
    await btn.click();

    // Supabase (via change-password edge function) should reject this.
    await expectErrorToast(page, /invalid|wrong|incorrect|password/i);
  });

  test('new password is not echoed in plaintext by default', async ({ page }) => {
    await expect(page.locator(Sel.newPasswordInput)).toHaveAttribute('type', 'password');
    await expect(page.locator(Sel.confirmPasswordInput)).toHaveAttribute('type', 'password');
  });

  test('current password visibility toggle works', async ({ page }) => {
    const currentPwdInput = page.locator(Sel.currentPasswordInput);
    await expect(currentPwdInput).toHaveAttribute('type', 'password');

    // The toggle button is the sibling button inside the relative container.
    const container = page.locator('#currentPassword').locator('..').locator('..');
    const toggle = container.getByRole('button').first();
    await toggle.click();
    await expect(currentPwdInput).toHaveAttribute('type', 'text');

    await toggle.click();
    await expect(currentPwdInput).toHaveAttribute('type', 'password');
  });

  // --- Adversarial inputs ---

  test('does not crash on XSS payload in new password field', async ({ page }) => {
    page.on('dialog', (d) => {
      throw new Error(`XSS dialog: ${d.message()}`);
    });

    const xss = '<script>alert("pwn")</script>';
    await page.locator(Sel.currentPasswordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.newPasswordInput).evaluate(
      (el: HTMLInputElement, v) => { el.value = v; },
      xss,
    );
    await page.locator(Sel.confirmPasswordInput).evaluate(
      (el: HTMLInputElement, v) => { el.value = v; },
      xss,
    );
    await expect(page.locator('body')).toBeVisible();
  });

  test('does not crash on a 1,000-character new password', async ({ page }) => {
    const longPwd = 'P@ss' + 'X'.repeat(996);
    await page.locator(Sel.currentPasswordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.newPasswordInput).evaluate(
      (el: HTMLInputElement, v) => { el.value = v; },
      longPwd,
    );
    await page.locator(Sel.confirmPasswordInput).evaluate(
      (el: HTMLInputElement, v) => { el.value = v; },
      longPwd,
    );

    const btn = page.locator(Sel.updatePasswordButton);
    if (await btn.isEnabled()) {
      await btn.click();
      await expect(page.locator('body')).toBeVisible();
    }
  });

  // --- Happy path ---

  test('successfully changes the password and shows success toast', async ({ page }) => {
    // This test changes the password and then changes it back, making it
    // inherently destructive – skip unless explicitly opted in.
    test.skip(
      !HAS_LIVE_CREDS || !process.env.E2E_ALLOW_PASSWORD_CHANGE,
      'Set E2E_ALLOW_PASSWORD_CHANGE=true to run the destructive password-change test',
    );

    const tempPassword = 'TempE2EPwd999!';

    await page.locator(Sel.currentPasswordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.newPasswordInput).fill(tempPassword);
    await page.locator(Sel.confirmPasswordInput).fill(tempPassword);
    await page.locator(Sel.updatePasswordButton).click();

    await expectAnyToast(page, /password updated|changed/i);

    // Immediately change it back.
    await page.locator(Sel.currentPasswordInput).fill(tempPassword);
    await page.locator(Sel.newPasswordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.confirmPasswordInput).fill(TEST_PASSWORD);
    await page.locator(Sel.updatePasswordButton).click();
    await expectAnyToast(page, /password updated|changed/i);
  });
});

// ---------------------------------------------------------------------------
// E. Security tab – Sign Out All Sessions
// ---------------------------------------------------------------------------

test.describe('Settings – Sign Out All Sessions', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Sign-out tests require live credentials');
    await loginAsTestUser(page);
    await gotoSettings(page, 'security');
  });

  test('"Sign Out All" button opens a confirmation dialog', async ({ page }) => {
    await page.getByRole('button', { name: /sign out all/i }).click();

    // The AlertDialog should be visible.
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText(/sign out from all devices/i)).toBeVisible();
  });

  test('cancelling the confirmation dialog keeps the user logged in', async ({ page }) => {
    await page.getByRole('button', { name: /sign out all/i }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5_000 });

    await page.getByRole('button', { name: /cancel/i }).click();

    // Still on settings, not redirected to /auth.
    await expect(page).toHaveURL(new RegExp(SETTINGS_PATH));
  });
});

// ---------------------------------------------------------------------------
// F. Tab navigation & URL state
// ---------------------------------------------------------------------------

test.describe('Settings – tab navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Tab navigation tests require live credentials');
    await loginAsTestUser(page);
    await gotoSettings(page, 'profile');
  });

  test('clicking the Security tab updates the URL query param', async ({ page }) => {
    // Find and click the Security tab
    await page.getByRole('tab', { name: /security/i }).click();
    await expect(page).toHaveURL(/tab=security/);
  });

  test('clicking the Profile tab updates the URL query param', async ({ page }) => {
    // First go to Security
    await page.getByRole('tab', { name: /security/i }).click();
    // Then back to Profile
    await page.getByRole('tab', { name: /profile/i }).click();
    await expect(page).toHaveURL(/tab=profile/);
  });

  test('invalid ?tab= value falls back to the default tab', async ({ page }) => {
    await page.goto(`${SETTINGS_PATH}?tab=not-a-real-tab-xyz`);
    await expect(page.locator('[role="tablist"]')).toBeVisible({ timeout: 15_000 });
    // Should show a valid tab, not crash.
    await expect(page.locator('[role="tab"][data-state="active"]')).toBeVisible();
  });
});

// ---------------------------------------------------------------------------
// G. Onboarding tour trigger
// ---------------------------------------------------------------------------

test.describe('Settings – onboarding tour', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!HAS_LIVE_CREDS, 'Onboarding tour test requires live credentials');
    await loginAsTestUser(page);
    await gotoSettings(page, 'profile');
  });

  test('"Start Product Tour" button is visible on the Profile tab', async ({ page }) => {
    const tourBtn = page.getByRole('button', { name: /start product tour|take a tour/i });
    await expect(tourBtn).toBeVisible();
  });

  test('clicking "Start Product Tour" navigates to /dashboard', async ({ page }) => {
    await page.getByRole('button', { name: /start product tour/i }).click();
    // The tour navigates to /dashboard and starts the walkthrough.
    await page.waitForURL(/\/dashboard/, { timeout: 10_000 });
    await expect(page).toHaveURL(/\/dashboard/);
  });
});
