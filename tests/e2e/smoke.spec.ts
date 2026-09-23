import { test, expect } from '@playwright/test';

// E1-T1: smoke minimo que prueba que el arnes de Playwright arranca contra la
// app real. E3-T1 lo reescribe con el checklist de paridad completo (§9.1)
// una vez exista el split de paginas sitio/app.

test('la app carga sin errores de consola y muestra la portada en la primera visita', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${err.message}`));

  await page.goto('/');
  await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
  await page.reload();

  await expect(page.locator('#landing')).not.toHaveClass(/hidden/, { timeout: 8000 });
  expect(consoleErrors, `errores de consola: ${consoleErrors.join('\n')}`).toHaveLength(0);
});
