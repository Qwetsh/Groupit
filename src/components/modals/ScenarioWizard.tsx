// ============================================================
// WIZARD - CRÉATION DE CONFIGURATION (pas-à-pas)
// ============================================================

import { useState, useMemo, useEffect } from 'react';
import {
  X, ChevronLeft, ChevronRight, Check, Mic, Briefcase, Users,
  GraduationCap, Search, Star, Filter, CheckSquare, Square, Settings2
} from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import type { ScenarioType, CritereInstance, Niveau } from '../../domain/models';
import { createDefaultCriteres, getEffectiveCriteres } from '../../domain/models';
import { CriteresEditor } from './CriteresEditor';
import './ScenarioWizard.css';

interface ScenarioWizardProps {
  onClose: () => void;
  onComplete?: (scenarioId: string) => void;
}

// Types disponibles
const TYPES_CONFIG = [
  {
    value: 'oral_dnb' as ScenarioType,
    label: 'Oral du DNB',
    description: 'Répartir les élèves de 3e dans des jurys pour les oraux du brevet',
    icon: <Mic size={32} />,
    color: '#8b5cf6',
  },
  {
    value: 'suivi_stage' as ScenarioType,
    label: 'Suivi de stage',
    description: 'Affecter chaque élève stagiaire à un enseignant tuteur',
    icon: <Briefcase size={32} />,
    color: '#3b82f6',
  },
  {
    value: 'custom' as ScenarioType,
    label: 'Configuration libre',
    description: 'Choisir librement les élèves, enseignants et critères de répartition',
    icon: <Settings2 size={32} />,
    color: '#10b981',
  },
];

// Nombre total d'étapes
const TOTAL_STEPS = 5;

