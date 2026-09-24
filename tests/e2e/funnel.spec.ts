import { test, expect, type Page } from '@playwright/test';

// El embudo del sitio en un solo scroll: autochequeo de un toque y el
// volcado al final, que abre /app/ con el mapa ya dibujado.
const SITE_URL = 'http://localhost:5173/';

async function freshSite(page: Page): Promise<void> {
  await page.goto(SITE_URL);
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
}

test('self-check: four one-tap questions, a reflection line, nothing stored', async ({ page }) => {
  await freshSite(page);
  const items = page.locator('#check .check__item');
  await expect(items).toHaveCount(4);
  await expect(page.locator('#check-result')).toBeHidden();

  for (let i = 0; i < 3; i++) await items.nth(i).locator('[data-answer="yes"]').click();
  await items.nth(3).locator('[data-answer="no"]').click();

  await expect(items.nth(0).locator('[data-answer="yes"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#check-result')).toContainText('3 of 4');
  await expect(page.locator('#check-result')).toContainText('full buffer');

  // Pulsar la misma respuesta otra vez la deshace.
  await items.nth(0).locator('[data-answer="yes"]').click();
  await expect(items.nth(0).locator('[data-answer="yes"]')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#check-result')).toContainText('2 of 4');

  // Las respuestas no se guardan: nada en localStorage ni en IndexedDB.
  expect(await page.evaluate(() => localStorage.length)).toBe(0);
  await page.reload();
  await expect(page.locator('#check-result')).toBeHidden();
});

test('the answers use bone, never the accent colour', async ({ page }) => {
  await freshSite(page);
  const btn = page.locator('#check .check__item').first().locator('[data-answer="yes"]');
  await btn.click();
  await expect.poll(() => btn.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe('rgb(245, 245, 240)');
});

test('the dump lives at the end of the same scroll, with the AI prompt, the JSON box and the presets', async ({ page }) => {
  await freshSite(page);
  const start = page.locator('#start');
  await expect(start.locator('#ingest-text')).toBeVisible();
  await expect(start.locator('#btn-copy-prompt')).toBeVisible();
  await expect(start.locator('#import-text')).toBeVisible();
  await expect(start.locator('[data-preset]')).toHaveCount(3);
});

test('a preset from the site opens the engine with the map already drawn', async ({ page }) => {
  await freshSite(page);
  await page.click('#start #preset-break-the-freeze');
  await page.waitForURL(/\/app\/$/);
  await expect(page.locator('.nodes-layer .node')).toHaveCount(11);
  await expect(page.locator('#ingest')).toHaveClass(/hidden/);
});

test('the AI JSON pasted on the site opens the engine with that map', async ({ page }) => {
  await freshSite(page);
  await page.fill('#start #ingest-text', 'write the talk, book the venue');
  await page.fill('#start #import-text', JSON.stringify({
    version: '1.0',
    nodes: [
      { id: 'book-venue', title: 'Book the venue' },
      { id: 'write-talk', title: 'Write the talk' },
      { id: 'give-talk', title: 'Give the talk' },
    ],
    edges: [
      { from: 'book-venue', to: 'give-talk' },
      { from: 'write-talk', to: 'give-talk' },
    ],
  }));
  await page.click('#start #btn-do-import');
  await page.waitForURL(/\/app\/$/);
  await expect(page.locator('.nodes-layer .node')).toHaveCount(3);
  await expect(page.locator('#hud-status')).toHaveText('3 tasks · 2 unlocked · 1 locked · 0 done');
});

test('invalid JSON on the site shows the error in place and does not leave the page', async ({ page }) => {
  await freshSite(page);
  await page.fill('#start #import-text', 'not json');
  await page.click('#start #btn-do-import');
  await expect(page.locator('#start #import-error')).toContainText('Malformed JSON');
  expect(new URL(page.url()).pathname).toBe('/');
});
