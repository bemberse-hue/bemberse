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
    rollupOptions: {
      // Multipagina: '/' es el sitio explicativo, '/app/' es el motor
      // Constella. Cada uno es su propio documento HTML con su propio
      // entry de JS — no comparten estado de runtime, solo el CSS/tokens.
      input: {
        site: path.resolve(__dirname, 'index.html'),
        app: path.resolve(__dirname, 'app/index.html'),
        // Placeholders provisionales del hub: productos anunciados que aun
        // no existen. Estaticos, comparten tokens y layout con el sitio.
        routes: path.resolve(__dirname, 'routes/index.html'),
        templates: path.resolve(__dirname, 'templates/index.html'),
        circle: path.resolve(__dirname, 'circle/index.html'),
      },
    },
  },
  server: {
    port: 5173,
    open: true,
  },
});
