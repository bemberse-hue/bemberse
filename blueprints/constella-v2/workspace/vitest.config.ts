import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Config emitida por el blueprint (§19.6): los `verify` de la tarea 1 ya la necesitan.
// Solo cubre logica pura — `src/core/` y los layouts de `src/viz/`. Todo lo que toque el
// DOM se prueba con Playwright, no aqui.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    reporters: 'default',
  },
});
