import { test, expect } from '@playwright/test';

// Ecosistema: Constella disponible y tres productos anunciados, cada uno
// con su pagina provisional. El sitio vive en '/', no bajo baseURL.

const SOON = [
  { slug: 'routes', name: 'Routes' },
  { slug: 'templates', name: 'Templates' },
  { slug: 'circle', name: 'Circle' },
];

test('the site menu links every section and the engine', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav.site-nav');
  await expect(nav).toBeVisible();
  for (const hash of ['#working-memory', '#tools-trap', '#precedence-lock', '#ecosystem', '#about']) {
    await expect(nav.locator(`a[href="${hash}"]`)).toHaveCount(1);
  }
  await expect(nav.locator('a[href="app/"]')).toHaveCount(1);
});

test('the ecosystem shows Constella available and three coming-soon products', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#ecosystem .hub-card')).toHaveCount(4);
  const constella = page.locator('#hub-card-constella');
  await expect(constella).toHaveAttribute('href', 'app/');
  await expect(constella).toContainText('Constella Engine');
  await expect(constella).toContainText('Launch engine');
  const soon = page.locator('#ecosystem .hub-card--soon');
  await expect(soon).toHaveCount(3);
  for (let i = 0; i < 3; i++) await expect(soon.nth(i)).toContainText('Coming soon');
});

for (const { slug, name } of SOON) {
  test(`${name} placeholder: loads, explains itself and links back`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await page.click(`#hub-card-${slug}`);
    await page.waitForURL(`**/${slug}/`);
    await expect(page.locator('h1')).toHaveText(name);
    await expect(page.locator('#placeholder')).toContainText(/coming soon/i);
    const h1Font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).toContain('Oswald');

    await page.click('text=Back to the ecosystem');
    await page.waitForURL((url) => url.pathname === '/');
    expect(errors).toHaveLength(0);
  });
}

test('placeholders lead to Constella with a single primary button', async ({ page }) => {
  for (const { slug } of SOON) {
    await page.goto(`/${slug}/`);
    const primary = page.locator('#placeholder .btn--primary');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAttribute('href', '../app/');
  }
});
