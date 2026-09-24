import { defineConfig } from 'vite';
import path from 'node:path';
// @ts-expect-error: modulo JS del propio repo, sin tipos.
import { viteInputs } from './scripts/i18n-pages.mjs';

// Bemberse: build estatico puro, sin SSR, sin backend.
// Salida a dist/ lista para hosting estatico (Vercel, Netlify, GitHub Pages...).
export default defineConfig({
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    // Sin librerias de imagenes/modelos pesados: el bundle debe permanecer pequeno.
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      // Multipagina: '/' es el sitio explicativo, '/app/' es el motor
      // Constella. Cada uno es su propio documento HTML con su propio
      // entry de JS — no comparten estado de runtime, solo el CSS/tokens.
      // Una entrada por pagina generada (scripts/i18n-pages.mjs): sitio, motor
      // y placeholders del ecosistema, en ingles ('/') y espanol ('/es/').
      input: viteInputs(),
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
