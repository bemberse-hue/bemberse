import { test, expect } from '@playwright/test';

// El sitio vive en la raiz ('/'), pero el baseURL por defecto de este
// proyecto es '/app/' desde el paso 05 — asi que estos tests usan la URL
// completa en vez de rutas relativas a baseURL.
const SITE_URL = 'http://localhost:5173/';

const REQUIRED_SECTIONS = ['hero', 'dolor', 'por-que-fallan', 'como-funciona', 'quienes-somos', 'hub', 'cta'];

test('el sitio renderiza las 7 secciones, cada una con un encabezado visible', async ({ page }) => {
  await page.goto(SITE_URL);

  for (const id of REQUIRED_SECTIONS) {
    const section = page.locator(`#${id}`);
    await expect(section, `seccion #${id}`).toBeVisible();
    const heading = section.locator('h1, h2').first();
    await expect(heading, `encabezado de #${id}`).toBeVisible();
    await expect(heading).not.toHaveText('');
  }
});

test('el hero no pide ninguna imagen de red (el fondo es canvas, no un archivo)', async ({ page }) => {
  const imageRequests: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'image' && !req.url().endsWith('logo.png')) {
      imageRequests.push(req.url());
    }
  });

  await page.goto(SITE_URL);
  await page.waitForTimeout(500);

  expect(imageRequests, `peticiones de imagen inesperadas: ${imageRequests.join(', ')}`).toHaveLength(0);
  // El fondo animado es un <canvas>, no una imagen.
  await expect(page.locator('#landing-bg canvas')).toBeVisible();
});

test('el CTA lleva al motor y el motor arranca ahi', async ({ page }) => {
  await page.goto(SITE_URL);
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();

  await page.click('#btn-landing-start');
  await expect(page).toHaveURL(/\/app\/?$/);
  await expect(page.locator('#onboarding')).not.toHaveClass(/hidden/, { timeout: 8000 });
});

test('las secciones nombran el dolor explicitamente', async ({ page }) => {
  await page.goto(SITE_URL);

  const dolorText = (await page.locator('#dolor').innerText()).toLowerCase();
  expect(dolorText).toContain('procrastinaci');
  expect(dolorText).toContain('abrumaci');

  const porQueText = (await page.locator('#por-que-fallan').innerText()).toLowerCase();
  const mentionsTool = ['checklist', 'notion', 'sheets'].some((word) => porQueText.includes(word));
  expect(mentionsTool, 'la seccion "por-que-fallan" debe mencionar checklist, Notion o Sheets').toBe(true);
});
