import { test, expect } from '@playwright/test';

// El sitio vive en la raiz ('/'), pero el baseURL por defecto de este
// proyecto es '/app/' — asi que estos tests usan la URL completa.
const SITE_URL = 'http://localhost:5173/';

// Un solo embudo con scroll: golpe inicial, autochequeo, diagnostico,
// trampa de herramientas, solucion, el volcado ahi mismo, ecosistema y
// quienes somos.
const REQUIRED_SECTIONS = ['hero', 'check', 'working-memory', 'tools-trap', 'precedence-lock', 'start', 'ecosystem', 'about'];

test('the site renders every section in order, each with a visible heading', async ({ page }) => {
  await page.goto(SITE_URL);

  for (const id of REQUIRED_SECTIONS) {
    const section = page.locator(`#${id}`);
    await expect(section, `section #${id}`).toBeVisible();
    const heading = section.locator('h1, h2').first();
    await expect(heading, `heading of #${id}`).toBeVisible();
    await expect(heading).not.toHaveText('');
  }

  const order = await page.$$eval('#app > section', (els) => els.map((e) => e.id));
  expect(order).toEqual(REQUIRED_SECTIONS);
});

test('the page is in English', async ({ page }) => {
  await page.goto(SITE_URL);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('#hero h1')).toContainText('30 ideas trapped in your head');
});

test('the hero has no buttons: it pushes you to scroll and read the diagnosis first', async ({ page }) => {
  await page.goto(SITE_URL);
  await expect(page.locator('#hero .btn')).toHaveCount(0);
  await expect(page.locator('#hero a[href="app/"]')).toHaveCount(0);
  await expect(page.locator('#hero-scroll')).toHaveAttribute('href', '#check');
});

test('the hero requests no network image (the background is a canvas)', async ({ page }) => {
  const imageRequests: string[] = [];
  page.on('request', (req) => {
    if (req.resourceType() === 'image' && !req.url().endsWith('logo.png')) imageRequests.push(req.url());
  });
  await page.goto(SITE_URL);
  await page.waitForTimeout(500);
  expect(imageRequests, `unexpected image requests: ${imageRequests.join(', ')}`).toHaveLength(0);
  await expect(page.locator('#landing-bg canvas')).toBeVisible();
});

test('the start block still offers a direct way into the engine', async ({ page }) => {
  await page.goto(SITE_URL);
  const cta = page.locator('#btn-open-engine');
  await expect(cta).toHaveText('Open Constella Engine — Free');
  await expect(page.locator('#start')).toContainText('100% local · No account · No cloud tracking');
  await cta.click();
  await expect(page).toHaveURL(/\/app\/?$/);
});

test('the blocks name the problem, the tools and the lock explicitly', async ({ page }) => {
  await page.goto(SITE_URL);
  const memory = (await page.locator('#working-memory').innerText()).toLowerCase();
  expect(memory).toContain('what should i do first');
  expect(memory).toContain('glucose');

  const tools = (await page.locator('#tools-trap').innerText()).toLowerCase();
  for (const word of ['flat lists', 'notion', 'trello', 'amygdala']) expect(tools).toContain(word);

  const lock = (await page.locator('#precedence-lock').innerText()).toLowerCase();
  expect(lock).toContain('if b needs a, b stays under a strict lock');
});

test('the precedence-lock diagram shows A active, B and C locked', async ({ page }) => {
  await page.goto(SITE_URL);
  const texts = await page.$$eval('#precedence-lock .site-diagram svg text', (ts) => ts.map((t) => t.textContent));
  expect(texts).toEqual(['Task A', 'ACTIVE', 'Task B', 'LOCKED', 'Task C', 'LOCKED']);
});

test('at least 3 inline SVG diagrams, all bone strokes with no fill', async ({ page }) => {
  await page.goto(SITE_URL);
  expect(await page.locator('.site-diagram svg').count()).toBeGreaterThanOrEqual(3);

  const shapes = await page.$$eval('.site-diagram svg circle, .site-diagram svg line, .site-diagram svg rect', (els) =>
    els.map((el) => {
      const s = getComputedStyle(el as Element);
      return { fill: s.fill, stroke: s.stroke };
    }),
  );
  expect(shapes.length).toBeGreaterThan(0);
  for (const { fill, stroke } of shapes) {
    expect(fill === 'none' || fill === 'rgba(0, 0, 0, 0)').toBe(true);
    expect(stroke).toBe('rgb(245, 245, 240)'); // --bone
  }
});

test('with prefers-reduced-motion, no diagram animation is running', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto(SITE_URL);
  const running = await page.evaluate(() => {
    let count = 0;
    document.querySelectorAll('.site-diagram svg, .site-diagram svg *').forEach((el) => {
      count += (el as SVGElement).getAnimations?.().length ?? 0;
    });
    return count;
  });
  expect(running).toBe(0);
});

test('the hero wordmark is typographic, in the system font, with a single subtle-gradient keyword', async ({ page }) => {
  await page.goto(SITE_URL);
  const brand = page.locator('#hero .landing__brand');
  await expect(brand).toHaveText(/bemberse/i);
  expect(await brand.evaluate((el) => getComputedStyle(el).fontFamily)).toContain('Oswald');
  await expect(page.locator('#hero img')).toHaveCount(0);

  const keyword = page.locator('#hero .grad-text');
  await expect(keyword).toHaveCount(1);
  const bg = await keyword.evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(bg).toContain('linear-gradient');
});

test('the page scrolls with the mouse wheel, all the way down to the dump', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(SITE_URL);
  await page.mouse.move(640, 400);
  await page.mouse.wheel(0, 1200);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(600);

  // Hasta el final del embudo, con la rueda y no por codigo.
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, 1500);
  await expect.poll(() => page.evaluate(() => window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 4)).toBe(true);
});

test('placeholder pages scroll too', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 600 });
  await page.goto(SITE_URL + 'routes/');
  await page.mouse.move(200, 300);
  await page.mouse.wheel(0, 800);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(100);
});
