import { test, expect } from '@playwright/test';

// E2-T1 / E2-T2: verifica en el navegador lo que el escaneo estatico de
// tokens.test.ts no puede ver — fuentes y colores tal como el motor de
// render los resuelve, y la regla de "maximo un elemento con acento
// visible por pantalla".

const ACCENT_RGB = 'rgb(182, 115, 223)';

test.describe('tipografia y color base', () => {
  test('h1 usa Oswald y el cuerpo usa IBM Plex Sans', async ({ page }) => {
    await page.goto('/');
    const h1Font = await page.locator('h1').first().evaluate((el) => getComputedStyle(el).fontFamily);
    expect(h1Font).toContain('Oswald');

    const bodyFont = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    expect(bodyFont).toContain('IBM Plex Sans');
  });

  test('el fondo es negro puro y el texto es hueso', async ({ page }) => {
    await page.goto('/');
    const { bg, color } = await page.evaluate(() => {
      const s = getComputedStyle(document.body);
      return { bg: s.backgroundColor, color: s.color };
    });
    expect(bg).toBe('rgb(5, 5, 5)');
    expect(color).toBe('rgb(245, 245, 240)');
  });
});

test.describe('botones: esquina recta, sin fondo purpura', () => {
  test('todo .btn tiene border-radius 0 y ningun fondo con el matiz del acento', async ({ page }) => {
    await page.goto('/');
    const results = await page.$$eval('.btn', (buttons) =>
      buttons.map((btn) => {
        const s = getComputedStyle(btn);
        return { radius: s.borderRadius, background: s.backgroundColor };
      }),
    );
    expect(results.length).toBeGreaterThan(0);
    for (const { radius, background } of results) {
      expect(radius).toBe('0px');
      expect(background).not.toBe(ACCENT_RGB);
    }
  });
});

test.describe('regla del acento: como maximo un elemento visible por pantalla', () => {
  test('en la pantalla de bienvenida, ningun elemento de UI usa el color de acento', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => indexedDB.deleteDatabase('bemberse-db'));
    await page.reload();
    await page.click('#btn-landing-start');
    await page.waitForSelector('#onboarding:not(.hidden)');

    const accentCount = await page.evaluate((accent) => {
      const all = document.querySelectorAll('#onboarding *');
      let count = 0;
      all.forEach((el) => {
        const s = getComputedStyle(el);
        if (s.color === accent || s.backgroundColor === accent || (s as any).stroke === accent) count++;
      });
      return count;
    }, ACCENT_RGB);

    expect(accentCount).toBe(0);
  });
});
