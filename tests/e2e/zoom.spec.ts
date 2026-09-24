import { test, expect, type Page } from '@playwright/test';

// Zoom y desplazamiento del universo: con grafos grandes las ideas deben
// poder leerse. Se mide por el viewBox del svg activo.

async function setup(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('./');
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
  await page.waitForSelector('#onboarding:not(.hidden)', { timeout: 8000 });
  await page.fill('#onboarding-name', 'Nico');
  await page.click('#onboarding-form button[type=submit]');
}

async function loadSample(page: Page): Promise<void> {
  await setup(page);
  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
  await page.waitForTimeout(600);
}

/** 120 tareas en 8 cadenas de 15 que convergen en un objetivo: un volcado grande de verdad. */
function bigGraphJson(): string {
  const nodes = [{ id: 'meta', title: 'Meta final de un volcado mental muy extenso' }];
  const edges: { from: string; to: string }[] = [];
  for (let c = 0; c < 8; c++) {
    for (let i = 0; i < 15; i++) {
      const id = `c${c}-${i}`;
      nodes.push({ id, title: `Rama ${c + 1}, paso ${i + 1}: una idea con un titulo largo` });
      if (i > 0) edges.push({ from: `c${c}-${i - 1}`, to: id });
    }
    edges.push({ from: `c${c}-14`, to: 'meta' });
  }
  return JSON.stringify({ version: '1.0', nodes, edges });
}

/** Id del primer nodo desbloqueado (no objetivo) cuyo centro cae dentro de la ventana. */
async function visibleUnlockedNode(page: Page): Promise<{ id: string; x: number; y: number }> {
  const found = await page.$$eval('.node:not(.node--locked):not(.node--goal)', (nodes) => {
    for (const n of nodes) {
      const r = n.querySelector('.node__dot')!.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x > 60 && y > 90 && x < window.innerWidth - 200 && y < window.innerHeight - 90) {
        return { id: n.getAttribute('data-id')!, x, y };
      }
    }
    return null;
  });
  if (!found) throw new Error('ningun nodo desbloqueado visible');
  return found;
}

async function viewBoxWidth(page: Page): Promise<number> {
  const vb = await page.locator('#universe-container > svg').getAttribute('viewBox');
  return Number(vb!.split(/\s+/)[2]);
}

/** px de pantalla por unidad svg. */
async function screenScale(page: Page): Promise<number> {
  return page.locator('#universe-container > svg').evaluate((svg) => {
    const w = Number(svg.getAttribute('viewBox')!.split(/\s+/)[2]);
    return svg.getBoundingClientRect().width / w;
  });
}

test('la rueda acerca y Ajustar vuelve a encuadrar', async ({ page }) => {
  await loadSample(page);
  const before = await viewBoxWidth(page);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, -400);
  await expect.poll(() => viewBoxWidth(page)).toBeLessThan(before * 0.8);
  await page.click('#btn-zoom-fit');
  await expect.poll(() => viewBoxWidth(page)).toBeCloseTo(before, 0);
});

test('los botones + y - y las teclas cambian el zoom', async ({ page }) => {
  await loadSample(page);
  const base = await viewBoxWidth(page);
  await page.click('#btn-zoom-in');
  const zoomed = await viewBoxWidth(page);
  expect(zoomed).toBeLessThan(base);
  await page.click('#btn-zoom-out');
  expect(await viewBoxWidth(page)).toBeGreaterThan(zoomed);
  await page.keyboard.press('+');
  expect(await viewBoxWidth(page)).toBeLessThan(base);
  await page.keyboard.press('0');
  expect(await viewBoxWidth(page)).toBeCloseTo(base, 0);
});

test('arrastrar desplaza la vista y no abre ningun nodo', async ({ page }) => {
  await loadSample(page);
  await page.click('#btn-zoom-in');
  await page.click('#btn-zoom-in');
  const vbBefore = await page.locator('#universe-container > svg').getAttribute('viewBox');
  // Arrastrar desde encima de un nodo: no debe contar como click.
  const start = await visibleUnlockedNode(page);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 120, start.y + 60, { steps: 6 });
  await page.mouse.up();
  expect(await page.locator('#universe-container > svg').getAttribute('viewBox')).not.toBe(vbBefore);
  await expect(page.locator('#inspector')).toHaveClass(/hidden/);
});

test('acercado, las etiquetas muestran el titulo completo; un click sigue abriendo el nodo', async ({ page }) => {
  await loadSample(page);
  const truncatedBefore = await page.$$eval('.node__label', (ls) => ls.filter((l) => l.textContent?.endsWith('…')).length);
  expect(truncatedBefore).toBeGreaterThan(0);
  // Zoom con la rueda sobre un nodo visible: el punto bajo el cursor no se mueve.
  const target = await visibleUnlockedNode(page);
  await page.mouse.move(target.x, target.y);
  for (let i = 0; i < 3; i++) await page.mouse.wheel(0, -300);
  await expect
    .poll(() => page.$$eval('.node__label', (ls) => ls.filter((l) => l.textContent?.endsWith('…')).length))
    .toBe(0);

  const box = await page.locator(`.node[data-id="${target.id}"] .node__dot`).boundingBox();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
});

test('un grafo de 120 tareas arranca legible en el arbol y se puede explorar', async ({ page }) => {
  await setup(page);
  await page.click('#btn-empty-start');
  await page.click('#btn-wizard-skip-to-json');
  await page.fill('#import-text', bigGraphJson());
  await page.click('#btn-do-import');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));

  await page.click('#btn-view-toggle');
  await page.waitForSelector('.dendrogram-svg');
  // Sin zoom automatico, 120 nodos en 16 columnas quedarian por debajo de 0.4.
  expect(await screenScale(page)).toBeGreaterThanOrEqual(0.8);
  // El proximo paso queda dentro de la pantalla.
  const next = await page.locator('.dendrogram-svg .node--next .node__dot').boundingBox();
  expect(next).not.toBeNull();
  expect(next!.x).toBeGreaterThanOrEqual(0);
  expect(next!.x).toBeLessThanOrEqual(1280);
  expect(next!.y).toBeGreaterThanOrEqual(0);
  expect(next!.y).toBeLessThanOrEqual(800);

  // Ajustar muestra el conjunto entero (mas pequeno) y se puede volver a acercar.
  await page.click('#btn-zoom-fit');
  const fitScale = await screenScale(page);
  expect(fitScale).toBeLessThan(0.8);
  await page.click('#btn-zoom-in');
  expect(await screenScale(page)).toBeGreaterThan(fitScale);
});
