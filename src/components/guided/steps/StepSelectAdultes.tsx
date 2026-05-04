// ============================================================
// GUIDED STEP - SELECTION DES ADULTES DE REFERENCE
// ============================================================

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  GraduationCap,
  Check,
  CheckSquare,
  Square,
  Search,
  Users,
  Star,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import clsx from 'clsx';
import { useEnseignantStore } from '../../../stores/enseignantStore';
import { useEleveStore } from '../../../stores/eleveStore';
import { useUIStore } from '../../../stores/uiStore';
import type { Enseignant } from '../../../domain/models';
import '../GuidedMode.css';

interface StepSelectAdultesProps {
  onNext: () => void;
  onBack: () => void;
}

// ============================================================
// HELPERS
// ============================================================

/** Extract the niveau prefix from a class name (e.g. "3A" -> "3e", "6B" -> "6e") */
function extractNiveau(classe: string): string | null {
  const match = classe.match(/^(\d)/);
  if (!match) return null;
  return `${match[1]}e`;
}

/** Get all distinct niveaux from an array of class names */
function getDistinctNiveaux(classes: string[]): string[] {
  const niveaux = new Set<string>();
  for (const c of classes) {
    const n = extractNiveau(c);
    if (n) niveaux.add(n);
  }
  return [...niveaux].sort();
}

/** Get all distinct matieres from enseignants */
function getDistinctMatieres(enseignants: Enseignant[]): string[] {
  const matieres = new Set<string>();
  for (const e of enseignants) {
    if (e.matierePrincipale) matieres.add(e.matierePrincipale);
  }
  return [...matieres].sort((a, b) => a.localeCompare(b, 'fr'));
}

// ============================================================
// COMPONENT
// ============================================================

