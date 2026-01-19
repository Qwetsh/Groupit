import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { clearAndReseedDatabase } from './data/seed'

// Force a reseed on startup to reflect updated initial data
clearAndReseedDatabase().then(() => {
  console.log('Database reseeded with latest defaults');
}).catch(err => {
  console.error('Failed to seed database:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
