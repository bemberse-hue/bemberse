import { test, expect, type Page } from '@playwright/test';

// Suite de paridad del motor Constella ('/app/'), escrita en el paso 05
// (split sitio/app, blueprint constella-v2 §9.1). Cubre las seis filas del
// checklist de paridad: nada de lo que el motor ya hacia en '/' debe
// perderse al mudarse a '/app/'.

async function resetDb(page: Page): Promise<void> {
  // Ruta relativa a proposito: baseURL ya es '/app/' por defecto, y
  // page.goto('/') iria a la raiz del servidor (el sitio), no al motor.
  await page.goto('./');
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
}

async function completeOnboarding(page: Page, name = 'Nico'): Promise<void> {
  await page.reload();
  await page.waitForSelector('#onboarding:not(.hidden)', { timeout: 8000 });
  await page.fill('#onboarding-name', name);
  await page.click('#onboarding-form button[type=submit]');
  await page.waitForFunction(
    () => document.getElementById('onboarding')?.classList.contains('hidden'),
    { timeout: 8000 },
  );
}

test('la app carga sin errores de consola y arranca en el onboarding la primera vez', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await resetDb(page);
  await page.reload();
  await expect(page.locator('#onboarding')).not.toHaveClass(/hidden/, { timeout: 8000 });
  expect(consoleErrors, `errores de consola: ${consoleErrors.join('\n')}`).toHaveLength(0);
});

test('fila 1 — un perfil ya guardado salta el onboarding en la siguiente visita', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page, 'Nico');

  // Recargar simula "volver otro dia": el perfil ya esta en IndexedDB.
  await page.reload();
  await page.waitForTimeout(300);
  await expect(page.locator('#onboarding')).toHaveClass(/hidden/);
  await expect(page.locator('#hud-brand')).toContainText('NICO');
});

test('fila 2 — un grafo ya guardado se restaura y se dibuja al volver', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);

  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
  const statusBefore = await page.textContent('#hud-status');

  await page.reload();
  await page.waitForTimeout(500);
  const statusAfter = await page.textContent('#hud-status');

  expect(statusAfter).toBe(statusBefore);
  const nodeCount = await page.locator('.nodes-layer .node').count();
  expect(nodeCount).toBeGreaterThan(0);
});

test('fila 3 — el asistente guiado importa un JSON valido y crea el universo', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);

  await page.click('#btn-empty-start');
  await page.waitForSelector('#wizard:not(.hidden)');
  await page.click('#btn-wizard-start');
  await page.fill('#ingest-text', 'probar el asistente guiado');
  await page.click('#btn-wizard-to-prompt');
  await page.click('#btn-wizard-to-import');

  const json = JSON.stringify({
    version: '1.0',
    nodes: [
      { id: 'paso-1', title: 'Primer paso' },
      { id: 'meta', title: 'Meta del asistente' },
    ],
    edges: [{ from: 'paso-1', to: 'meta' }],
  });
  await page.fill('#import-text', json);
  await page.click('#btn-do-import');

  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
  await expect(page.locator('#wizard')).toHaveClass(/hidden/);
  const nodeCount = await page.locator('.nodes-layer .node').count();
  expect(nodeCount).toBe(2);
});

test('fila 4 — Espacio entra al modo ejecucion con el proximo paso activo', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
  await page.waitForTimeout(800);

  await page.keyboard.press('Space');
  await expect(page.locator('#cockpit')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('#cockpit-title')).not.toHaveText('—');
});

test('fila 5 — Esc cierra el panel activo: cockpit, inspector y asistente, cada uno por separado', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));
  await page.waitForTimeout(800);

  // Cockpit.
  await page.keyboard.press('Space');
  await expect(page.locator('#cockpit')).not.toHaveClass(/hidden/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#cockpit')).toHaveClass(/hidden/);

  // Inspector: desde el paso 09 un nodo bloqueado ya no lo abre (traza su
  // cadena), asi que se pulsa uno desbloqueado.
  await page
    .locator('.node:not(.node--locked):not(.node--goal) .node__dot')
    .first()
    .click({ force: true });
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await page.keyboard.press('Escape');
  await expect(page.locator('#inspector')).toHaveClass(/hidden/);

  // Asistente.
  await page.click('#btn-new-entry');
  await expect(page.locator('#wizard')).not.toHaveClass(/hidden/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#wizard')).toHaveClass(/hidden/);
});

