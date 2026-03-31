// ============================================================
// STEP GROUPES — Associer des élèves en binôme ou trinôme
// ============================================================

import React, { useState, useMemo, useCallback } from 'react';
import { Users, X, Search, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { useEleveStore } from '../../../stores/eleveStore';

interface StepGroupesProps {
  onNext: () => void;
  onBack: () => void;
}

export const StepGroupes: React.FC<StepGroupesProps> = ({ onNext, onBack }) => {
  const eleves = useEleveStore(state => state.eleves);
  const setGroupeOral = useEleveStore(state => state.setGroupeOral);
  const removeFromGroupeOral = useEleveStore(state => state.removeFromGroupeOral);

  const [search, setSearch] = useState('');
  const [selectedEleveId, setSelectedEleveId] = useState<string | null>(null);
  const [addingToGroupeId, setAddingToGroupeId] = useState<string | null>(null);

  const eleves3e = useMemo(() =>
    eleves.filter(e => e.classe.startsWith('3')).sort((a, b) =>
      a.classe.localeCompare(b.classe) || a.nom.localeCompare(b.nom)
    ),
    [eleves]
  );

  const classeGroups = useMemo(() => {
    const groups = new Map<string, typeof eleves3e>();
    for (const e of eleves3e) {
      const list = groups.get(e.classe) || [];
      list.push(e);
      groups.set(e.classe, list);
    }
    return groups;
  }, [eleves3e]);

  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(() =>
    new Set(eleves.filter(e => e.classe.startsWith('3')).map(e => e.classe))
  );

  // Groupes existants
  const groupes = useMemo(() => {
    const groupMap = new Map<string, typeof eleves3e>();
    for (const e of eleves3e) {
      if (e.groupeOralId) {
        const list = groupMap.get(e.groupeOralId) || [];
        list.push(e);
        groupMap.set(e.groupeOralId, list);
      }
    }
    return [...groupMap.entries()].map(([id, members]) => ({ id, members }));
  }, [eleves3e]);

  const availableForPairing = useMemo(() => {
    const targetId = selectedEleveId || addingToGroupeId;
    if (!targetId && !addingToGroupeId) return [];
    const searchLower = search.toLowerCase();

    // Get IDs to exclude
    const excludeIds = new Set<string>();
    if (selectedEleveId) excludeIds.add(selectedEleveId);
    if (addingToGroupeId) {
      const groupe = groupes.find(g => g.id === addingToGroupeId);
      if (groupe) groupe.members.forEach(m => excludeIds.add(m.id));
    }

    return eleves3e.filter(e =>
      !excludeIds.has(e.id) &&
      !e.groupeOralId &&
      (searchLower === '' ||
        e.nom.toLowerCase().includes(searchLower) ||
        e.prenom.toLowerCase().includes(searchLower) ||
        e.classe.toLowerCase().includes(searchLower))
    );
  }, [eleves3e, selectedEleveId, addingToGroupeId, search, groupes]);

  const handleSelectEleve = useCallback((eleveId: string) => {
    setSelectedEleveId(prev => prev === eleveId ? null : eleveId);
    setAddingToGroupeId(null);
    setSearch('');
  }, []);

  const handlePair = useCallback(async (eleveBId: string) => {
    if (selectedEleveId) {
      await setGroupeOral([selectedEleveId, eleveBId]);
      setSelectedEleveId(null);
      setSearch('');
    } else if (addingToGroupeId) {
      const groupe = groupes.find(g => g.id === addingToGroupeId);
      if (groupe) {
        const memberIds = [...groupe.members.map(m => m.id), eleveBId];
        await setGroupeOral(memberIds);
      }
      setAddingToGroupeId(null);
      setSearch('');
    }
  }, [selectedEleveId, addingToGroupeId, setGroupeOral, groupes]);

  const handleRemoveMember = useCallback(async (eleveId: string) => {
    await removeFromGroupeOral(eleveId);
  }, [removeFromGroupeOral]);

  const handleAddToGroupe = useCallback((groupeId: string) => {
    setAddingToGroupeId(groupeId);
    setSelectedEleveId(null);
    setSearch('');
  }, []);

  const toggleClasse = useCallback((classe: string) => {
    setExpandedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classe)) next.delete(classe);
      else next.add(classe);
      return next;
    });
  }, []);

  const selectedEleve = selectedEleveId ? eleves3e.find(e => e.id === selectedEleveId) : null;
  const addingToGroupe = addingToGroupeId ? groupes.find(g => g.id === addingToGroupeId) : null;

  return (
    <div className="step-groupes">
      <div className="step-header">
        <div className="step-icon-wrap">
          <Users size={28} />
        </div>
        <h2>Groupes oraux</h2>
        <p className="step-description">
          Associez les eleves qui passent en binome (2) ou trinome (3). Ils seront affectes au meme jury,
          avec le meme creneau horaire. Cette etape est facultative.
        </p>
      </div>

      {/* Groupes existants */}
      {groupes.length > 0 && (
        <div className="binomes-existing">
          <h3>Groupes crees ({groupes.length})</h3>
          <div className="binomes-list">
            {groupes.map(({ id, members }) => {
              const isTrinome = members.length === 3;
              return (
                <div key={id} className="groupe-card" style={isTrinome ? { borderColor: '#f59e0b' } : {}}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <span className={isTrinome ? 'trinome-badge' : 'binome-badge-tag'}>
                      {isTrinome ? 'TRINOME' : 'BINOME'}
                    </span>
                    <span className="binome-classe">{members[0]?.classe}</span>
                  </div>
                  <div className="groupe-members">
                    {members.map(m => (
                      <div key={m.id} className="groupe-member" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 0' }}>
                        <span className="groupe-member-name">{m.nom} {m.prenom}</span>
                        <button
                          className="binome-remove-btn"
                          onClick={() => handleRemoveMember(m.id)}
                          title="Retirer du groupe"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                  {members.length < 3 && (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 11, padding: '2px 8px', marginTop: 4 }}
                      onClick={() => handleAddToGroupe(id)}
                    >
                      <Plus size={12} /> Ajouter un membre
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Selection */}
      <div className="binomes-creation">
        <h3>
          {addingToGroupe
            ? `Ajouter un membre au groupe (${addingToGroupe.members.map(m => m.prenom).join(', ')})`
            : selectedEleve
              ? `Choisir le partenaire de ${selectedEleve.prenom} ${selectedEleve.nom}`
              : 'Selectionnez un eleve pour creer un groupe'}
        </h3>

        {(selectedEleve || addingToGroupe) && (
          <div className="binome-search-area">
            {selectedEleve && (
              <div className="binome-selected-banner">
                <Users size={16} />
                <span>{selectedEleve.prenom} {selectedEleve.nom} ({selectedEleve.classe})</span>
                <button onClick={() => setSelectedEleveId(null)}><X size={14} /></button>
              </div>
            )}
            {addingToGroupe && (
              <div className="binome-selected-banner" style={{ borderColor: '#f59e0b' }}>
                <Users size={16} />
                <span>{addingToGroupe.members.map(m => `${m.prenom} ${m.nom}`).join(' & ')}</span>
                <button onClick={() => setAddingToGroupeId(null)}><X size={14} /></button>
              </div>
            )}
            <div className="binome-search-input">
              <Search size={14} />
              <input
                type="text"
                placeholder="Rechercher un eleve..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="binome-candidates">
              {availableForPairing.length === 0 ? (
                <p className="binome-empty">Aucun eleve disponible</p>
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

        {!selectedEleve && !addingToGroupe && (
          <div className="binome-eleves-list">
            {[...classeGroups.entries()].map(([classe, elevesClasse]) => {
              const available = elevesClasse.filter(e => !e.groupeOralId);
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
          {groupes.length > 0 ? 'Continuer' : 'Passer cette etape'}
        </button>
      </div>
    </div>
  );
};
