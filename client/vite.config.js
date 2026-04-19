import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3001',
      '/IMG': 'http://localhost:3001',
      '/uploads': 'http://localhost:3001',
      '/Style': 'http://localhost:3001',
      '/Js': 'http://localhost:3001'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
});
