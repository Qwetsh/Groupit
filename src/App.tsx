import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout';
import { Board } from './components/board';
import { ImportWizard } from './components/import';
import { EnseignantModal, ScenarioModal } from './components/modals';
import {
  DashboardPage,
  ElevesPage,
  EnseignantsPage,
  ScenariosPage,
  DonneesPage,
  ParametresPage,
  AidePage,
} from './pages';
import { useEleveStore } from './stores/eleveStore';
import { useEnseignantStore } from './stores/enseignantStore';
import { useScenarioStore } from './stores/scenarioStore';
import { useGroupeStore } from './stores/groupeStore';
import { useAffectationStore } from './stores/affectationStore';
import { useJuryStore } from './stores/juryStore';
import { useUIStore } from './stores/uiStore';
import type { Eleve } from './domain/models';
import './App.css';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const activeModal = useUIStore(state => state.activeModal);
  const closeModal = useUIStore(state => state.closeModal);

  const loadEleves = useEleveStore(state => state.loadEleves);
  const addEleves = useEleveStore(state => state.addEleves);
  const loadEnseignants = useEnseignantStore(state => state.loadEnseignants);
  const loadScenarios = useScenarioStore(state => state.loadScenarios);
  const loadGroupes = useGroupeStore(state => state.loadGroupes);
  const loadAffectations = useAffectationStore(state => state.loadAffectations);
  const loadJurys = useJuryStore(state => state.loadJurys);

  // Load all data on mount
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Load all data from IndexedDB
        await Promise.all([
          loadEleves(),
          loadEnseignants(),
          loadScenarios(),
          loadGroupes(),
          loadAffectations(),
          loadJurys(),
        ]);
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeApp();
  }, [loadEleves, loadEnseignants, loadScenarios, loadGroupes, loadAffectations, loadJurys]);

  const handleImport = async (eleves: Partial<Eleve>[]) => {
    await addEleves(eleves as Omit<Eleve, 'id' | 'createdAt' | 'updatedAt'>[]);
  };

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
        <p>Chargement de Groupit...</p>
      </div>
    );
  }

  return (
    <BrowserRouter basename={import.meta.env.BASE_URL}>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="board" element={<Board />} />
          <Route path="eleves" element={<ElevesPage />} />
          <Route path="enseignants" element={<EnseignantsPage />} />
          <Route path="scenarios" element={<ScenariosPage />} />
          <Route path="donnees" element={<DonneesPage />} />
          <Route path="parametres" element={<ParametresPage />} />
          <Route path="aide" element={<AidePage />} />
        </Route>
      </Routes>

      {activeModal === 'import' && (
        <ImportWizard 
          onClose={closeModal} 
          onImport={handleImport}
        />
      )}

      {activeModal === 'editEnseignant' && (
        <EnseignantModal
          onClose={closeModal}
        />
      )}

      {activeModal === 'editScenario' && (
        <ScenarioModal
          onClose={closeModal}
        />
      )}
    </BrowserRouter>
  );
}

export default App;
