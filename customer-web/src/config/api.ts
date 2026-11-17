/**
 * The website calls the Django API on its own origin under /api. In development
 * Vite proxies /api and /media to Django (vite.config.ts); in production the web
 * server does the same. No API address, key or credential lives in the frontend.
 */
export const API_BASE_URL = '/api';
export const REQUEST_TIMEOUT_MS = 15000;
