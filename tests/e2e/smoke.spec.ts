import { test, expect } from '@playwright/test';
import { freshApp, loadPreset, importJson, openTree } from './helpers';

// Suite de paridad del motor Constella ('/app/'): lo que el motor hace de
// punta a punta — ingesta, persistencia, modo ejecucion, Esc, reinicio y
// navegacion — no debe perderse entre cambios.

test('the app loads without console errors and opens straight on the ingest screen', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await freshApp(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(consoleErrors, `console errors: ${consoleErrors.join('\n')}`).toHaveLength(0);
});

test('ingest — one central field, no intermediate questions, no close button on first visit', async ({ page }) => {
  await freshApp(page);
  const field = page.locator('#ingest-text');
  await expect(field).toBeVisible();
  await expect(field).toHaveAttribute('placeholder', 'Dump everything on your mind. No order. No formatting.');
  await expect(field).toBeFocused();
  await expect(page.locator('#btn-mic')).toBeVisible();
  await expect(page.locator('#btn-ingest-close')).toHaveClass(/hidden/);
  // Un unico boton primario: copiar el prompt para la IA externa.
  await expect(page.locator('#ingest .btn--primary')).toHaveCount(1);
  await expect(page.locator('#btn-copy-prompt')).toHaveText('Copy prompt for your AI');
  // Sin pregunta de nombre ni asistente de pasos.
  await expect(page.locator('#onboarding, #wizard')).toHaveCount(0);
});

test('ingest — the copied prompt carries the dump and asks the AI for JSON', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await freshApp(page);
  await page.fill('#ingest-text', 'launch the newsletter, fix the bike');
  await page.click('#btn-copy-prompt');
  await expect(page.locator('#copy-status')).toContainText('Copied');
  const clip = await page.evaluate(() => navigator.clipboard.readText());
  expect(clip).toContain('launch the newsletter, fix the bike');
  expect(clip).toContain('valid JSON object');
  await expect(page.locator('#import-text')).toBeFocused();
});

test('ingest — the three presets each build a map', async ({ page }) => {
  for (const [preset, expected] of [
    ['product-launch', 15],
    ['chaotic-week', 14],
    ['break-the-freeze', 11],
  ] as const) {
    await loadPreset(page, preset, 0);
    await expect(page.locator('.nodes-layer .node')).toHaveCount(expected);
  }
});

test('ingest — the pasted AI JSON builds the map', async ({ page }) => {
  await freshApp(page);
  await importJson(
    page,
    JSON.stringify({
      version: '1.0',
      nodes: [
        { id: 'step-1', title: 'First step' },
        { id: 'goal', title: 'Pasted goal' },
      ],
      edges: [{ from: 'step-1', to: 'goal' }],
    }),
  );
  await expect(page.locator('.nodes-layer .node')).toHaveCount(2);
  await expect(page.locator('#hud-status')).toHaveText('2 tasks · 1 unlocked · 1 locked · 0 done');
});

test('ingest — invalid JSON shows an English error and keeps the screen open', async ({ page }) => {
  await freshApp(page);
  await page.fill('#import-text', '{ "version": "1.0", "nodes": [] }');
  await page.click('#btn-do-import');
  await expect(page.locator('#import-error')).toBeVisible();
  await expect(page.locator('#import-error')).toContainText('Missing "edges"');
  await expect(page.locator('#ingest')).not.toHaveClass(/hidden/);
});

test('a saved map is restored on the next visit, without the ingest screen', async ({ page }) => {
  await loadPreset(page);
  const statusBefore = await page.textContent('#hud-status');
  await page.reload();
  await expect(page.locator('.nodes-layer .node').first()).toBeAttached();
  await expect(page.locator('#ingest')).toHaveClass(/hidden/);
  expect(await page.textContent('#hud-status')).toBe(statusBefore);
});

test('Space enters execution mode, and Space again completes the task', async ({ page }) => {
  await loadPreset(page);
  const coreId = await page.locator('.node--next').getAttribute('data-id');
  await page.keyboard.press('Space');
  await expect(page.locator('#cockpit')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('#cockpit')).toContainText('Press Space to complete');
  await expect(page.locator('#cockpit-title')).not.toHaveText('—');

  await page.keyboard.press('Space');
  await expect(page.locator('#cockpit')).toHaveClass(/hidden/);
  await expect(page.locator(`.node[data-id="${coreId}"]`)).toHaveClass(/node--completed/);
  await expect(page.locator('#hud-status')).toContainText('1 done');
});

