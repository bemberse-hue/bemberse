import { test, expect } from '@playwright/test';
import { loadPreset } from './helpers';

// Movil (< 768px): la tarea activa vive en un panel inferior fijo y el
// lienzo sigue visible encima.

test.use({ viewport: { width: 390, height: 844 } });

test('a fixed bottom bar shows the next step, and the canvas stays visible above it', async ({ page }) => {
  await loadPreset(page);
  const bar = page.locator('#next-bar');
  await expect(bar).toBeVisible();
  const title = await page.locator('.node--next title').textContent();
  await expect(page.locator('#next-bar-title')).toHaveText(title!);

  const box = (await bar.boundingBox())!;
  expect(box.y + box.height).toBeCloseTo(844, 0); // anclada abajo
  expect(box.height).toBeLessThan(844 * 0.2); // no tapa el lienzo
  await expect(page.locator('#hint')).toBeHidden();
});

test('Start opens execution mode as a bottom sheet; completing updates the bar', async ({ page }) => {
  await loadPreset(page);
  const before = await page.locator('#next-bar-title').textContent();
  await page.click('#btn-next-bar-start');

  const panel = page.locator('#cockpit .cockpit__panel');
  await expect(panel).toBeVisible();
  // Tras la animacion de entrada, el panel queda anclado al borde inferior.
  await expect.poll(async () => {
    const b = (await panel.boundingBox())!;
    return Math.round(b.y + b.height);
  }).toBe(844);
  const box = (await panel.boundingBox())!;
  expect(box.height).toBeLessThan(844 * 0.65); // el mapa se sigue viendo encima
  await expect(page.locator('#next-bar')).toBeHidden();

  await page.click('#btn-complete');
  await expect(page.locator('#next-bar')).toBeVisible();
  await expect(page.locator('#next-bar-title')).not.toHaveText(before!);
});

test('the inspector opens as a bottom sheet', async ({ page }) => {
  await loadPreset(page, 'product-launch', 2500);
  await page.locator('.node:not(.node--locked):not(.node--next) .node__dot').first().click({ force: true });
  const inspector = page.locator('#inspector');
  await expect(inspector).toBeVisible();
  await expect.poll(async () => {
    const b = (await inspector.boundingBox())!;
    return Math.round(b.y + b.height);
  }).toBe(844);
  const box = (await inspector.boundingBox())!;
  expect(box.x).toBe(0);
  expect(box.width).toBeCloseTo(390, 0);
});

test('on desktop the bottom bar is not shown', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await loadPreset(page, 'product-launch', 0);
  await expect(page.locator('#next-bar')).toBeHidden();
  await expect(page.locator('#hint')).toBeVisible();
});
