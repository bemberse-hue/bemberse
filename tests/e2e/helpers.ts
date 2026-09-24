import { expect, type Page } from '@playwright/test';

// Helpers compartidos de los tests del motor ('/app/'). Rutas relativas a
// proposito: baseURL es '/app/', y page.goto('/') iria al sitio.

/** Primera visita: base de datos vacia, la app arranca en la ingesta. */
export async function freshApp(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
  await expect(page.locator('#ingest')).not.toHaveClass(/hidden/, { timeout: 8000 });
}

/** Carga uno de los presets de la ingesta y espera al mapa. */
export async function loadPreset(page: Page, preset = 'product-launch', settleMs = 600): Promise<void> {
  await freshApp(page);
  await page.click(`#preset-${preset}`);
  await expect(page.locator('#ingest')).toHaveClass(/hidden/);
  await expect(page.locator('#universe-container .nodes-layer .node').first()).toBeAttached();
  if (settleMs > 0) await page.waitForTimeout(settleMs); // dejar que el layout de fuerzas se asiente
}

/** Importa un JSON pegado en la ingesta (el flujo de la IA externa). */
export async function importJson(page: Page, json: string): Promise<void> {
  await page.fill('#import-text', json);
  await page.click('#btn-do-import');
  const err = page.locator('#import-error');
  await expect(page.locator('#ingest'), `import error: ${await err.textContent().catch(() => '')}`).toHaveClass(/hidden/);
}

export async function openTree(page: Page): Promise<void> {
  await page.click('#btn-view-tree');
  await page.waitForSelector('.dendrogram-svg');
}

export async function openGraph(page: Page): Promise<void> {
  await page.click('#btn-view-graph');
  await expect(page.locator('.dendrogram-svg')).toHaveCount(0);
}