test('Esc closes the active panel: execution mode, inspector and new-entry screen, each on its own', async ({ page }) => {
  await loadPreset(page);

  await page.keyboard.press('Space');
  await expect(page.locator('#cockpit')).not.toHaveClass(/hidden/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cockpit')).toHaveClass(/hidden/);

  await page.locator('.node:not(.node--locked):not(.node--goal) .node__dot').first().click({ force: true });
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector')).toHaveClass(/hidden/);

  await page.click('#btn-new-entry');
  await expect(page.locator('#ingest')).not.toHaveClass(/hidden/);
  await expect(page.locator('#btn-ingest-close')).not.toHaveClass(/hidden/);
  await page.locator('#ingest-text').blur();
  await page.keyboard.press('Escape');
  await expect(page.locator('#ingest')).toHaveClass(/hidden/);
});

test('Reset erases the map and returns to the ingest screen', async ({ page }) => {
  await loadPreset(page);
  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#btn-reset');
  await expect(page.locator('#ingest')).not.toHaveClass(/hidden/, { timeout: 8000 });
  await expect(page.locator('#btn-ingest-close')).toHaveClass(/hidden/);
});

test('a preset loaded while the tree is selected renders in the tree', async ({ page }) => {
  await loadPreset(page);
  await openTree(page);
  await page.click('#btn-new-entry');
  await page.click('#preset-chaotic-week');
  await expect(page.locator('.dendrogram-svg .node')).toHaveCount(14);
});

test('system texts are in English', async ({ page }) => {
  await loadPreset(page);
  await expect(page.locator('#hud-brand')).toHaveText('Your map');
  await expect(page.locator('#hud-status')).toHaveText(/^\d+ tasks · \d+ unlocked · \d+ locked · \d+ done$/);
  await expect(page.locator('#hint')).toContainText('Press Space to start your next step');
  await expect(page.locator('#btn-view-graph')).toHaveText('Graph');
  await expect(page.locator('#btn-view-tree')).toHaveText('LTR Tree');
});

test('navigation — the back link goes to / and has an accessible name', async ({ page }) => {
  await loadPreset(page, 'product-launch', 0);
  const link = page.locator('#link-back-site');
  await expect(link).toHaveAttribute('aria-label', /Bemberse/);
  await link.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/');
  // Con datos guardados, el sitio no redirige de vuelta al motor.
  await page.waitForTimeout(500);
  expect(new URL(page.url()).pathname).toBe('/');
  await expect(page.locator('#hero')).toBeVisible();
  await expect(page.locator('#btn-open-engine')).toHaveAttribute('href', 'app/');
});

test('navigation — Tab reaches the view switch, new entry and the back link with a visible focus ring', async ({ page }) => {
  await loadPreset(page, 'product-launch', 0);
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});

  const wanted = ['btn-view-graph', 'btn-new-entry', 'link-back-site'];
  const seen = new Map<string, string>();
  for (let i = 0; i < 14 && seen.size < wanted.length; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { id: el.id, outline: `${s.outlineStyle} ${s.outlineWidth}` };
    });
    if (info && wanted.includes(info.id)) seen.set(info.id, info.outline);
  }
  expect([...seen.keys()].sort()).toEqual([...wanted].sort());
  for (const outline of seen.values()) {
    expect(outline).not.toMatch(/^none/);
    expect(outline).not.toMatch(/ 0px$/);
  }
});

test('navigation — Enter on a focused node does the same as a click', async ({ page }) => {
  await loadPreset(page);
  await expect(page.locator('.nodes-layer .node[tabindex="0"]')).toHaveCount(1);

  await page.locator('.node:not(.node--locked):not(.node--goal)').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await page.keyboard.press('Escape');

  await page.locator('.node--locked').first().focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).toHaveClass(/hidden/);
  expect(await page.locator('.edge.trace-active').count()).toBeGreaterThan(0);
});

test('navigation — the logo top-left goes home and the site tabs are visible on the canvas', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await loadPreset(page, 'product-launch', 0);

  const logo = page.locator('#hud a#link-back-site');
  await expect(logo).toBeVisible();
  await expect(logo).toHaveText(/bemberse/i);
  expect((await logo.boundingBox())!.x).toBeLessThan(80);

  const nav = page.locator('#hud .hud__nav');
  for (const [text, href] of [
    ['The problem', '../#working-memory'],
    ['Your tools', '../#tools-trap'],
    ['The lock', '../#precedence-lock'],
    ['Ecosystem', '../#ecosystem'],
    ['About', '../#about'],
  ]) {
    await expect(nav.getByRole('link', { name: text, exact: true })).toHaveAttribute('href', href);
  }

  await nav.getByRole('link', { name: 'About' }).click();
  await page.waitForURL((url) => url.pathname === '/' && url.hash === '#about');
  await expect(page.locator('#about')).toBeVisible();
});