test('fila 6 — Reiniciar borra el grafo, conserva el perfil, y recarga al estado vacio', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page, 'Nico');
  await page.click('#btn-empty-sample');
  await page.waitForFunction(() => document.getElementById('empty-state')?.classList.contains('hidden'));

  page.once('dialog', (dialog) => dialog.accept());
  await page.click('#btn-reset');

  await page.waitForFunction(() => document.getElementById('empty-state') && !document.getElementById('empty-state')!.classList.contains('hidden'), { timeout: 8000 });
  await expect(page.locator('#onboarding')).toHaveClass(/hidden/); // el perfil sigue ahi
  await expect(page.locator('#hud-brand')).toContainText('NICO');
});

test('estado vacio — diagrama en linea solo con trazo hueso, una accion primaria y un enlace a la muestra', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  await expect(page.locator('#empty-state')).not.toHaveClass(/hidden/);

  const diagram = await page.$$eval('#empty-state svg, #empty-state svg *', (els) =>
    els.map((el) => {
      const s = getComputedStyle(el);
      return { tag: el.tagName, fill: s.fill, stroke: s.stroke };
    }),
  );
  expect(diagram.length).toBeGreaterThan(1);
  for (const { fill, stroke } of diagram) {
    expect(fill).toBe('none');
    expect(['none', 'rgb(245, 245, 240)']).toContain(stroke);
  }

  await expect(page.locator('#empty-state .btn--primary')).toHaveCount(1);
  await page.click('#empty-state .btn--primary');
  await expect(page.locator('#wizard')).not.toHaveClass(/hidden/);
  await page.keyboard.press('Escape');

  await page.click('#btn-empty-sample');
  await expect(page.locator('#empty-state')).toHaveClass(/hidden/);
});

test('estado vacio — la muestra se dibuja en la vista seleccionada', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  await page.click('#btn-view-toggle');
  await page.click('#btn-empty-sample');
  await expect(page.locator('#empty-state')).toHaveClass(/hidden/);
  await expect(page.locator('.dendrogram-svg .node')).not.toHaveCount(0);
});

test('navegacion — el enlace de retorno lleva a / y tiene nombre accesible', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  const link = page.locator('#link-back-site');
  await expect(link).toHaveAttribute('aria-label', /Bemberse/);
  await link.focus();
  await page.keyboard.press('Enter');
  await page.waitForURL((url) => url.pathname === '/');
});

test('navegacion — Tab recorre conmutador, nueva entrada y retorno con anillo de foco visible', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  await page.click('#btn-empty-sample');
  await page.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});

  const seen = new Map<string, string>();
  for (let i = 0; i < 12 && seen.size < 3; i++) {
    await page.keyboard.press('Tab');
    const info = await page.evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el) return null;
      const s = getComputedStyle(el);
      return { id: el.id, outline: `${s.outlineStyle} ${s.outlineWidth}` };
    });
    if (info && ['btn-view-toggle', 'btn-new-entry', 'link-back-site'].includes(info.id)) seen.set(info.id, info.outline);
  }
  expect([...seen.keys()].sort()).toEqual(['btn-new-entry', 'btn-view-toggle', 'link-back-site']);
  for (const outline of seen.values()) {
    expect(outline).not.toMatch(/^none/);
    expect(outline).not.toMatch(/ 0px$/);
  }
});

test('navegacion — Enter sobre un nodo enfocado hace lo mismo que un click', async ({ page }) => {
  await resetDb(page);
  await completeOnboarding(page);
  await page.click('#btn-empty-sample');
  await page.waitForTimeout(800);

  // Un unico nodo tabulable (tabindex itinerante).
  await expect(page.locator('.nodes-layer .node[tabindex="0"]')).toHaveCount(1);

  const unlocked = page.locator('.node:not(.node--locked):not(.node--goal)').first();
  await unlocked.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).not.toHaveClass(/hidden/, { timeout: 5000 });
  await page.keyboard.press('Escape');

  const locked = page.locator('.node--locked').first();
  await locked.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#inspector')).toHaveClass(/hidden/);
  expect(await page.locator('.edge.trace-active').count()).toBeGreaterThan(0);
});
