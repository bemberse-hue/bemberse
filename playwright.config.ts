import { defineConfig, devices } from '@playwright/test';

// Config emitida por el blueprint (§19.6): los `verify` de la tarea 1 ya la necesitan.
//
// BASE_PATH es la unica variable de entorno del proyecto. Desde el paso 05
// (split sitio/app, §9.1), el motor vive en '/app/' — ese es el default,
// asi que smoke/locks/dendrogram.spec.ts prueban el motor sin necesitar la
// variable. site-sections.spec.ts (el sitio, en '/') fija su propia
// baseURL con test.use(). Antes del split, BASE_PATH=/ permitia correr la
// misma suite contra la raiz para comparar el comportamiento pre/post corte.
const BASE_PATH = process.env.BASE_PATH ?? '/app/';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://localhost:5173${BASE_PATH}`,
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 800 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
