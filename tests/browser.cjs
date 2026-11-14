const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox'],
  });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/npm/@supabase/**', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: require('node:fs').readFileSync(
        'tests/fixtures/supabase-mock.js',
        'utf8',
      ),
    }),
  );
  await page.route('https://cdn.jsdelivr.net/npm/chart.js/**', (r) =>
    r.fulfill({
      contentType: 'application/javascript',
      body: 'window.Chart=class {destroy(){}};',
    }),
  );
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:4173');
  await page.waitForFunction(() =>
    document
      .querySelector('#reg-body')
      .textContent.includes('Existing Learner'),
  );
  await page.selectOption('#academic-year', '2027');
  await page.waitForFunction(
    () =>
      document.querySelector('#year-message').textContent ===
      '2027 register loaded',
  );
  assert.equal(await page.locator('#reg-body tr').count(), 0);
  await page.locator('summary').click();
  await page.fill('#learner-name', 'New Learner');
  await page.locator('#learner-form button').click();
  await page.waitForFunction(() =>
    document.querySelector('#reg-body').textContent.includes('New Learner'),
  );
  await page.setInputFiles('#learner-file', {
    name: 'learners.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      "Full Name\nAlice Test\nAlice Test\nNew Learner\n<bad>\nAnne O'Neil",
    ),
  });
  await page.waitForFunction(() =>
    document
      .querySelector('#learner-message')
      .textContent.includes('2 ready; 3 skipped'),
  );
  await page.click('#import-confirm');
  await page.waitForFunction(() =>
    document
      .querySelector('#learner-message')
      .textContent.includes('2 learners added'),
  );
  assert.equal(await page.locator('#reg-body tr').count(), 3);
  await page.selectOption('#academic-year', '2026');
  await page.waitForFunction(
    () =>
      document.querySelector('#year-message').textContent ===
      '2026 register loaded',
  );
  assert.equal(await page.locator('#reg-body tr').count(), 1);
  await page.selectOption('#academic-year', '2027');
  await page.waitForFunction(
    () =>
      document.querySelector('#year-message').textContent ===
      '2027 register loaded',
  );
  assert.equal(await page.locator('#reg-body tr').count(), 3);
  await page.locator('.tab').nth(1).click();
  assert.equal(await page.locator('#reg-body tr').count(), 0);
  await page.setViewportSize({ width: 390, height: 844 });

  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    'mobile overflow',
  );
  assert.deepEqual(errors, []);
  console.log(
    'PASS: year isolation, single add, CSV preview/import, duplicates, invalid rows, centre isolation, mobile width, no browser errors',
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
