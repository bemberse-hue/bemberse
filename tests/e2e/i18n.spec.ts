import { test, expect, type Page } from '@playwright/test';

// Sitio bilingue: ingles en '/', espanol en '/es/'. Mismo embudo, mismo
// motor, mismo mapa guardado; solo cambia el idioma.
const ORIGIN = 'http://localhost:5173';

async function freshEs(page: Page): Promise<void> {
  await page.goto(`${ORIGIN}/es/`);
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
}

test('the Spanish site renders the whole funnel in Spanish', async ({ page }) => {
  await freshEs(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('#hero h1')).toContainText('Tienes 30 ideas atrapadas en la cabeza');
  await expect(page.locator('#hero .grad-text')).toHaveText('saturado.');
  await expect(page.locator('#check .check__q').first()).toHaveText('¿Tienes más de 10 cosas en la cabeza ahora mismo?');
  await expect(page.locator('#working-memory')).toContainText('¿Qué hago primero?');
  await expect(page.locator('#precedence-lock')).toContainText('si B necesita de A, B queda bajo candado estricto');
  await expect(page.locator('#start #btn-copy-prompt')).toHaveText('Copiar prompt para tu IA');
  await expect(page.locator('#ecosystem .hub-card')).toHaveCount(4);
  const order = await page.$$eval('#app > section', (els) => els.map((e) => e.id));
  expect(order).toEqual(['hero', 'check', 'working-memory', 'tools-trap', 'precedence-lock', 'start', 'ecosystem', 'about']);
});

test('the Spanish self-check answers in Spanish', async ({ page }) => {
  await freshEs(page);
  const items = page.locator('#check .check__item');
  for (let i = 0; i < 4; i++) await items.nth(i).locator('[data-answer="yes"]').click();
  await expect(page.locator('#check-result')).toContainText('4 de 4. No es pereza: es un búfer lleno.');
});

test('the Spanish precedence-lock diagram is in Spanish', async ({ page }) => {
  await page.goto(`${ORIGIN}/es/`);
  const texts = await page.$$eval('#precedence-lock .site-diagram svg text', (ts) => ts.map((t) => t.textContent));
  expect(texts).toEqual(['Tarea A', 'ACTIVA', 'Tarea B', 'BLOQUEADA', 'Tarea C', 'BLOQUEADA']);
});

test('the EN | ES switch goes to the counterpart page and keeps the section', async ({ page }) => {
  await page.goto(`${ORIGIN}/#tools-trap`);
  await page.click('.site-nav a.lang-switch');
  await page.waitForURL(`${ORIGIN}/es/#tools-trap`);
  await expect(page.locator('#tools-trap h2')).toHaveText('La trampa de Notion y las listas de pendientes.');

  await page.click('.site-nav a.lang-switch');
  await page.waitForURL(`${ORIGIN}/#tools-trap`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
});

test('a preset from the Spanish site opens the Spanish engine with Spanish tasks', async ({ page }) => {
  await freshEs(page);
  await page.click('#start #preset-break-the-freeze');
  await page.waitForURL(`${ORIGIN}/es/app/`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'es');
  await expect(page.locator('.nodes-layer .node')).toHaveCount(11);
  await expect(page.locator('#hud-status')).toHaveText(/^\d+ tareas · \d+ desbloqueadas · \d+ bloqueadas · 0 hechas$/);
  await expect(page.locator('#btn-view-graph')).toHaveText('Red');
  await expect(page.locator('.node--next title')).toHaveText(/[áéíóúñ]|Escribir|Tomar|Dejar|Despejar/);
});

test('the Spanish engine speaks Spanish: locked notice, ingest errors, execution mode', async ({ page }) => {
  await page.goto(`${ORIGIN}/es/app/`);
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
  await expect(page.locator('#ingest')).not.toHaveClass(/hidden/);
  await expect(page.locator('#ingest-text')).toHaveAttribute('placeholder', 'Vuelca todo lo que tienes en la cabeza. Sin orden. Sin formato.');

  await page.fill('#import-text', '{ "version": "1.0", "nodes": [] }');
  await page.click('#btn-do-import');
  await expect(page.locator('#import-error')).toContainText('Falta "edges"');

  await page.click('#preset-product-launch');
  await page.waitForTimeout(2500);
  await page.locator('.node--locked .node__dot').first().click({ force: true });
  await expect(page.locator('#toast')).toHaveText(/^Bloqueada: primero completa “.+”\.$/);

  await page.keyboard.press('Space');
  await expect(page.locator('#cockpit')).toContainText('Pulsa Espacio para completarla');
  await page.keyboard.press('Space');
  await expect(page.locator('#hud-status')).toContainText('1 hechas');
});

test('the map is shared across languages: switching keeps it and its progress', async ({ page }) => {
  await freshEs(page);
  await page.click('#start #preset-chaotic-week');
  await page.waitForURL(`${ORIGIN}/es/app/`);
  await page.keyboard.press('Space');
  await page.keyboard.press('Space');
  await expect(page.locator('#hud-status')).toContainText('1 hechas');

  await page.click('#hud a.lang-switch');
  await page.waitForURL(`${ORIGIN}/app/`);
  await expect(page.locator('#hud-status')).toContainText('1 done');
  await expect(page.locator('.nodes-layer .node')).toHaveCount(14);
});

test.describe('language offer', () => {
  test.use({ locale: 'es-ES' });

  test('a Spanish browser on the English site gets a discreet offer, in Spanish, never a redirect', async ({ page }) => {
    await page.goto(`${ORIGIN}/`);
    expect(new URL(page.url()).pathname).toBe('/');
    const offer = page.locator('#lang-offer');
    await expect(offer).toBeVisible();
    await expect(offer).toContainText('¿Prefieres español?');
    await expect(offer.locator('a')).toHaveAttribute('href', 'es/');

    await offer.locator('button').click();
    await expect(offer).toHaveCount(0);
    await page.reload();
    await expect(page.locator('#lang-offer')).toHaveCount(0);
  });

  test('no offer on the Spanish site for a Spanish browser', async ({ page }) => {
    await page.goto(`${ORIGIN}/es/`);
    await expect(page.locator('#lang-offer')).toHaveCount(0);
  });
});

test('on a phone, the Spanish HUD fits: no control spills past the screen edge', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 780 });
  await page.goto(`${ORIGIN}/es/app/`);
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
  await page.click('#preset-product-launch');
  const rights = await page.$$eval('#hud .hud__bar > *, #hud .hud__actions > *', (els) =>
    els.map((el) => el.getBoundingClientRect().right),
  );
  for (const r of rights) expect(r).toBeLessThanOrEqual(360);
});
