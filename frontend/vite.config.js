import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: './',  // Required for Electron file:// protocol
  server: {
    port: 3009,
    proxy: {
      '/api': 'http://localhost:3010'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
