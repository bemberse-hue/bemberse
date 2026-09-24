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

test('completar una tarea destella los nodos recien desbloqueados, sin candado y sin audio', async ({ page }) => {
  await page.addInitScript(() => {
    // Si algo intentara sonar, quedaria registrado aqui.
    (window as any).__audio = 0;
    const OrigAudio = window.Audio;
    (window as any).Audio = function (...args: any[]) {
      (window as any).__audio++;
      return new (OrigAudio as any)(...args);
    };
    (window as any).AudioContext = function () {
      (window as any).__audio++;
    };
  });
  await loadSample(page);

  // Registrar que nodos reciben la clase de destello (se retira en animationend).
  await page.evaluate(() => {
    (window as any).__flashed = [] as string[];
    new MutationObserver((records) => {
      for (const r of records) {
        const el = r.target as Element;
        if (el.classList.contains('node--just-unlocked')) (window as any).__flashed.push(el.getAttribute('data-id'));
      }
    }).observe(document.querySelector('.nodes-layer')!, { attributes: true, attributeFilter: ['class'], subtree: true });
  });

  let flashed: string[] = [];
  for (let i = 0; i < 6 && flashed.length === 0; i++) {
    await page.keyboard.press('Space');
    await expect(page.locator('#cockpit')).not.toHaveClass(/hidden/, { timeout: 5000 });
    await page.click('#btn-complete');
    await expect(page.locator('#cockpit')).toHaveClass(/hidden/);
    await page.waitForTimeout(150);
    flashed = await page.evaluate(() => (window as any).__flashed as string[]);
  }
  expect(flashed.length).toBeGreaterThan(0);

  for (const id of flashed) {
    await expect(page.locator(`.node[data-id="${id}"]`)).not.toHaveClass(/node--locked/);
  }
  // La clase se retira sola al acabar la animacion.
  await expect(page.locator('.node--just-unlocked')).toHaveCount(0, { timeout: 3000 });
  expect(await page.evaluate(() => (window as any).__audio)).toBe(0);
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
