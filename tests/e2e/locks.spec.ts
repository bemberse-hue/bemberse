import { test, expect, type Page } from '@playwright/test';

// Epic 04: la mecanica de candados. Un nodo bloqueado no abre el Inspector:
// el sistema traza por que no se puede. Sin sonido, solo respuesta visual.

async function loadSample(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
  await page.waitForSelector('#onboarding:not(.hidden)', { timeout: 8000 });
  await page.fill('#onboarding-name', 'Nico');
  await page.click('#onboarding-form button[type=submit]');
  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
  await page.waitForTimeout(2500); // dejar que el layout de fuerzas se asiente
}

/** Devuelve el id del primer nodo con la clase dada (node--locked, etc). */
async function firstNodeId(page: Page, selector: string): Promise<string> {
  const id = await page.locator(selector).first().getAttribute('data-id');
  if (!id) throw new Error(`no hay ningun nodo que cumpla ${selector}`);
  return id;
}

// Los nodos SVG se pulsan por su circulo (el <g> raiz puede ser mas fino).
async function clickNode(page: Page, id: string): Promise<void> {
  await page.locator(`.node[data-id="${id}"] .node__dot`).click({ force: true });
}

test('pulsar un nodo bloqueado traza su cadena y NO abre el inspector', async ({ page }) => {
  await loadSample(page);
  const lockedId = await firstNodeId(page, '.node--locked');

  await clickNode(page, lockedId);

  await expect(page.locator('#inspector')).toHaveClass(/hidden/);
  const traced = await page.locator('.edge.trace-active').count();
  expect(traced).toBeGreaterThan(0);
});

test('todo nodo bloqueado lleva un glifo de candado dentro (no solo color)', async ({ page }) => {
  await loadSample(page);
  const lockedGlyphs = await page.$$eval('.node--locked', (nodes) =>
    nodes.map((n) => {
      const glyph = n.querySelector('.node__glyph') as SVGPathElement | null;
      return !!glyph && (glyph.getAttribute('d') ?? '').length > 0 && getComputedStyle(glyph).display !== 'none';
    }),
  );
  expect(lockedGlyphs.length).toBeGreaterThan(0);
  expect(lockedGlyphs.every(Boolean)).toBe(true);
});

test('pulsar un nodo desbloqueado abre el inspector como siempre', async ({ page }) => {
  await loadSample(page);
  const unlockedId = await firstNodeId(page, '.node:not(.node--locked):not(.node--goal)');

  await clickNode(page, unlockedId);
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
});

test('con prefers-reduced-motion, la cadena se marca pero no corre la animacion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await loadSample(page);
  const lockedId = await firstNodeId(page, '.node--locked');

  await clickNode(page, lockedId);

  const traced = page.locator('.edge.trace-active').first();
  await expect(traced).toBeVisible();
  const animationName = await traced.evaluate((el) => getComputedStyle(el).animationName);
  expect(animationName).toBe('none');
});
