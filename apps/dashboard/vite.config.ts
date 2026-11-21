import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Une seule source pour les variables d'environnement : le .env.local de la racine.
  envDir: '../../',
  base: '/Groupit/groupit-dashboard/',
  server: {
    port: 5176,
  },
});
