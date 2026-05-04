// ============================================================
// GUIDED STEP - SELECTION DES ELEVES (mode personnalise)
// ============================================================

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Users,
  Check,
  CheckSquare,
  Square,
  Filter,
  Search,
  X,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useEleveStore } from '../../../stores/eleveStore';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useUIStore } from '../../../stores/uiStore';
import type { Eleve } from '../../../domain/models';
import '../GuidedMode.css';

// ============================================================
// TYPES
// ============================================================

interface StepSelectElevesProps {
  onNext: () => void;
  onBack: () => void;
}

// ============================================================
// HELPERS
// ============================================================

/** Extrait le niveau depuis le nom de classe (ex: "3A" -> "3e", "6B" -> "6e") */
function extractNiveau(classe: string): string {
  const digits = classe.replace(/[^0-9]/g, '');
  return digits.length > 0 ? digits[0] + 'e' : '';
}

/** Trie les classes de maniere naturelle (6A < 6B < 5A < 4A < 3A) */
function sortClasses(a: string, b: string): number {
  const niveauA = extractNiveau(a);
  const niveauB = extractNiveau(b);
  if (niveauA !== niveauB) {
    // Ordre decroissant des niveaux: 6e, 5e, 4e, 3e
    const numA = parseInt(niveauA) || 0;
    const numB = parseInt(niveauB) || 0;
    return numB - numA;
  }
  return a.localeCompare(b, 'fr');
}

const NIVEAUX = ['6e', '5e', '4e', '3e'] as const;

// ============================================================
// MAIN COMPONENT
// ============================================================

