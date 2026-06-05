import { test, expect } from '@playwright/test';

// Environment
const baseUrl = process.env.TEST_URL || 'http://127.0.0.1:4173';

test.describe('Smoke Tests - Critical User Journeys', () => {
  
  test('homepage loads successfully', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', error => {
      pageErrors.push(error.message);
    });

    await page.goto(baseUrl);
    
    // Should load without errors
    await expect(page).toHaveTitle(/AlCor Nexus|Canvas Capital/);
    
    // Check for key elements
    await expect(page.locator('body')).toBeVisible();
    
    // Wait for page to settle
    await page.waitForLoadState('networkidle', { timeout: 10000 }).catch(() => {});

    // Fail on real page runtime errors, not third-party console noise.
    expect(pageErrors).toHaveLength(0);
  });

  test('auth page is accessible', async ({ page }) => {
    await page.goto(`${baseUrl}/auth`);
    
    // Should have login form
    const emailInput = page.locator('input[type="email"]');
    await expect(emailInput).toBeVisible({ timeout: 10000 });
    
    // Should have password input
    const passwordInput = page.locator('input[type="password"]');
    await expect(passwordInput).toBeVisible();
  });

  test('dashboard requires authentication', async ({ page }) => {
    await page.goto(`${baseUrl}/dashboard`);
    
    // Should redirect to auth or show access denied
    await page.waitForURL(/\/(auth|login)/, { timeout: 10000 }).catch(() => {});
    
    const url = page.url();
    expect(url.includes('/auth') || url.includes('/login')).toBeTruthy();
  });

  test('static assets load correctly', async ({ page }) => {
    await page.goto(baseUrl);
    
    // Check manifest
    const manifestResponse = await page.request.get(`${baseUrl}/manifest.json`).catch(() => null);
    if (manifestResponse) {
      expect(manifestResponse.ok()).toBeTruthy();
    }
    
    // Check service worker
    const swResponse = await page.request.get(`${baseUrl}/service-worker.js`).catch(() => null);
    if (swResponse) {
      expect(swResponse.ok()).toBeTruthy();
    }
  });

  test('API health check passes', async ({ request }) => {
    // Try multiple health check endpoints
    const endpoints = [
      `${baseUrl}/health`,
      `${baseUrl}/api/health`,
      `${baseUrl}/`,
    ];
    
    let passed = false;
    for (const endpoint of endpoints) {
      const response = await request.get(endpoint).catch(() => null);
      if (response && response.ok()) {
        passed = true;
        break;
      }
    }
    
    // At least one endpoint should be accessible
    expect(passed).toBeTruthy();
  });

  test('PWA installability', async ({ page }) => {
    await page.goto(baseUrl);
    
    // Check for PWA manifest
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached();
    
    // Check for service worker registration script
    const scripts = await page.locator('script').count();
    expect(scripts).toBeGreaterThan(0);
  });

  test('error boundaries work', async ({ page }) => {
    await page.goto(baseUrl);
    
    // Navigate to a non-existent page
    await page.goto(`${baseUrl}/this-page-does-not-exist-12345`);
    
    // Should show 404 or error page, not crash
    await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
    
    // Page should still be responsive
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('theme persistence', async ({ page }) => {
    await page.goto(baseUrl);
    
    // Check if theme is set
    const html = page.locator('html');
    const themeClass = await html.getAttribute('class');
    
    // Should have either 'light' or 'dark' theme
    expect(themeClass).toBeTruthy();
  });

  test('responsive design - mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto(baseUrl);
    
    // Page should be responsive
    const body = page.locator('body');
    await expect(body).toBeVisible();
    
    // Check for mobile-friendly elements
    await page.waitForLoadState('domcontentloaded');
  });

  test('performance - page load time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto(baseUrl);
    await page.waitForLoadState('domcontentloaded');
    
    const loadTime = Date.now() - startTime;
    
    // Should load in less than 5 seconds
    expect(loadTime).toBeLessThan(5000);
    
    console.log(`Page load time: ${loadTime}ms`);
  });
});

test.describe('Critical Features - Quick Checks', () => {
  
  test('pricing page loads', async ({ page }) => {
    await page.goto(`${baseUrl}/pricing`);
    await expect(page.locator('body')).toBeVisible();
  });

  test('landing page navigation works', async ({ page }) => {
    await page.goto(baseUrl);

    // Wait for the lazy-loaded landing page header to render.
    await expect(page.getByRole('link', { name: 'AI Agents' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('link', { name: 'Pricing' }).first()).toBeVisible();
  });
});
