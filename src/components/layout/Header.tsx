import React from 'react';
import { useUIStore } from '../../stores/uiStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import { Search, Plus } from 'lucide-react';
import './Header.css';

export const Header: React.FC = () => {
  const { openModal } = useUIStore();
  const activeScenario = useScenarioStore(state => state.getActiveScenario());

  return (
    <header className="app-header">
      <div className="header-left">
        <div className="search-box">
          <Search size={18} />
          <input 
            type="text" 
            placeholder="Rechercher un élève, enseignant..." 
          />
        </div>
      </div>

      <div className="header-right">
        <button className="header-btn" onClick={() => openModal('import')}>
          <Plus size={18} />
          <span>Importer CSV</span>
        </button>

        <div className="scenario-selector">
          <span className="scenario-label">Scénario actif:</span>
          <span className="scenario-name">
            {activeScenario?.nom || 'Aucun'}
          </span>
        </div>
      </div>
    </header>
  );
};
