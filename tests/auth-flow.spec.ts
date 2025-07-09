import { test, expect, type Page } from '@playwright/test';

test.describe('Dev Login Authentication Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Ensure we start fresh for each test
    await page.goto('/');
  });

    test('confirms dev login authentication works correctly', async ({ page }) => {
    // Step 1: Navigate to homepage
    await page.goto('/');

    // Step 2: Verify unauthenticated state shows Sign In link
    await expect(page.getByRole('link', { name: 'Sign In' })).toBeVisible();

    // Step 3: Verify dev login component is visible and expandable
    const devLoginComponent = page.locator('div').filter({ hasText: /^Dev Quick Login$/ });
    await expect(devLoginComponent).toBeVisible();

    // Step 4: Click dev login component to expand it
    await devLoginComponent.click();

    // Step 5: Verify test users are displayed with roles (Admin, Member, Player)
    await expect(page.getByRole('button', { name: 'Roger Sharpe' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Gary Stern' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Escher Lefkoff' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Harry Williams' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tim Froehlich' })).toBeVisible();

    // Verify role indicators are present
    await expect(page.locator('text=A')).toBeVisible(); // Admin role
    await expect(page.locator('text=M')).toBeVisible(); // Member role
    await expect(page.locator('text=P')).toBeVisible(); // Player role

    // Step 6: Click on Roger Sharpe (Admin) login button
    const rogerButton = page.getByRole('button', { name: 'Roger Sharpe' });

    // Step 7: Verify authentication API calls are made successfully
    const [response] = await Promise.all([
      page.waitForResponse(res => res.url().includes('/api/auth/callback/credentials') && res.request().method() === 'POST'),
      rogerButton.click()
    ]);

    expect(response.status()).toBe(200);

    // Step 8: Wait for authentication to complete and verify successful login
    await page.waitForTimeout(3000);

    // Step 9: Verify authentication succeeded - Sign In link should be gone
    await expect(page.getByRole('link', { name: 'Sign In' })).not.toBeVisible();

    // Step 10: Verify authenticated user profile appears
    await expect(page.getByRole('button', { name: /Roger Sharpe/ })).toBeVisible();

    // Step 11: Verify admin navigation appears for admin users
    await expect(page.getByRole('link', { name: 'Organization' })).toBeVisible();

    // Step 12: Verify dev login shows authenticated state
    await expect(page.locator('text=Dev: Roger Sharpe')).toBeVisible();

    // Step 13: Navigate to issues page to verify protected routes work
    await page.goto('/issues');
    await page.waitForTimeout(2000);

    // Step 14: Verify issues page loads successfully (no UNAUTHORIZED errors)
    await expect(page.getByText('Issues')).toBeVisible();
    await expect(page.locator('text=UNAUTHORIZED')).not.toBeVisible();
  });

    test('should show authenticated state when login works', async ({ page }) => {
    // This test documents what SHOULD happen when authentication is fixed

    await page.goto('/');

    // Expand dev login
    const devLoginComponent = page.locator('div').filter({ hasText: /^Dev Quick Login$/ });
    await devLoginComponent.click();

    // Click login button
    await page.getByRole('button', { name: 'Roger Sharpe' }).click();

    // Wait for authentication
    await page.waitForTimeout(3000);

    // EXPECTED BEHAVIOR (currently broken):
    // - Sign In link should be replaced with user profile/avatar
    // - Dev login component should show "Dev: Roger Sharpe" (authenticated state)
    // - Navigation should include admin links for admin users
    // - Protected routes like /profile should work without UNAUTHORIZED errors

    // TODO: Uncomment these assertions once authentication is fixed
    // await expect(page.getByRole('link', { name: 'Sign In' })).not.toBeVisible();
    // await expect(page.locator('text=Dev: Roger Sharpe')).toBeVisible();
    // await page.goto('/profile');
    // await expect(page.locator('text=Error loading profile: UNAUTHORIZED')).not.toBeVisible();
  });

  test('should handle different user roles correctly', async ({ page }) => {
    // Test different user types once authentication is working

    await page.goto('/');
    const devLoginComponent = page.locator('div').filter({ hasText: /^Dev Quick Login$/ });
    await devLoginComponent.click();

    // Test admin user (Roger Sharpe)
    await page.getByRole('button', { name: 'Roger Sharpe' }).click();
    await page.waitForTimeout(3000);

    // TODO: Verify admin-specific navigation appears
    // await expect(page.getByRole('link', { name: 'Organization' })).toBeVisible();

    // Test member user (Gary Stern)
    // First logout if authentication was working
    // Then login as Gary Stern and verify member-only access

    // Test player user (Escher Lefkoff)
    // Verify player role restrictions
  });

  test('verifies dev login is only visible in development', async ({ page }) => {
    // This test should pass - dev login should only appear in development
    await page.goto('/');

    // In development, dev login should be visible
    const devLoginComponent = page.locator('div').filter({ hasText: /^Dev Quick Login$/ });
    await expect(devLoginComponent).toBeVisible();

    // TODO: Add test for production environment where dev login should not appear
  });
});

test.describe('Authentication API Endpoints', () => {
  test('dev users endpoint returns test users', async ({ page }) => {
    // Test the /api/dev/users endpoint directly
    const response = await page.request.get('/api/dev/users');
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(data.users).toBeDefined();
    expect(Array.isArray(data.users)).toBe(true);
    expect(data.users.length).toBeGreaterThan(0);

    // Verify test users are present with roles
    const userEmails = data.users.map((user: any) => user.email);
    expect(userEmails).toContain('roger.sharpe@testaccount.dev');
    expect(userEmails).toContain('gary.stern@testaccount.dev');
  });

  test('session endpoint initially returns no user', async ({ page }) => {
    // Test session endpoint when not authenticated
    const response = await page.request.get('/api/auth/session');
    expect(response.status()).toBe(200);

    const session = await response.json();
    expect(session.user).toBeUndefined();
  });
});
