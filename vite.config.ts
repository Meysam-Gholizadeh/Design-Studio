/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: { port: 5173, strictPort: false },
  preview: { port: 4173 },
  build: {
    // ECharts (~200 KB gzip) lives in a lazily loaded chunk shared by dashboard routes.
    chunkSizeWarningLimit: 700,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/unit/setup.ts'],
    include: ['tests/unit/**/*.test.{ts,tsx}', 'src/**/*.test.{ts,tsx}'],
    css: { modules: { classNameStrategy: 'non-scoped' } },
    // Component tests render full dashboards (dozens of visuals); allow headroom on slower machines.
    testTimeout: 20_000,
  },
});
