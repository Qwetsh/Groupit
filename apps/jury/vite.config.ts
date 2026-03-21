import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/groupit-jury/',
  server: {
    port: 5175,
  },
});
