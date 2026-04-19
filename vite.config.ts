import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: '.',
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    target: 'es2022',
  },
  resolve: {
    alias: {
      '@shared': `${root}src/shared`,
      '@core': `${root}src/core`,
      '@assets': `${root}src/assets`,
      '@ui': `${root}src/ui`,
      '@infra': `${root}src/infra`,
      '@utils': `${root}src/utils`,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
      },
    },
  },
});
