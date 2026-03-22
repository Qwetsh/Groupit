// ============================================================
// STEP BINÔMES — Associer des élèves en binôme (optionnel)
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Users, X, Search, ChevronDown, ChevronRight } from 'lucide-react';
import { useEleveStore } from '../../../stores/eleveStore';

interface StepBinomesProps {
  onNext: () => void;
  onBack: () => void;
}

export const StepBinomes: React.FC<StepBinomesProps> = ({ onNext, onBack }) => {
  const eleves = useEleveStore(state => state.eleves);
  const setBinome = useEleveStore(state => state.setBinome);
  const removeBinome = useEleveStore(state => state.removeBinome);

  const [search, setSearch] = useState('');
  const [selectedEleveId, setSelectedEleveId] = useState<string | null>(null);
  // Élèves de 3e uniquement (oral DNB)
  const eleves3e = useMemo(() =>
    eleves.filter(e => e.classe.startsWith('3')).sort((a, b) =>
      a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom)
    ),
    [eleves]
  );

  // Grouper par classe
  const classeGroups = useMemo(() => {
    const groups = new Map<string, typeof eleves3e>();
    for (const e of eleves3e) {
      const list = groups.get(e.classe) || [];
      list.push(e);
      groups.set(e.classe, list);
    }
    return groups;
  }, [eleves3e]);

  // Initialiser avec toutes les classes dépliées
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() =>
    new Set(eleves.filter(e => e.classe.startsWith('3')).map(e => e.classe))
  );

  // Binômes existants
  const binomes = useMemo(() => {
    const pairs: Array<{ eleveA: typeof eleves3e[0]; eleveB: typeof eleves3e[0] }> = [];
    const seen = new Set<string>();
    for (const e of eleves3e) {
      if (e.binomeId && !seen.has(e.id)) {
        const partner = eleves3e.find(p => p.id === e.binomeId);
        if (partner) {
          pairs.push({ eleveA: e, eleveB: partner });
          seen.add(e.id);
          seen.add(partner.id);
        }
      }
    }
    return pairs;
  }, [eleves3e]);

  // Élèves disponibles (pas en binôme, hors élève sélectionné)
  const availableForPairing = useMemo(() => {
    if (!selectedEleveId) return [];
    const searchLower = search.toLowerCase();
    return eleves3e.filter(e =>
      e.id !== selectedEleveId &&
      !e.binomeId &&
      (searchLower === '' ||
        e.nom.toLowerCase().includes(searchLower) ||
        e.prenom.toLowerCase().includes(searchLower) ||
        e.classe.toLowerCase().includes(searchLower))
    );
  }, [eleves3e, selectedEleveId, search]);

  const handleSelectEleve = useCallback((eleveId: string) => {
    setSelectedEleveId(prev => prev === eleveId ? null : eleveId);
    setSearch('');
  }, []);

  const handlePair = useCallback(async (eleveBId: string) => {
    if (!selectedEleveId) return;
    await setBinome(selectedEleveId, eleveBId);
    setSelectedEleveId(null);
    setSearch('');
  }, [selectedEleveId, setBinome]);

  const handleRemoveBinome = useCallback(async (eleveId: string) => {
    await removeBinome(eleveId);
  }, [removeBinome]);

  const toggleClasse = useCallback((classe: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classe)) next.delete(classe);
      else next.add(classe);
      return next;
    });
  }, []);

  const selectedEleve = selectedEleveId ? eleves3e.find(e => e.id === selectedEleveId) : null;

  return (
    <div className="step-binomes">
      <div className="step-header">
        <div className="step-icon-wrap">
          <Users size={28} />
        </div>
        <h2>Binômes</h2>
        <p className="step-description">
          Associez les élèves qui passent en binôme. Ils seront affectés au même jury,
          avec le même créneau horaire (durée doublée). Cette étape est facultative.
        </p>
      </div>

      {/* Binômes existants */}
      {binomes.length > 0 && (
        <div className="binomes-existing">
          <h3>Binômes créés ({binomes.length})</h3>
          <div className="binomes-list">
            {binomes.map(({ eleveA, eleveB }) => (
              <div key={eleveA.id} className="binome-card">
                <div className="binome-pair">
                  <span className="binome-name">{eleveA.nom} {eleveA.prenom}</span>
                  <span className="binome-separator">&amp;</span>
                  <span className="binome-name">{eleveB.nom} {eleveB.prenom}</span>
                </div>
                <span className="binome-classe">{eleveA.classe}</span>
                <button
                  className="binome-remove-btn"
                  onClick={() => handleRemoveBinome(eleveA.id)}
                  title="Dissocier"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sélection */}
      <div className="binomes-creation">
        <h3>{selectedEleve ? `Choisir le partenaire de ${selectedEleve.prenom} ${selectedEleve.nom}` : 'Sélectionnez un élève pour créer un binôme'}</h3>

        {selectedEleve && (
          <div className="binome-search-area">
            <div className="binome-selected-banner">
              <Users size={16} />
              <span>{selectedEleve.prenom} {selectedEleve.nom} ({selectedEleve.classe})</span>
              <button onClick={() => setSelectedEleveId(null)}><X size={14} /></button>
            </div>
            <div className="binome-search-input">
              <Search size={14} />
              <input
                type="text"
                placeholder="Rechercher un élève..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="binome-candidates">
              {availableForPairing.length === 0 ? (
                <p className="binome-empty">Aucun élève disponible</p>
              ) : (
                availableForPairing.slice(0, 20).map(e => (
                  <button
                    key={e.id}
                    className="binome-candidate"
                    onClick={() => handlePair(e.id)}
                  >
                    <span className="candidate-name">{e.nom} {e.prenom}</span>
                    <span className="candidate-classe">{e.classe}</span>
                    {e.matieresOral && e.matieresOral.length > 0 && (
                      <span className="candidate-matiere">{e.matieresOral[0]}</span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {!selectedEleve && (
          <div className="binome-eleves-list">
            {[...classeGroups.entries()].map(([classe, elevesClasse]) => {
              const available = elevesClasse.filter(e => !e.binomeId);
              if (available.length === 0) return null;
              const isExpanded = expandedClasses.has(classe);
              return (
                <div key={classe} className="binome-classe-group">
                  <button className="binome-classe-header" onClick={() => toggleClasse(classe)}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    <span>{classe}</span>
                    <span className="binome-classe-count">{available.length} disponible{available.length > 1 ? 's' : ''}</span>
                  </button>
                  {isExpanded && (
                    <div className="binome-classe-eleves">
                      {available.map(e => (
                        <button
                          key={e.id}
                          className="binome-eleve-btn"
                          onClick={() => handleSelectEleve(e.id)}
                        >
                          <span>{e.nom} {e.prenom}</span>
                          {e.matieresOral && e.matieresOral.length > 0 && (
                            <span className="eleve-matiere-tag">{e.matieresOral[0]}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Retour</button>
        <button className="btn btn-primary" onClick={onNext}>
          {binomes.length > 0 ? 'Continuer' : 'Passer cette étape'}
        </button>
      </div>
    </div>
  );
};