export function ScenarioWizard({ onClose, onComplete }: ScenarioWizardProps) {
  // Stores
  const addScenario = useScenarioStore(state => state.addScenario);
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);

  // Wizard state
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Type
  const [selectedType, setSelectedType] = useState<ScenarioType | null>(null);

  // Step 2: Nom et paramètres de base
  const [nom, setNom] = useState('');
  const [description, setDescription] = useState('');
  const [capaciteJury, setCapaciteJury] = useState(15);

  // Options spécifiques au mode custom
  const [selectedNiveaux, setSelectedNiveaux] = useState<Set<Niveau>>(new Set(['3e', '4e', '5e', '6e']));
  const [useJurys, setUseJurys] = useState(false);

  // Step 3: Enseignants - NOUVEAU MODÈLE
  // Tous les enseignants sont sélectionnés par défaut
  const [selectedEnseignantIds, setSelectedEnseignantIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialiser avec tous les enseignants sélectionnés
  useEffect(() => {
    if (enseignants.length > 0 && !isInitialized) {
      const allIds = new Set(enseignants.map(e => e.id!).filter(Boolean));
      setSelectedEnseignantIds(allIds);
      setIsInitialized(true);
    }
  }, [enseignants, isInitialized]);

  // Step 4: Critères
  const [criteres, setCriteres] = useState<CritereInstance[]>([]);

  // Initialiser les critères quand le type change
  useEffect(() => {
    if (selectedType) {
      setCriteres(createDefaultCriteres(selectedType));
    }
  }, [selectedType]);

  // Extraire les valeurs uniques pour les filtres enseignants
  const distinctMatieres = useMemo(() =>
    [...new Set(enseignants.map(e => e.matierePrincipale))].filter(Boolean).sort(), [enseignants]);

  const distinctNiveaux = useMemo(() => {
    const niveaux = new Set<string>();
    enseignants.forEach(e => {
      e.classesEnCharge?.forEach(c => {
        const niveau = c.replace(/[^0-9]/g, '')[0];
        if (niveau) niveaux.add(niveau + 'e');
      });
    });
    return [...niveaux].sort((a, b) => parseInt(b) - parseInt(a)) as Niveau[];
  }, [enseignants]);

  // Enseignants filtrés par recherche
  const displayedEnseignants = useMemo(() => {
    if (!searchQuery.trim()) return enseignants;
    const query = searchQuery.toLowerCase();
    return enseignants.filter(e =>
      e.nom.toLowerCase().includes(query) ||
      e.prenom?.toLowerCase().includes(query) ||
      e.matierePrincipale?.toLowerCase().includes(query)
    );
  }, [enseignants, searchQuery]);

  // Computed values
  const eleveCount = useMemo(() => {
    if (selectedType === 'suivi_stage') {
      return eleves.filter(e => e.classe?.startsWith('3')).length;
    }
    if (selectedType === 'custom') {
      return eleves.filter(e => {
        const niveau = e.classe?.replace(/[^0-9]/g, '')[0];
        return niveau && selectedNiveaux.has((niveau + 'e') as Niveau);
      }).length;
    }
    return eleves.length;
  }, [eleves, selectedType, selectedNiveaux]);

  const canProceed = useMemo(() => {
    switch (step) {
      case 1:
        return selectedType !== null;
      case 2:
        // Pour custom, il faut au moins un niveau sélectionné
        if (selectedType === 'custom' && selectedNiveaux.size === 0) return false;
        return nom.trim().length > 0;
      case 3:
        return selectedEnseignantIds.size > 0;
      case 4:
        return true;
      case 5:
        return true;
      default:
        return false;
    }
  }, [step, selectedType, nom, selectedEnseignantIds.size, selectedNiveaux.size]);

  // === ACTIONS ENSEIGNANTS ===

  const toggleEnseignant = (id: string) => {
    setSelectedEnseignantIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    const allIds = new Set(enseignants.map(e => e.id!).filter(Boolean));
    setSelectedEnseignantIds(allIds);
  };

  const deselectAll = () => {
    setSelectedEnseignantIds(new Set());
  };

  // Actions de masse par critère
  const selectOnlyPP = () => {
    const ppIds = new Set(
      enseignants.filter(e => e.estProfPrincipal).map(e => e.id!).filter(Boolean)
    );
    setSelectedEnseignantIds(ppIds);
  };

  const selectOnlyNiveau = (niveau: Niveau) => {
    const niveauIds = new Set(
      enseignants.filter(e =>
        e.classesEnCharge?.some(c => {
          const n = c.replace(/[^0-9]/g, '')[0] + 'e';
          return n === niveau;
        })
      ).map(e => e.id!).filter(Boolean)
    );
    setSelectedEnseignantIds(niveauIds);
  };

  const selectOnlyMatiere = (matiere: string) => {
    const matiereIds = new Set(
      enseignants.filter(e => e.matierePrincipale === matiere).map(e => e.id!).filter(Boolean)
    );
    setSelectedEnseignantIds(matiereIds);
  };

  // === NAVIGATION ===

  const handleNext = () => {
    if (step < TOTAL_STEPS && canProceed) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // === SUBMIT ===

  const handleSubmit = async () => {
    if (!selectedType || !nom.trim()) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const effectiveCriteres = getEffectiveCriteres(selectedType, criteres);

      // Si tous les enseignants sont sélectionnés, pas besoin de filtre
      const allSelected = selectedEnseignantIds.size === enseignants.length;
      const enseignantIdsArray = allSelected ? [] : Array.from(selectedEnseignantIds);

      const scenarioData = {
        nom: nom.trim(),
        description: description.trim() || undefined,
        mode: 'matching' as const,
        type: selectedType,
        parametres: {
          criteresV2: effectiveCriteres,
          criteres: [], // Legacy
          capaciteConfig: {
            capaciteBaseDefaut: selectedType === 'oral_dnb' ? 15 : 5,
            coefficients: { '6e': 0, '5e': 0, '4e': 0.5, '3e': 1 },
          },
          equilibrageActif: true,
          // Filtres élèves selon le type
          filtresEleves: selectedType === 'suivi_stage' ? {
            niveaux: ['3e'] as Niveau[],
            classes: [],
          } : selectedType === 'custom' ? {
            niveaux: Array.from(selectedNiveaux) as Niveau[],
            classes: [],
          } : undefined,
          // Filtres enseignants seulement si sélection partielle
          filtresEnseignants: enseignantIdsArray.length > 0 ? {
            matieres: [],
            classesEnCharge: [],
            niveauxEnCharge: [],
            ppOnly: false,
            enseignantIds: enseignantIdsArray,
          } : undefined,
          oralDnb: selectedType === 'oral_dnb' ? {
            matieresAutorisees: ['Français', 'Mathématiques', 'Histoire-Géographie', 'SVT', 'Physique-Chimie', 'Technologie', 'Arts Plastiques', 'Éducation Musicale', 'EPS', 'Langues'],
            utiliserJurys: false,
            poidsMatiere: 80,
            criteresSecondaires: ['equilibrage', 'capacite'] as ('equilibrage' | 'parite' | 'capacite')[],
            capaciteJuryDefaut: capaciteJury,
          } : undefined,
          suiviStage: selectedType === 'suivi_stage' ? {
            distanceMaxKm: 30,
            dureeMaxMin: 45,
            prioriserPP: true,
            capaciteTuteurDefaut: 5,
            utiliserCapaciteCalculee: true,
          } : undefined,
          // Options custom
          custom: selectedType === 'custom' ? {
            utiliserJurys: useJurys,
            capaciteDefaut: useJurys ? capaciteJury : 5,
            niveaux: Array.from(selectedNiveaux) as Niveau[],
          } : undefined,
        },
      };

      const newScenario = await addScenario(scenarioData);

      if (onComplete && newScenario?.id) {
        onComplete(newScenario.id);
      }

      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Labels des étapes
  const stepLabels = ['Type', 'Nom', 'Enseignants', 'Critères', 'Confirmer'];

  return (
    <div className="wizard-overlay" onClick={onClose}>
      <div className="wizard-container wizard-5-steps" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="wizard-header">
          <div className="wizard-progress">
            {stepLabels.map((label, index) => {
              const stepNum = index + 1;
              const isActive = step >= stepNum;
              const isCompleted = step > stepNum;

              return (
                <div key={stepNum} className="progress-step-wrapper">
                  <div className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
                    <span className="step-number">
                      {isCompleted ? <Check size={14} /> : stepNum}
                    </span>
                    <span className="step-label">{label}</span>
                  </div>
                  {stepNum < TOTAL_STEPS && <div className="progress-line" />}
                </div>
              );
            })}
          </div>
          <button className="wizard-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="wizard-content">
          {error && (
            <div className="wizard-error">{error}</div>
          )}

          {/* Step 1: Type */}
          {step === 1 && (
            <div className="wizard-step">
              <div className="step-header">
                <h2>Quel type de répartition ?</h2>
                <p>Choisissez le type de configuration selon votre besoin</p>
              </div>

              <div className="type-cards">
                {TYPES_CONFIG.map(type => (
                  <button
                    key={type.value}
                    type="button"
                    className={`type-card ${selectedType === type.value ? 'selected' : ''}`}
                    onClick={() => setSelectedType(type.value)}
                    style={{ '--accent-color': type.color } as React.CSSProperties}
                  >
                    <div className="type-icon">{type.icon}</div>
                    <div className="type-info">
                      <h3>{type.label}</h3>
                      <p>{type.description}</p>
                    </div>
                    {selectedType === type.value && (
                      <div className="type-check">
                        <Check size={20} />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Step 2: Nom */}
          {step === 2 && (
            <div className="wizard-step">
              <div className="step-header">
                <h2>Donnez un nom à cette configuration</h2>
                <p>Ce nom vous aidera à l'identifier plus tard</p>
              </div>

              <div className="form-fields">
                <div className="form-field">
                  <label htmlFor="config-name">Nom *</label>
                  <input
                    id="config-name"
                    type="text"
                    value={nom}
                    onChange={e => setNom(e.target.value)}
                    placeholder={selectedType === 'oral_dnb' ? 'Ex: Oral DNB Juin 2026' : 'Ex: Stages 3e Janvier'}
                    autoFocus
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="config-desc">Description (optionnel)</label>
                  <textarea
                    id="config-desc"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ajoutez des notes pour vous souvenir du contexte..."
                    rows={3}
                  />
                </div>

                {/* Option spécifique Oral DNB : capacité par jury */}
                {selectedType === 'oral_dnb' && (
                  <div className="form-field capacite-jury-field">
                    <label htmlFor="capacite-jury">
                      <Users size={16} />
                      Élèves par jury
                    </label>
                    <div className="capacite-input-group">
                      <input
                        id="capacite-jury"
                        type="number"
                        min={1}
                        max={30}
                        value={capaciteJury}
                        onChange={e => setCapaciteJury(Math.max(1, Math.min(30, parseInt(e.target.value) || 15)))}
                      />
                      <span className="capacite-hint">élèves maximum par jury</span>
                    </div>
                  </div>
                )}

                {/* Options spécifiques au mode libre */}
                {selectedType === 'custom' && (
                  <>
                    <div className="form-field">
                      <label>Niveaux concernés</label>
                      <div className="niveaux-selector">
                        {(['6e', '5e', '4e', '3e'] as Niveau[]).map(niveau => (
                          <button
                            key={niveau}
                            type="button"
                            className={`niveau-btn ${selectedNiveaux.has(niveau) ? 'selected' : ''}`}
                            onClick={() => {
                              setSelectedNiveaux(prev => {
                                const next = new Set(prev);
                                if (next.has(niveau)) {
                                  next.delete(niveau);
                                } else {
                                  next.add(niveau);
                                }
                                return next;
                              });
                            }}
                          >
                            {niveau}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-field checkbox-field">
                      <label>
                        <input
                          type="checkbox"
                          checked={useJurys}
                          onChange={e => setUseJurys(e.target.checked)}
                        />
                        <span>Utiliser des jurys (groupes d'enseignants)</span>
                      </label>
                      <span className="field-hint">
                        Si décoché, chaque enseignant recevra des élèves individuellement
                      </span>
                    </div>

                    {useJurys && (
                      <div className="form-field capacite-jury-field">
                        <label htmlFor="capacite-jury-custom">
                          <Users size={16} />
                          Élèves par jury
                        </label>
                        <div className="capacite-input-group">
                          <input
                            id="capacite-jury-custom"
                            type="number"
                            min={1}
                            max={30}
                            value={capaciteJury}
                            onChange={e => setCapaciteJury(Math.max(1, Math.min(30, parseInt(e.target.value) || 15)))}
                          />
                          <span className="capacite-hint">élèves maximum par jury</span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}

          {/* Step 3: Enseignants - NOUVELLE VERSION */}
          {step === 3 && (
            <div className="wizard-step">
              <div className="step-header">
                <h2>Quels enseignants participent ?</h2>
                <p>Décochez ceux qui ne participent pas à cette configuration</p>
              </div>

              <div className="enseignants-wizard-section">
                {/* Compteur avec actions globales */}
                <div className="enseignants-header">
                  <div className="enseignants-counter">
                    <GraduationCap size={20} />
                    <span className="counter-text">
                      <strong>{selectedEnseignantIds.size}</strong>
                      <span className="counter-separator">/</span>
                      <span>{enseignants.length}</span>
                      <span className="counter-label">enseignants</span>
                    </span>
                  </div>
                  <div className="global-actions">
                    <button type="button" className="btn-action" onClick={selectAll}>
                      <CheckSquare size={14} />
                      Tout cocher
                    </button>
                    <button type="button" className="btn-action" onClick={deselectAll}>
                      <Square size={14} />
                      Tout décocher
                    </button>
                  </div>
                </div>

                {/* Actions rapides de sélection */}
                <div className="quick-actions-section">
                  <span className="section-label">Sélectionner uniquement :</span>
                  <div className="quick-action-buttons">
                    <button
                      type="button"
                      className="quick-action-btn"
                      onClick={selectOnlyPP}
                    >
                      <Star size={14} />
                      Les PP
                    </button>

                    {distinctNiveaux.map(niveau => (
                      <button
                        key={niveau}
                        type="button"
                        className="quick-action-btn"
                        onClick={() => selectOnlyNiveau(niveau)}
                      >
                        {niveau}
                      </button>
                    ))}
                  </div>

                  {distinctMatieres.length > 0 && (
                    <div className="quick-action-buttons matieres-row">
                      {distinctMatieres.slice(0, 8).map(matiere => (
                        <button
                          key={matiere}
                          type="button"
                          className="quick-action-btn small"
                          onClick={() => selectOnlyMatiere(matiere)}
                        >
                          {matiere}
                        </button>
                      ))}
                      {distinctMatieres.length > 8 && (
                        <span className="more-label">+{distinctMatieres.length - 8}</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Recherche */}
                <div className="search-box">
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Rechercher un enseignant..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>

                {/* Liste des enseignants */}
                <div className="enseignants-list">
                  {displayedEnseignants.map(ens => {
                    const isSelected = selectedEnseignantIds.has(ens.id!);

                    return (
                      <div
                        key={ens.id}
                        className={`enseignant-item ${isSelected ? 'selected' : ''}`}
                        onClick={() => toggleEnseignant(ens.id!)}
                      >
                        <div className="ens-checkbox">
                          {isSelected && <Check size={14} />}
                        </div>
                        <div className="ens-info">
                          <span className="ens-name">{ens.prenom} {ens.nom}</span>
                          <span className="ens-details">
                            {ens.matierePrincipale}
                            {ens.estProfPrincipal && <span className="pp-badge">PP</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {displayedEnseignants.length === 0 && (
                    <div className="no-results">Aucun enseignant trouvé</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Critères */}
          {step === 4 && selectedType && (
            <div className="wizard-step">
              <div className="step-header">
                <h2>Critères de répartition</h2>
                <p>Définissez l'importance de chaque critère</p>
              </div>

              <div className="criteres-wizard-section">
                <CriteresEditor
                  scenarioType={selectedType}
                  criteres={criteres}
                  onChange={setCriteres}
                />
              </div>
            </div>
          )}

          {/* Step 5: Récapitulatif */}
          {step === 5 && (
            <div className="wizard-step">
              <div className="step-header">
                <h2>Tout est prêt !</h2>
                <p>Vérifiez les informations avant de créer</p>
              </div>

              <div className="recap-card">
                <div className="recap-icon">
                  {selectedType === 'oral_dnb' ? <Mic size={40} /> :
                   selectedType === 'suivi_stage' ? <Briefcase size={40} /> :
                   <Settings2 size={40} />}
                </div>

                <div className="recap-details">
                  <h3>{nom}</h3>
                  <span className="recap-type">
                    {selectedType === 'oral_dnb' ? 'Oral du DNB' :
                     selectedType === 'suivi_stage' ? 'Suivi de stage' :
                     'Configuration libre'}
                  </span>
                  {description && <p className="recap-desc">{description}</p>}
                </div>

                <div className="recap-stats">
                  <div className="recap-stat">
                    <Users size={18} />
                    <span>{eleveCount} élèves concernés</span>
                  </div>
                  <div className="recap-stat">
                    <GraduationCap size={18} />
                    <span>{selectedEnseignantIds.size} enseignants sélectionnés</span>
                  </div>
                  {selectedType === 'oral_dnb' && (
                    <div className="recap-stat">
                      <Mic size={18} />
                      <span>{capaciteJury} élèves max par jury</span>
                    </div>
                  )}
                  {selectedType === 'custom' && (
                    <>
                      <div className="recap-stat">
                        <Settings2 size={18} />
                        <span>Niveaux : {Array.from(selectedNiveaux).sort().join(', ')}</span>
                      </div>
                      <div className="recap-stat">
                        <Users size={18} />
                        <span>{useJurys ? `Jurys (${capaciteJury} élèves max)` : 'Sans jurys'}</span>
                      </div>
                    </>
                  )}
                  <div className="recap-stat">
                    <Filter size={18} />
                    <span>{criteres.filter(c => c.priority !== 'off').length} critères actifs</span>
                  </div>
                </div>

                <div className="recap-note">
                  <p>
                    Vous pourrez modifier ces paramètres à tout moment
                    depuis le bouton "Modifier" sur la carte de configuration.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="wizard-footer">
          {step > 1 ? (
            <button type="button" className="btn-back" onClick={handleBack}>
              <ChevronLeft size={18} />
              Retour
            </button>
          ) : (
            <div />
          )}

          {step < TOTAL_STEPS ? (
            <button
              type="button"
              className="btn-next"
              onClick={handleNext}
              disabled={!canProceed}
            >
              Suivant
              <ChevronRight size={18} />
            </button>
          ) : (
            <button
              type="button"
              className="btn-create"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Création...' : 'Créer la configuration'}
              <Check size={18} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