export function StepSelectAdultes({ onNext, onBack }: StepSelectAdultesProps) {
  const enseignants = useEnseignantStore(state => state.enseignants);
  const eleves = useEleveStore(state => state.eleves);
  const { guidedMode, updateCustomConfig } = useUIStore();
  const customConfig = guidedMode.customConfig;

  // ----- Local state -----
  const [searchQuery, setSearchQuery] = useState('');
  const [advancedFilter, setAdvancedFilter] = useState<'none' | 'with_eleves' | 'without_eleves'>('none');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    // Initialize from store; if empty and useAdultes, select all
    if (customConfig.selectedEnseignantIds.length > 0) {
      return new Set(customConfig.selectedEnseignantIds);
    }
    if (customConfig.useAdultes) {
      return new Set(enseignants.map(e => e.id));
    }
    return new Set<string>();
  });
  const [noAdultes, setNoAdultes] = useState(!customConfig.useAdultes);
  const [role, setRole] = useState(customConfig.adulteRole);

  // ----- Derived data -----
  const distinctMatieres = useMemo(() => getDistinctMatieres(enseignants), [enseignants]);

  const allClasses = useMemo(() => {
    const classes = new Set<string>();
    for (const e of enseignants) {
      for (const c of e.classesEnCharge) classes.add(c);
    }
    return [...classes].sort((a, b) => a.localeCompare(b, 'fr'));
  }, [enseignants]);

  const distinctNiveaux = useMemo(() => getDistinctNiveaux(allClasses), [allClasses]);

  // Classes of selected eleves (from previous step)
  const selectedEleveClasses = useMemo(() => {
    const ids = new Set(customConfig.selectedEleveIds);
    const classes = new Set<string>();
    for (const e of eleves) {
      if (ids.has(e.id)) classes.add(e.classe);
    }
    return classes;
  }, [eleves, customConfig.selectedEleveIds]);

  // ----- Filtering -----
  const filteredEnseignants = useMemo(() => {
    let list = enseignants;

    // Advanced filter: teachers whose classesEnCharge overlap with selected students' classes
    if (advancedFilter === 'with_eleves' && selectedEleveClasses.size > 0) {
      list = list.filter(e => e.classesEnCharge.some(c => selectedEleveClasses.has(c)));
    } else if (advancedFilter === 'without_eleves' && selectedEleveClasses.size > 0) {
      list = list.filter(e => !e.classesEnCharge.some(c => selectedEleveClasses.has(c)));
    }

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(e =>
        e.nom.toLowerCase().includes(q) ||
        e.prenom.toLowerCase().includes(q) ||
        e.matierePrincipale?.toLowerCase().includes(q)
      );
    }

    return list;
  }, [enseignants, searchQuery, advancedFilter, selectedEleveClasses]);

  // ----- Sync to store on changes -----
  useEffect(() => {
    updateCustomConfig({
      useAdultes: !noAdultes,
      adulteRole: role,
      selectedEnseignantIds: [...selectedIds],
    });
  }, [selectedIds, noAdultes, role, updateCustomConfig]);

  // ----- Handlers -----
  const toggleId = useCallback((id: string) => {
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
    setSelectedIds(new Set(enseignants.map(e => e.id)));
  }, [enseignants]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const selectPPOnly = useCallback(() => {
    setSelectedIds(new Set(enseignants.filter(e => e.estProfPrincipal).map(e => e.id)));
  }, [enseignants]);

  const selectByMatiere = useCallback((matiere: string) => {
    const ids = enseignants.filter(e => e.matierePrincipale === matiere).map(e => e.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      // If all of this matiere are already selected, deselect them; otherwise add them
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, [enseignants]);

  const selectByNiveau = useCallback((niveau: string) => {
    const prefix = niveau.replace('e', '');
    const ids = enseignants
      .filter(e => e.classesEnCharge.some(c => c.startsWith(prefix)))
      .map(e => e.id);
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = ids.every(id => next.has(id));
      if (allSelected) {
        for (const id of ids) next.delete(id);
      } else {
        for (const id of ids) next.add(id);
      }
      return next;
    });
  }, [enseignants]);

  const handleToggleNoAdultes = useCallback(() => {
    setNoAdultes(prev => !prev);
  }, []);

  const handleRoleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setRole(e.target.value);
  }, []);

  const canProceed = noAdultes || selectedIds.size > 0;

  // ============================================================
  // RENDER
  // ============================================================

  return (
    <div className="guided-step step-select-adultes">
      <h1 className="step-title">
        <GraduationCap size={28} />
        Adultes de reference
      </h1>
      <p className="step-subtitle">
        Selectionnez les enseignants qui seront affectes aux groupes.
      </p>

      {/* ---- Opt-out toggle ---- */}
      <div
        className={clsx('step-select-adultes-optout', noAdultes && 'active')}
        onClick={handleToggleNoAdultes}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleToggleNoAdultes(); }}
      >
        {noAdultes ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
        <span className="step-select-adultes-optout-label">
          Pas d'adultes de reference pour ce projet
        </span>
      </div>

      {noAdultes && (
        <div className="step-select-adultes-optout-message">
          Les groupes seront constitues uniquement d'eleves.
        </div>
      )}

      {/* ---- Everything below is disabled when noAdultes ---- */}
      <div className={clsx('step-select-adultes-body', noAdultes && 'disabled')}>

        {/* Role input */}
        <div className="step-select-adultes-role">
          <label htmlFor="adulte-role">Role des adultes</label>
          <input
            id="adulte-role"
            type="text"
            value={role}
            onChange={handleRoleChange}
            placeholder="Ex: Tuteur, Jury, Encadrant..."
            disabled={noAdultes}
          />
        </div>

        {/* Stats bar */}
        <div className="step-select-adultes-stats">
          <Users size={18} />
          <span>
            <strong>{selectedIds.size}</strong> / {enseignants.length} enseignant{enseignants.length !== 1 ? 's' : ''} selectionne{selectedIds.size !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Quick selection buttons */}
        <div className="step-select-adultes-quick">
          <div className="step-select-adultes-quick-row">
            <button
              className="btn btn-sm btn-outline"
              onClick={selectAll}
              disabled={noAdultes}
            >
              Tout selectionner
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={deselectAll}
              disabled={noAdultes}
            >
              Tout deselectionner
            </button>
            <button
              className="btn btn-sm btn-outline"
              onClick={selectPPOnly}
              disabled={noAdultes}
            >
              <Star size={14} />
              Seulement les PP
            </button>
          </div>

          {/* By matiere */}
          {distinctMatieres.length > 0 && (
            <div className="step-select-adultes-quick-group">
              <span className="step-select-adultes-quick-group-label">Par matiere :</span>
              <div className="step-select-adultes-chips">
                {distinctMatieres.map(m => {
                  const matiereIds = enseignants.filter(e => e.matierePrincipale === m).map(e => e.id);
                  const allSelected = matiereIds.every(id => selectedIds.has(id));
                  return (
                    <button
                      key={m}
                      className={clsx('step-select-adultes-chip', allSelected && 'selected')}
                      onClick={() => selectByMatiere(m)}
                      disabled={noAdultes}
                    >
                      {allSelected && <Check size={12} />}
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* By niveau */}
          {distinctNiveaux.length > 0 && (
            <div className="step-select-adultes-quick-group">
              <span className="step-select-adultes-quick-group-label">Par niveau enseigne :</span>
              <div className="step-select-adultes-chips">
                {distinctNiveaux.map(n => {
                  const prefix = n.replace('e', '');
                  const niveauIds = enseignants
                    .filter(e => e.classesEnCharge.some(c => c.startsWith(prefix)))
                    .map(e => e.id);
                  const allSelected = niveauIds.length > 0 && niveauIds.every(id => selectedIds.has(id));
                  return (
                    <button
                      key={n}
                      className={clsx('step-select-adultes-chip', allSelected && 'selected')}
                      onClick={() => selectByNiveau(n)}
                      disabled={noAdultes}
                    >
                      {allSelected && <Check size={12} />}
                      {n}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Advanced filters */}
        <div className="step-select-adultes-advanced">
          <div className="step-select-adultes-advanced-row">
            <button
              className={clsx('btn btn-sm btn-outline', advancedFilter === 'with_eleves' && 'active')}
              onClick={() => setAdvancedFilter(prev => prev === 'with_eleves' ? 'none' : 'with_eleves')}
              disabled={noAdultes || selectedEleveClasses.size === 0}
              title={selectedEleveClasses.size === 0 ? 'Aucun eleve selectionne a l\'etape precedente' : undefined}
            >
              Enseignants ayant les eleves selectionnes
            </button>
            <button
              className={clsx('btn btn-sm btn-outline', advancedFilter === 'without_eleves' && 'active')}
              onClick={() => setAdvancedFilter(prev => prev === 'without_eleves' ? 'none' : 'without_eleves')}
              disabled={noAdultes || selectedEleveClasses.size === 0}
              title={selectedEleveClasses.size === 0 ? 'Aucun eleve selectionne a l\'etape precedente' : undefined}
            >
              Enseignants n'ayant PAS les eleves
            </button>
          </div>

          {/* Search */}
          <div className="step-select-adultes-search">
            <Search size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Rechercher par nom, prenom, matiere..."
              disabled={noAdultes}
            />
          </div>
        </div>

        {/* Teacher list */}
        <div className="step-select-adultes-list">
          {filteredEnseignants.length === 0 ? (
            <div className="step-select-adultes-empty">
              Aucun enseignant ne correspond aux filtres.
            </div>
          ) : (
            filteredEnseignants.map(ens => {
              const isSelected = selectedIds.has(ens.id);
              return (
                <div
                  key={ens.id}
                  className={clsx('step-select-adultes-row', isSelected && 'selected')}
                  onClick={() => !noAdultes && toggleId(ens.id)}
                  role="button"
                  tabIndex={noAdultes ? -1 : 0}
                  onKeyDown={e => { if (!noAdultes && (e.key === 'Enter' || e.key === ' ')) toggleId(ens.id); }}
                >
                  <span className="step-select-adultes-check">
                    {isSelected ? <CheckSquare size={18} /> : <Square size={18} />}
                  </span>
                  <span className="step-select-adultes-name">
                    {ens.prenom} {ens.nom}
                  </span>
                  <span className="step-select-adultes-matiere">
                    {ens.matierePrincipale || '-'}
                  </span>
                  <span className="step-select-adultes-classes">
                    {ens.classesEnCharge.length > 0 ? ens.classesEnCharge.join(', ') : '-'}
                  </span>
                  {ens.estProfPrincipal && (
                    <span className="step-select-adultes-pp" title={`Prof principal ${ens.classePP || ''}`}>
                      <Star size={14} />
                      PP{ens.classePP ? ` ${ens.classePP}` : ''}
                    </span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ---- Footer actions ---- */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary"
          onClick={onNext}
          disabled={!canProceed}
        >
          Suivant
        </button>
      </div>
    </div>
  );
}