export function StepSelectEleves({ onNext, onBack }: StepSelectElevesProps) {
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const { guidedMode, updateCustomConfig } = useUIStore();
  const customConfig = guidedMode.customConfig;

  // --- Local state ---
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    if (customConfig.selectedEleveIds.length > 0) {
      return new Set(customConfig.selectedEleveIds);
    }
    // Premier montage sans selection: selectionner tous les eleves
    return new Set(eleves.map(e => e.id));
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [collapsedClasses, setCollapsedClasses] = useState<Set<string>>(new Set());

  // --- Sync to store on change ---
  useEffect(() => {
    updateCustomConfig({ selectedEleveIds: Array.from(selectedIds) });
  }, [selectedIds, updateCustomConfig]);

  // --- Derived data ---
  const allClasses = useMemo(() => {
    const classes = new Set(eleves.map(e => e.classe));
    return Array.from(classes).sort(sortClasses);
  }, [eleves]);

  const allOptions = useMemo(() => {
    const options = new Set<string>();
    eleves.forEach(e => e.options.forEach(o => options.add(o)));
    return Array.from(options).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [eleves]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    eleves.forEach(e => e.tags.forEach(t => tags.add(t)));
    return Array.from(tags).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [eleves]);

  const allRegimes = useMemo(() => {
    const regimes = new Set<string>();
    eleves.forEach(e => {
      if (e.regime) regimes.add(e.regime);
    });
    return Array.from(regimes).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [eleves]);

  const niveauxPresents = useMemo(() => {
    const present = new Set(eleves.map(e => extractNiveau(e.classe)));
    return NIVEAUX.filter(n => present.has(n));
  }, [eleves]);

  const elevesByClasse = useMemo(() => {
    const map = new Map<string, Eleve[]>();
    for (const eleve of eleves) {
      const list = map.get(eleve.classe) || [];
      list.push(eleve);
      map.set(eleve.classe, list);
    }
    // Sort students within each class
    for (const [, list] of map) {
      list.sort((a, b) => {
        const cmp = a.nom.localeCompare(b.nom, 'fr');
        return cmp !== 0 ? cmp : a.prenom.localeCompare(b.prenom, 'fr');
      });
    }
    return map;
  }, [eleves]);

  /** Eleves filtres par la barre de recherche */
  const filteredEleves = useMemo(() => {
    if (!searchQuery.trim()) return eleves;
    const q = searchQuery.toLowerCase().trim();
    return eleves.filter(e =>
      e.nom.toLowerCase().includes(q) ||
      e.prenom.toLowerCase().includes(q) ||
      e.classe.toLowerCase().includes(q) ||
      e.options.some(o => o.toLowerCase().includes(q))
    );
  }, [eleves, searchQuery]);

  const filteredByClasse = useMemo(() => {
    const map = new Map<string, Eleve[]>();
    for (const eleve of filteredEleves) {
      const list = map.get(eleve.classe) || [];
      list.push(eleve);
      map.set(eleve.classe, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => {
        const cmp = a.nom.localeCompare(b.nom, 'fr');
        return cmp !== 0 ? cmp : a.prenom.localeCompare(b.prenom, 'fr');
      });
    }
    return map;
  }, [filteredEleves]);

  const sortedFilteredClasses = useMemo(
    () => Array.from(filteredByClasse.keys()).sort(sortClasses),
    [filteredByClasse]
  );

  // --- Selection helpers ---
  const toggleEleve = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(eleves.map(e => e.id)));
  }, [eleves]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleNiveau = useCallback((niveau: string) => {
    const niveauEleves = eleves.filter(e => extractNiveau(e.classe) === niveau);
    const niveauIds = niveauEleves.map(e => e.id);
    setSelectedIds(prev => {
      const allSelected = niveauIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        niveauIds.forEach(id => next.delete(id));
      } else {
        niveauIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [eleves]);

  const toggleClasse = useCallback((classe: string) => {
    const classeEleves = elevesByClasse.get(classe) || [];
    const classeIds = classeEleves.map(e => e.id);
    setSelectedIds(prev => {
      const allSelected = classeIds.every(id => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        classeIds.forEach(id => next.delete(id));
      } else {
        classeIds.forEach(id => next.add(id));
      }
      return next;
    });
  }, [elevesByClasse]);

  const selectByOption = useCallback((option: string) => {
    const matching = eleves.filter(e => e.options.includes(option));
    setSelectedIds(prev => {
      const next = new Set(prev);
      matching.forEach(e => next.add(e.id));
      return next;
    });
  }, [eleves]);

  const selectByTag = useCallback((tag: string) => {
    const matching = eleves.filter(e => e.tags.includes(tag));
    setSelectedIds(prev => {
      const next = new Set(prev);
      matching.forEach(e => next.add(e.id));
      return next;
    });
  }, [eleves]);

  const selectByRegime = useCallback((regime: string) => {
    const matching = eleves.filter(e => e.regime === regime);
    setSelectedIds(prev => {
      const next = new Set(prev);
      matching.forEach(e => next.add(e.id));
      return next;
    });
  }, [eleves]);

  const selectByEnseignant = useCallback((enseignantId: string) => {
    const ens = enseignants.find(e => e.id === enseignantId);
    if (!ens) return;
    const matching = eleves.filter(e => ens.classesEnCharge.includes(e.classe));
    setSelectedIds(prev => {
      const next = new Set(prev);
      matching.forEach(e => next.add(e.id));
      return next;
    });
  }, [eleves, enseignants]);

  const selectNotByEnseignant = useCallback((enseignantId: string) => {
    const ens = enseignants.find(e => e.id === enseignantId);
    if (!ens) return;
    const matching = eleves.filter(e => !ens.classesEnCharge.includes(e.classe));
    setSelectedIds(prev => {
      const next = new Set(prev);
      matching.forEach(e => next.add(e.id));
      return next;
    });
  }, [eleves, enseignants]);

  const toggleCollapseClasse = useCallback((classe: string) => {
    setCollapsedClasses(prev => {
      const next = new Set(prev);
      if (next.has(classe)) {
        next.delete(classe);
      } else {
        next.add(classe);
      }
      return next;
    });
  }, []);

  // --- Counts ---
  const isNiveauFullySelected = useCallback((niveau: string) => {
    const niveauEleves = eleves.filter(e => extractNiveau(e.classe) === niveau);
    return niveauEleves.length > 0 && niveauEleves.every(e => selectedIds.has(e.id));
  }, [eleves, selectedIds]);

  const isNiveauPartiallySelected = useCallback((niveau: string) => {
    const niveauEleves = eleves.filter(e => extractNiveau(e.classe) === niveau);
    const count = niveauEleves.filter(e => selectedIds.has(e.id)).length;
    return count > 0 && count < niveauEleves.length;
  }, [eleves, selectedIds]);

  const isClasseFullySelected = useCallback((classe: string) => {
    const classeEleves = elevesByClasse.get(classe) || [];
    return classeEleves.length > 0 && classeEleves.every(e => selectedIds.has(e.id));
  }, [elevesByClasse, selectedIds]);

  const countClasseSelected = useCallback((classe: string) => {
    const classeEleves = elevesByClasse.get(classe) || [];
    return classeEleves.filter(e => selectedIds.has(e.id)).length;
  }, [elevesByClasse, selectedIds]);

  const allSelected = selectedIds.size === eleves.length && eleves.length > 0;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="guided-step step-select-eleves" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', flexShrink: 0 }}>
        <h1 className="step-title">
          <Users size={28} style={{ verticalAlign: 'middle', marginRight: 8 }} />
          Selectionnez les eleves
        </h1>
        <p className="step-subtitle">
          Choisissez les eleves a inclure dans votre scenario de groupement.
        </p>
      </div>

      {/* Stats bar */}
      <div className="step-select-eleves-stats" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.75rem',
        padding: '0.625rem 1rem',
        background: 'rgba(59, 130, 246, 0.1)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '10px',
        marginBottom: '0.75rem',
        flexShrink: 0,
      }}>
        <Users size={18} style={{ color: '#3b82f6' }} />
        <span style={{ color: '#93c5fd', fontWeight: 600, fontSize: '0.9rem' }}>
          {selectedIds.size} / {eleves.length} eleves selectionnes
        </span>
        {selectedIds.size === 0 && (
          <span style={{ color: '#f87171', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
            — Selectionnez au moins un eleve pour continuer
          </span>
        )}
      </div>

      {/* Quick selection bar */}
      <div className="step-select-eleves-quick" style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.5rem',
        alignItems: 'center',
        marginBottom: '0.5rem',
        flexShrink: 0,
      }}>
        {/* Tout / Rien */}
        <button
          onClick={allSelected ? deselectAll : selectAll}
          style={{
            ...btnStyle,
            background: allSelected ? 'rgba(34, 197, 94, 0.15)' : 'rgba(255,255,255,0.06)',
            borderColor: allSelected ? 'rgba(34, 197, 94, 0.4)' : 'rgba(255,255,255,0.15)',
            color: allSelected ? '#4ade80' : '#cbd5e1',
          }}
        >
          {allSelected ? <Check size={14} /> : <CheckSquare size={14} />}
          {allSelected ? 'Tout deselectionner' : 'Tout selectionner'}
        </button>

        {/* Separateur */}
        <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />

        {/* Par niveau */}
        {niveauxPresents.map(niveau => {
          const full = isNiveauFullySelected(niveau);
          const partial = isNiveauPartiallySelected(niveau);
          return (
            <button
              key={niveau}
              onClick={() => toggleNiveau(niveau)}
              style={{
                ...btnStyle,
                background: full
                  ? 'rgba(59, 130, 246, 0.2)'
                  : partial
                    ? 'rgba(59, 130, 246, 0.1)'
                    : 'rgba(255,255,255,0.06)',
                borderColor: full
                  ? 'rgba(59, 130, 246, 0.5)'
                  : partial
                    ? 'rgba(59, 130, 246, 0.3)'
                    : 'rgba(255,255,255,0.15)',
                color: full ? '#93c5fd' : partial ? '#93c5fd' : '#cbd5e1',
              }}
            >
              {full ? <Check size={14} /> : null}
              {niveau}
            </button>
          );
        })}

        {/* Separateur */}
        {allClasses.length > 0 && (
          <span style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.15)' }} />
        )}

        {/* Par classe */}
        {allClasses.map(classe => {
          const full = isClasseFullySelected(classe);
          const count = countClasseSelected(classe);
          const total = (elevesByClasse.get(classe) || []).length;
          return (
            <button
              key={classe}
              onClick={() => toggleClasse(classe)}
              title={`${count}/${total} selectionnes`}
              style={{
                ...btnSmallStyle,
                background: full
                  ? 'rgba(59, 130, 246, 0.2)'
                  : count > 0
                    ? 'rgba(59, 130, 246, 0.08)'
                    : 'rgba(255,255,255,0.04)',
                borderColor: full
                  ? 'rgba(59, 130, 246, 0.5)'
                  : count > 0
                    ? 'rgba(59, 130, 246, 0.2)'
                    : 'rgba(255,255,255,0.1)',
                color: full ? '#93c5fd' : count > 0 ? '#93c5fd' : '#94a3b8',
              }}
            >
              {full && <Check size={12} />}
              {classe}
            </button>
          );
        })}
      </div>

      {/* Advanced filters toggle */}
      <button
        onClick={() => setShowAdvancedFilters(prev => !prev)}
        style={{
          ...btnStyle,
          alignSelf: 'flex-start',
          marginBottom: '0.5rem',
          color: showAdvancedFilters ? '#93c5fd' : '#94a3b8',
          background: showAdvancedFilters ? 'rgba(59,130,246,0.1)' : 'transparent',
          borderColor: showAdvancedFilters ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.1)',
          flexShrink: 0,
        }}
      >
        <Filter size={14} />
        Filtres avances
        {showAdvancedFilters ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {/* Advanced filters panel */}
      {showAdvancedFilters && (
        <div className="step-select-eleves-advanced" style={{
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px',
          padding: '0.75rem',
          marginBottom: '0.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.625rem',
          flexShrink: 0,
          maxHeight: '200px',
          overflowY: 'auto',
        }}>
          {/* Par option */}
          {allOptions.length > 0 && (
            <div>
              <span style={filterLabelStyle}>Par option :</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                {allOptions.map(option => (
                  <button
                    key={option}
                    onClick={() => selectByOption(option)}
                    style={btnSmallStyle}
                    title={`Ajouter les eleves ayant l'option "${option}"`}
                  >
                    + {option}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Par enseignant */}
          {enseignants.length > 0 && (
            <div>
              <span style={filterLabelStyle}>Par enseignant :</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                {enseignants
                  .filter(e => e.classesEnCharge.length > 0)
                  .sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
                  .map(ens => (
                    <span key={ens.id} style={{ display: 'inline-flex', gap: '2px' }}>
                      <button
                        onClick={() => selectByEnseignant(ens.id)}
                        style={btnSmallStyle}
                        title={`Ajouter les eleves de ${ens.prenom} ${ens.nom} (classes: ${ens.classesEnCharge.join(', ')})`}
                      >
                        + {ens.nom} {ens.prenom[0]}.
                      </button>
                      <button
                        onClick={() => selectNotByEnseignant(ens.id)}
                        style={{
                          ...btnSmallStyle,
                          color: '#f87171',
                          borderColor: 'rgba(248, 113, 113, 0.2)',
                        }}
                        title={`Ajouter les eleves n'ayant PAS ${ens.prenom} ${ens.nom}`}
                      >
                        <X size={10} />
                      </button>
                    </span>
                  ))}
              </div>
            </div>
          )}

          {/* Par tag */}
          {allTags.length > 0 && (
            <div>
              <span style={filterLabelStyle}>Par tag :</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                {allTags.map(tag => (
                  <button
                    key={tag}
                    onClick={() => selectByTag(tag)}
                    style={btnSmallStyle}
                    title={`Ajouter les eleves ayant le tag "${tag}"`}
                  >
                    + {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Par regime */}
          {allRegimes.length > 0 && (
            <div>
              <span style={filterLabelStyle}>Par regime :</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginTop: '0.25rem' }}>
                {allRegimes.map(regime => (
                  <button
                    key={regime}
                    onClick={() => selectByRegime(regime)}
                    style={btnSmallStyle}
                    title={`Ajouter les eleves en regime "${regime}"`}
                  >
                    + {regime}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Search bar */}
      <div className="step-select-eleves-search" style={{
        position: 'relative',
        marginBottom: '0.5rem',
        flexShrink: 0,
      }}>
        <Search size={16} style={{
          position: 'absolute',
          left: 12,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#64748b',
        }} />
        <input
          type="text"
          placeholder="Rechercher un eleve (nom, prenom, classe, option)..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '0.625rem 2.25rem 0.625rem 2.25rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: '#e2e8f0',
            fontSize: '0.875rem',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 4,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Student list grouped by class */}
      <div className="step-select-eleves-list" style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '10px',
        background: 'rgba(0,0,0,0.15)',
      }}>
        {sortedFilteredClasses.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '2rem',
            color: '#94a3b8',
            fontSize: '0.9rem',
          }}>
            {eleves.length === 0
              ? 'Aucun eleve importe.'
              : 'Aucun eleve ne correspond a la recherche.'}
          </div>
        ) : (
          sortedFilteredClasses.map(classe => {
            const classeEleves = filteredByClasse.get(classe) || [];
            const selectedCount = classeEleves.filter(e => selectedIds.has(e.id)).length;
            const total = classeEleves.length;
            const allClasseSelected = selectedCount === total;
            const collapsed = collapsedClasses.has(classe);

            return (
              <div key={classe} className="step-select-eleves-classe-group">
                {/* Class header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem 0.75rem',
                    background: 'rgba(255,255,255,0.04)',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    cursor: 'pointer',
                    userSelect: 'none',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1,
                  }}
                  onClick={() => toggleCollapseClasse(classe)}
                >
                  {collapsed ? <ChevronRight size={14} style={{ color: '#94a3b8' }} /> : <ChevronDown size={14} style={{ color: '#94a3b8' }} />}

                  {/* Classe-level checkbox */}
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      toggleClasse(classe);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      display: 'flex',
                      alignItems: 'center',
                      color: allClasseSelected ? '#3b82f6' : selectedCount > 0 ? '#60a5fa' : '#64748b',
                    }}
                  >
                    {allClasseSelected ? <CheckSquare size={16} /> : <Square size={16} />}
                  </button>

                  <span style={{
                    fontWeight: 600,
                    color: '#e2e8f0',
                    fontSize: '0.875rem',
                    flex: 1,
                  }}>
                    Classe {classe}
                  </span>
                  <span style={{
                    fontSize: '0.75rem',
                    color: selectedCount === total ? '#4ade80' : selectedCount > 0 ? '#93c5fd' : '#64748b',
                    fontWeight: 500,
                  }}>
                    {selectedCount}/{total}
                  </span>
                </div>

                {/* Students in class */}
                {!collapsed && classeEleves.map(eleve => {
                  const isSelected = selectedIds.has(eleve.id);
                  return (
                    <div
                      key={eleve.id}
                      onClick={() => toggleEleve(eleve.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.375rem 0.75rem 0.375rem 2.25rem',
                        cursor: 'pointer',
                        borderBottom: '1px solid rgba(255,255,255,0.03)',
                        background: isSelected ? 'rgba(59, 130, 246, 0.06)' : 'transparent',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = isSelected
                          ? 'rgba(59, 130, 246, 0.1)'
                          : 'rgba(255,255,255,0.04)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = isSelected
                          ? 'rgba(59, 130, 246, 0.06)'
                          : 'transparent';
                      }}
                    >
                      {/* Checkbox */}
                      <span style={{
                        color: isSelected ? '#3b82f6' : '#475569',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                      }}>
                        {isSelected ? <CheckSquare size={15} /> : <Square size={15} />}
                      </span>

                      {/* Name */}
                      <span style={{
                        color: isSelected ? '#e2e8f0' : '#94a3b8',
                        fontSize: '0.835rem',
                        fontWeight: isSelected ? 500 : 400,
                        flex: 1,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {eleve.nom.toUpperCase()} {eleve.prenom}
                      </span>

                      {/* Class badge */}
                      <span style={{
                        fontSize: '0.7rem',
                        color: '#64748b',
                        background: 'rgba(255,255,255,0.05)',
                        padding: '0.125rem 0.375rem',
                        borderRadius: '4px',
                        flexShrink: 0,
                      }}>
                        {eleve.classe}
                      </span>

                      {/* Options */}
                      {eleve.options.length > 0 && (
                        <span style={{
                          fontSize: '0.7rem',
                          color: '#818cf8',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '150px',
                          flexShrink: 1,
                        }}>
                          {eleve.options.join(', ')}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="step-select-eleves-footer" style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: '0.75rem',
        marginTop: '0.5rem',
        borderTop: '1px solid rgba(255,255,255,0.1)',
        flexShrink: 0,
      }}>
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.625rem 1.25rem',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '8px',
            color: '#cbd5e1',
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          Retour
        </button>

        <button
          onClick={onNext}
          disabled={selectedIds.size === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.625rem 1.5rem',
            background: selectedIds.size > 0
              ? 'linear-gradient(135deg, #3b82f6, #2563eb)'
              : 'rgba(255,255,255,0.06)',
            border: '1px solid',
            borderColor: selectedIds.size > 0 ? '#3b82f6' : 'rgba(255,255,255,0.1)',
            borderRadius: '8px',
            color: selectedIds.size > 0 ? 'white' : '#64748b',
            fontSize: '0.9rem',
            fontWeight: 600,
            cursor: selectedIds.size > 0 ? 'pointer' : 'not-allowed',
            opacity: selectedIds.size > 0 ? 1 : 0.6,
            transition: 'all 0.2s',
          }}
        >
          <Check size={16} />
          Suivant ({selectedIds.size} eleve{selectedIds.size > 1 ? 's' : ''})
        </button>
      </div>
    </div>
  );
}

// ============================================================
// SHARED INLINE STYLES
// ============================================================

const btnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.375rem',
  padding: '0.375rem 0.75rem',
  background: 'rgba(255,255,255,0.06)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '6px',
  color: '#cbd5e1',
  fontSize: '0.8rem',
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
};

const btnSmallStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '0.25rem',
  padding: '0.25rem 0.5rem',
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '5px',
  color: '#94a3b8',
  fontSize: '0.725rem',
  cursor: 'pointer',
  transition: 'all 0.15s',
  whiteSpace: 'nowrap',
};

const filterLabelStyle: React.CSSProperties = {
  fontSize: '0.775rem',
  fontWeight: 600,
  color: '#94a3b8',
  textTransform: 'uppercase',
  letterSpacing: '0.03em',
};
