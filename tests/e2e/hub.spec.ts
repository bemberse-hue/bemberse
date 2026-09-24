import { test, expect } from '@playwright/test';

// Hub de productividad: Constella disponible y tres productos anunciados
// con su pagina provisional. El sitio vive en '/', no bajo baseURL.

const SOON = [
  { slug: 'rutas', name: 'Rutas' },
  { slug: 'plantillas', name: 'Plantillas' },
  { slug: 'circulo', name: 'Círculo' },
];

test('el menu del sitio enlaza las secciones, el hub y el motor', async ({ page }) => {
  await page.goto('/');
  const nav = page.locator('nav.site-nav');
  await expect(nav).toBeVisible();
  for (const hash of ['#dolor', '#como-funciona', '#hub', '#quienes-somos']) {
    await expect(nav.locator(`a[href="${hash}"]`)).toHaveCount(1);
  }
  await expect(nav.locator('a[href="app/"]')).toHaveCount(1);
});

test('el hub muestra Constella disponible y tres productos proximamente', async ({ page }) => {
  await page.goto('/');
  const cards = page.locator('#hub .hub-card');
  await expect(cards).toHaveCount(4);
  await expect(page.locator('#hub-card-constella')).toHaveAttribute('href', 'app/');
  await expect(page.locator('#hub .hub-card--soon')).toHaveCount(3);
});

for (const { slug, name } of SOON) {
  test(`placeholder de ${name}: carga, se explica y lleva de vuelta`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    await page.goto('/');
    await page.click(`#hub-card-${slug}`);
    await page.waitForURL(`**/${slug}/`);
    await expect(page.locator('h1')).toHaveText(name);
    await expect(page.locator('#placeholder')).toContainText('EN CONSTRUCCIÓN');
    const h1Font = await page.locator('h1').evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).toContain('Oswald');

    await page.click('text=Volver al hub');
    await page.waitForURL((url) => url.pathname === '/');
    expect(errors).toHaveLength(0);
  });
}

test('los placeholders llevan a Constella con un unico boton primario', async ({ page }) => {
  for (const { slug } of SOON) {
    await page.goto(`/${slug}/`);
    const primary = page.locator('#placeholder .btn--primary');
    await expect(primary).toHaveCount(1);
    await expect(primary).toHaveAttribute('href', '../app/');
  }
});
