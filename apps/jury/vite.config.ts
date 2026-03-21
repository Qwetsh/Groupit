import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/Groupit/groupit-jury/',
  server: {
    port: 5175,
  },
});
