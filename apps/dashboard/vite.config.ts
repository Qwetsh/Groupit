import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/groupit-dashboard/',
  server: {
    port: 5176,
  },
});
