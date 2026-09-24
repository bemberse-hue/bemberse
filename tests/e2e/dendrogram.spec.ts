import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { buildRuntimeGraph, countDownstream, getCriticalPath } from '../../src/core/graph';
import type { RawBemberseGraph } from '../../src/core/types';

// Epic 05: vista Dendrograma. Las expectativas se calculan con el propio
// motor (src/core, sin DOM) sobre el mismo grafo de muestra que carga la app.

const sample = JSON.parse(
  readFileSync(new URL('../../sample-data/example-graph.json', import.meta.url), 'utf-8'),
) as RawBemberseGraph;
const expectedGraph = buildRuntimeGraph(sample, new Set(), null);

async function loadSample(page: Page): Promise<void> {
  await page.goto('./');
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();
  await page.waitForSelector('#onboarding:not(.hidden)', { timeout: 8000 });
  await page.fill('#onboarding-name', 'Nico');
  await page.click('#onboarding-form button[type=submit]');
  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
}

async function openTree(page: Page): Promise<void> {
  await page.click('#btn-view-toggle');
  await page.waitForSelector('.dendrogram-svg');
}

test('dibuja una curva Bezier cubica por arista', async ({ page }) => {
  await loadSample(page);
  await openTree(page);
  const ds = await page.$$eval('.dendrogram-svg .edges-layer path', (paths) => paths.map((p) => p.getAttribute('d') ?? ''));
  expect(ds).toHaveLength(sample.edges.length);
  for (const d of ds) expect(d).toMatch(/C/);
});

test('cada nodo con descendientes lleva una insignia igual a su carga aguas abajo', async ({ page }) => {
  await loadSample(page);
  await openTree(page);
  const badges = await page.$$eval('.dendrogram-svg .node', (nodes) =>
    nodes.map((n) => ({ id: n.getAttribute('data-id')!, badge: n.querySelector('.node__badge')?.textContent ?? null })),
  );
  expect(badges).toHaveLength(sample.nodes.length);
  for (const { id, badge } of badges) {
    const expected = countDownstream(expectedGraph, id);
    if (expected > 0) expect(badge).toBe(String(expected));
    else expect(badge).toBeNull();
  }
});

test('solo las aristas de la ruta critica llevan edge--critical', async ({ page }) => {
  await loadSample(page);
  await openTree(page);
  const critical = getCriticalPath(expectedGraph).nodeIds;
  const expectedPairs = critical.slice(0, -1).map((id, i) => `${id}->${critical[i + 1]}`).sort();

  const marked = await page.$$eval('.dendrogram-svg path.edge--critical', (paths) =>
    paths.map((p) => `${p.getAttribute('data-from')}->${p.getAttribute('data-to')}`),
  );
  expect(expectedPairs.length).toBeGreaterThan(0);
  expect(marked.sort()).toEqual(expectedPairs);
});

test('el click enruta igual que en la red: bloqueado traza, desbloqueado abre el inspector', async ({ page }) => {
  await loadSample(page);
  await openTree(page);

  const lockedId = await page.locator('.dendrogram-svg .node--locked').first().getAttribute('data-id');
  await page.locator(`.node[data-id="${lockedId}"] .node__dot`).click({ force: true });
  await expect(page.locator('#inspector')).toHaveClass(/hidden/);
  expect(await page.locator('.dendrogram-svg .edge.trace-active').count()).toBeGreaterThan(0);

  const openId = await page.locator('.dendrogram-svg .node:not(.node--locked)').first().getAttribute('data-id');
  await page.locator(`.node[data-id="${openId}"] .node__dot`).click({ force: true });
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
});

test('conmutar deja exactamente un svg raiz en el contenedor, en ambos sentidos', async ({ page }) => {
  await loadSample(page);
  await openTree(page);
  expect(await page.locator('#universe-container > svg').count()).toBe(1);
  await page.click('#btn-view-toggle');
  await expect(page.locator('.dendrogram-svg')).toHaveCount(0);
  expect(await page.locator('#universe-container > svg').count()).toBe(1);
});
