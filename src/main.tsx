import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { seedLocalDataIfEmpty } from './data/seed'
import { scenarioRepository } from './infrastructure/repositories'
import { migrateLegacyBackups } from './infrastructure/database/legacyBackupMigration'

// Préparer la base AVANT de render l'app pour éviter les race conditions.
// Rien n'est jamais supprimé ici : les données de l'utilisateur doivent
// survivre à un rechargement de la page.
async function initApp() {
  try {
    await scenarioRepository.ensureDefaults();
    // Reprendre l'ancienne sauvegarde localStorage avant tout chargement :
    // IndexedDB est ensuite la seule source de vérité.
    await migrateLegacyBackups();
    await seedLocalDataIfEmpty();
  } catch (err) {
    console.error('Failed to prepare database:', err);
    // Continue anyway - the app can still work with existing data
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

initApp();
