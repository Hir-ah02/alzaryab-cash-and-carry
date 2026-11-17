import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' makes the production build work from any static host or sub-folder.
export default defineConfig({
  base: './',
  plugins: [react()],
});
