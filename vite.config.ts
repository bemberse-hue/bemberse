import { defineConfig } from 'vite';
import path from 'node:path';

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
  },
  server: {
    port: 5173,
    open: true,
  },
});
