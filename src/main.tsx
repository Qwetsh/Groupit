import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { clearAndReseedDatabase } from './data/seed'

// Attendre le reseed AVANT de render l'app pour éviter les race conditions
async function initApp() {
  try {
    await clearAndReseedDatabase();
    console.log('Database reseeded with latest defaults');
  } catch (err) {
    console.error('Failed to seed database:', err);
    // Continue anyway - the app can still work with existing data
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

initApp();
