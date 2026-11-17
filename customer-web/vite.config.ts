/// <reference types="vitest/config" />
import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

/**
 * Customer website dev server: http://localhost:5174 (the admin portal keeps 5173).
 * /api and /media are proxied to Django, so the browser only ever talks to this
 * origin: no CORS settings, and product image URLs built by Django point back here.
 *
 * API_PROXY_TARGET (server-side only, never sent to the browser) points the proxy
 * at another Django instance, e.g. the isolated test server on :8001.
 */
const apiTarget = process.env.API_PROXY_TARGET || 'http://localhost:8000';
const port = Number(process.env.PORT || 5174);

const proxy = {
  // changeOrigin stays false: Django sees Host: localhost:5174 and builds image URLs for this origin.
  '/api': { target: apiTarget },
  '/media': { target: apiTarget },
};

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port, strictPort: true, proxy },
  preview: { port, strictPort: true, proxy },
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
  },
});
