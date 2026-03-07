import { chromium, devices } from '@playwright/test';

const iPhone = devices['iPhone 12'];
const browser = await chromium.launch();
const context = await browser.newContext({ ...iPhone });
const page = await context.newPage();

// Login
await page.goto('http://localhost:3520/login');
await page.fill('input[name="email"]', 'member@test.com');
await page.fill('input[name="password"]', 'TestPassword123');
await page.click('button[type="submit"]');
await page.waitForURL('**/dashboard', { timeout: 10000 });

// Go directly to a known issue - find the first issue URL from DB
await page.goto('http://localhost:3520/issues');
await page.waitForLoadState('networkidle');

// Get the href of the first issue link
const href = await page.locator('a[href*="/i/"]').first().getAttribute('href');
console.log('Issue link:', href);

// Navigate directly
await page.goto(`http://localhost:3520${href}`);
await page.waitForLoadState('networkidle');
await page.waitForTimeout(1000);

// Screenshot before expanding
await page.screenshot({ path: '/tmp/issue-detail-collapsed.png', fullPage: false });

// Check overflow before expanding
let bodyWidth = await page.evaluate(() => document.body.scrollWidth);
let viewportWidth = await page.evaluate(() => window.innerWidth);
console.log(`\nBefore expand - Body: ${bodyWidth}, Viewport: ${viewportWidth}, Overflow: ${bodyWidth > viewportWidth}`);

// Click "Details" to expand the panel
const editDetailsBtn = page.locator('[data-testid="mobile-details-panel"] button:has-text("Details")');
if (await editDetailsBtn.isVisible()) {
  await editDetailsBtn.click();
  await page.waitForTimeout(500);
  
  // Screenshot after expanding
  await page.screenshot({ path: '/tmp/issue-detail-expanded.png', fullPage: false });
  await page.screenshot({ path: '/tmp/issue-detail-expanded-full.png', fullPage: true });
  
  // Check overflow after expanding
  bodyWidth = await page.evaluate(() => document.body.scrollWidth);
  viewportWidth = await page.evaluate(() => window.innerWidth);
  console.log(`After expand - Body: ${bodyWidth}, Viewport: ${viewportWidth}, Overflow: ${bodyWidth > viewportWidth}`);
  
  // Find overflowing elements
  const overflowElements = await page.evaluate(() => {
    const results = [];
    const vw = window.innerWidth;
    document.querySelectorAll('*').forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.right > vw + 1) {
        const tag = el.tagName.toLowerCase();
        const testId = el.getAttribute('data-testid') ? `[${el.getAttribute('data-testid')}]` : '';
        const cls = el.className && typeof el.className === 'string' ? `.${el.className.split(' ').slice(0, 3).join('.')}` : '';
        results.push(`${tag}${testId}${cls} → right:${Math.round(rect.right)}px overflow:${Math.round(rect.right - vw)}px w:${Math.round(rect.width)}px`);
      }
    });
    return results.slice(0, 25);
  });
  
  if (overflowElements.length > 0) {
    console.log('\nOverflowing elements:');
    overflowElements.forEach(e => console.log(`  ${e}`));
  } else {
    console.log('\nNo overflowing elements found');
  }
} else {
  console.log('Edit Details button not visible - taking screenshot anyway');
  await page.screenshot({ path: '/tmp/issue-detail-expanded.png', fullPage: true });
}

// Also screenshot the assignee row area
await page.screenshot({ path: '/tmp/issue-detail-assignee-row.png', fullPage: false });

await browser.close();
