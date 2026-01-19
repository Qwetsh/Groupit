// ============================================================
// MODAL - ÉDITER SCÉNARIO
// ============================================================

import { useState, useEffect, useMemo } from 'react';
import { X, Save, Settings, Users, GraduationCap, Filter, Mic, Briefcase, AlertCircle } from 'lucide-react';
import { useScenarioStore } from '../../stores/scenarioStore';
import { useEleveStore } from '../../stores/eleveStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useUIStore } from '../../stores/uiStore';
import type { CritereConfig, ScenarioType, ScenarioMode, Niveau, CritereInstance } from '../../domain/models';
import { MATIERES_HEURES_3E, createDefaultCriteres, getEffectiveCriteres } from '../../domain/models';
import { CriteresEditor } from './CriteresEditor';
import './Modal.css';

interface ScenarioModalProps {
  onClose: () => void;
}

const TYPES_SCENARIO: { value: ScenarioType; label: string; description: string; icon: React.ReactNode; disabled?: boolean }[] = [
  { 
    value: 'oral_dnb', 
    label: 'Oral du DNB', 
    description: 'Répartir les élèves de 3e dans des jurys pour les oraux du brevet', 
    icon: <Mic size={24} /> 
  },
  { 
    value: 'suivi_stage', 
    label: 'Suivi de stage', 
    description: 'Affecter chaque élève stagiaire à un enseignant tuteur (optimisation géographique)', 
    icon: <Briefcase size={24} />,
  },
];

// Liste des matières autorisées pour l'oral DNB (basée sur la table de référence)
const MATIERES_ORAL_DISPONIBLES = MATIERES_HEURES_3E.map(m => m.matiere);

export function ScenarioModal({ onClose }: ScenarioModalProps) {
  const scenarios = useScenarioStore(state => state.scenarios);
  const addScenario = useScenarioStore(state => state.addScenario);
  const updateScenario = useScenarioStore(state => state.updateScenario);
  const eleves = useEleveStore(state => state.eleves);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const modalData = useUIStore(state => state.modalData) as { scenarioId?: string } | null;

  const scenario = modalData?.scenarioId
    ? scenarios.find(s => s.id === modalData.scenarioId)
    : undefined;

  const isEditing = !!scenario;

  // Extraire les valeurs uniques pour les filtres
  const distinctClasses = useMemo(() => 
    [...new Set(eleves.map(e => e.classe))].sort(), [eleves]);
  const distinctOptions = useMemo(() => 
    [...new Set(eleves.flatMap(e => e.options))].filter(Boolean).sort(), [eleves]);
  const distinctMatieres = useMemo(() => 
    [...new Set(enseignants.map(e => e.matierePrincipale))].filter(Boolean).sort(), [enseignants]);

  const [formData, setFormData] = useState({
    nom: '',
    description: '',
    mode: 'matching' as ScenarioMode,
    type: 'oral_dnb' as ScenarioType,
    // Nouveau système de critères
    criteresV2: createDefaultCriteres('oral_dnb') as CritereInstance[],
    // @deprecated - Ancien système de critères (conservé pour migration)
    criteres: [
      { id: 'matiere_match', nom: 'Correspondance matière', poids: 70, actif: true, estContrainteDure: false },
      { id: 'equilibrage', nom: 'Équilibrage', poids: 30, actif: true, estContrainteDure: false },
    ] as CritereConfig[],
    capaciteBaseDefaut: 8,
    equilibrageActif: true,
    // Filtres élèves
    filtresEleves: {
      classes: [] as string[],
      niveaux: ['3e'] as Niveau[], // Par défaut, oral DNB = 3e
      options: [] as string[],
    },
    // Filtres enseignants
    filtresEnseignants: {
      matieres: [] as string[],
      classesEnCharge: [] as string[],
      ppOnly: false,
    },
    // Configuration spécifique Oral DNB
    oralDnb: {
      matieresAutorisees: [...MATIERES_ORAL_DISPONIBLES],
      utiliserJurys: true,
      poidsMatiere: 70,
      criteresSecondaires: ['equilibrage', 'parite'] as ('equilibrage' | 'parite' | 'capacite')[],
      capaciteJuryDefaut: 8,
    },
    // Configuration spécifique Suivi de Stage
    suiviStage: {
      distanceMaxKm: 50,
      dureeMaxMin: 60,
      prioriserPP: true,
      capaciteTuteurDefaut: 5,
    },
  });

  const [activeTab, setActiveTab] = useState<'general' | 'eleves' | 'enseignants' | 'criteres' | 'oral_dnb' | 'suivi_stage'>('general');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quand le type de scénario change, réinitialiser les critères
  useEffect(() => {
    if (!scenario) {
      // Nouveau scénario : créer les critères par défaut pour ce type
      setFormData(prev => ({
        ...prev,
        criteresV2: createDefaultCriteres(prev.type),
      }));
    }
  }, [formData.type, scenario]);

  useEffect(() => {
    if (scenario) {
      setFormData({
        nom: scenario.nom,
        description: scenario.description || '',
        mode: scenario.mode,
        type: scenario.type,
        // Charger criteresV2 ou migrer depuis l'ancien format
        criteresV2: scenario.parametres.criteresV2 
          || createDefaultCriteres(scenario.type),
        criteres: scenario.parametres.criteres,
        capaciteBaseDefaut: scenario.parametres.capaciteConfig.capaciteBaseDefaut,
        equilibrageActif: scenario.parametres.equilibrageActif,
        filtresEleves: {
          classes: scenario.parametres.filtresEleves?.classes || [],
          niveaux: scenario.parametres.filtresEleves?.niveaux || [],
          options: scenario.parametres.filtresEleves?.options || [],
        },
        filtresEnseignants: {
          matieres: scenario.parametres.filtresEnseignants?.matieres || [],
          classesEnCharge: scenario.parametres.filtresEnseignants?.classesEnCharge || [],
          ppOnly: scenario.parametres.filtresEnseignants?.ppOnly || false,
        },
        oralDnb: {
          matieresAutorisees: scenario.parametres.oralDnb?.matieresAutorisees || [...MATIERES_ORAL_DISPONIBLES],
          utiliserJurys: scenario.parametres.oralDnb?.utiliserJurys ?? true,
          poidsMatiere: scenario.parametres.oralDnb?.poidsMatiere ?? 70,
          criteresSecondaires: scenario.parametres.oralDnb?.criteresSecondaires || ['equilibrage', 'parite'],
          capaciteJuryDefaut: scenario.parametres.oralDnb?.capaciteJuryDefaut ?? 8,
        },
        suiviStage: {
          distanceMaxKm: scenario.parametres.suiviStage?.distanceMaxKm ?? 50,
          dureeMaxMin: scenario.parametres.suiviStage?.dureeMaxMin ?? 60,
          prioriserPP: scenario.parametres.suiviStage?.prioriserPP ?? true,
          capaciteTuteurDefaut: scenario.parametres.suiviStage?.capaciteTuteurDefaut ?? 5,
        },
      });
    }
  }, [scenario]);

  // Compteurs pour prévisualisation
  const filteredElevesCount = useMemo(() => {
    return eleves.filter(e => {
      if (formData.filtresEleves.classes.length > 0 && !formData.filtresEleves.classes.includes(e.classe)) return false;
      if (formData.filtresEleves.niveaux.length > 0) {
        const niveau = e.classe.replace(/[^0-9]/g, '')[0] + 'e' as Niveau;
        if (!formData.filtresEleves.niveaux.includes(niveau)) return false;
      }
      if (formData.filtresEleves.options.length > 0 && !formData.filtresEleves.options.some(o => e.options.includes(o))) return false;
      return true;
    }).length;
  }, [eleves, formData.filtresEleves]);

  const filteredEnseignantsCount = useMemo(() => {
    return enseignants.filter(e => {
      if (formData.filtresEnseignants.ppOnly && !e.estProfPrincipal) return false;
      if (formData.filtresEnseignants.matieres.length > 0 && !formData.filtresEnseignants.matieres.includes(e.matierePrincipale)) return false;
      if (formData.filtresEnseignants.classesEnCharge.length > 0 && !formData.filtresEnseignants.classesEnCharge.some(c => e.classesEnCharge.includes(c))) return false;
      return true;
    }).length;
  }, [enseignants, formData.filtresEnseignants]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.nom.trim()) {
      setError('Le nom du scénario est obligatoire');
      return;
    }

    // Validation spécifique oral DNB
    if (formData.type === 'oral_dnb' && formData.oralDnb.matieresAutorisees.length === 0) {
      setError('Au moins une matière doit être autorisée pour l\'oral');
      return;
    }

    setSaving(true);
    try {
      const capaciteBase = formData.type === 'oral_dnb'
        ? formData.oralDnb.capaciteJuryDefaut
        : formData.capaciteBaseDefaut;

      // Appliquer les critères effectifs (injecter les forcés)
      const effectiveCriteres = getEffectiveCriteres(formData.type, formData.criteresV2);

      const scenarioData = {
        nom: formData.nom.trim(),
        description: formData.description.trim() || undefined,
        mode: formData.mode,
        type: formData.type,
        parametres: {
          // Nouveau système de critères
          criteresV2: effectiveCriteres,
          // @deprecated - Ancien système (garde pour compatibilité)
          criteres: formData.criteres,
          capaciteConfig: {
              capaciteBaseDefaut: capaciteBase,
            coefficients: { '6e': 0, '5e': 0, '4e': 0.5, '3e': 1 },
          },
          equilibrageActif: formData.equilibrageActif,
          filtresEleves: formData.filtresEleves.classes.length > 0 || formData.filtresEleves.niveaux.length > 0 || formData.filtresEleves.options.length > 0
            ? formData.filtresEleves
            : undefined,
          filtresEnseignants: formData.filtresEnseignants.matieres.length > 0 || formData.filtresEnseignants.classesEnCharge.length > 0 || formData.filtresEnseignants.ppOnly
            ? formData.filtresEnseignants
            : undefined,
          // Configuration Oral DNB
          oralDnb: formData.type === 'oral_dnb' ? formData.oralDnb : undefined,
          // Configuration Suivi Stage
          suiviStage: formData.type === 'suivi_stage' ? formData.suiviStage : undefined,
        },
      };

      if (isEditing && scenario) {
        await updateScenario(scenario.id!, scenarioData);
      } else {
        await addScenario(scenarioData);
      }
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="modal-header">
            <div className="modal-title">
              <Settings size={20} />
              <h2>{isEditing ? 'Modifier le scénario' : 'Nouveau scénario'}</h2>
            </div>
            <button type="button" className="modal-close" onClick={onClose}>
              <X size={20} />
            </button>
          </div>

          {/* Tabs */}
          <div className="modal-tabs">
            <button type="button" className={`tab ${activeTab === 'general' ? 'active' : ''}`} onClick={() => setActiveTab('general')}>
              <Settings size={16} /> Général
            </button>
            {formData.type === 'oral_dnb' && (
              <button type="button" className={`tab ${activeTab === 'oral_dnb' ? 'active' : ''}`} onClick={() => setActiveTab('oral_dnb')}>
                <Mic size={16} /> Oral DNB
              </button>
            )}
            {formData.type === 'suivi_stage' && (
              <button type="button" className={`tab ${activeTab === 'suivi_stage' ? 'active' : ''}`} onClick={() => setActiveTab('suivi_stage')}>
                <Briefcase size={16} /> Suivi Stage
              </button>
            )}
            {/* Élèves: masqué pour suivi_stage car les élèves sont déterminés par l'import des stages */}
            {formData.type !== 'suivi_stage' && (
              <button type="button" className={`tab ${activeTab === 'eleves' ? 'active' : ''}`} onClick={() => setActiveTab('eleves')}>
                <Users size={16} /> Élèves ({filteredElevesCount}/{eleves.length})
              </button>
            )}
            <button type="button" className={`tab ${activeTab === 'enseignants' ? 'active' : ''}`} onClick={() => setActiveTab('enseignants')}>
              <GraduationCap size={16} /> Enseignants ({filteredEnseignantsCount}/{enseignants.length})
            </button>
            <button type="button" className={`tab ${activeTab === 'criteres' ? 'active' : ''}`} onClick={() => setActiveTab('criteres')}>
              <Filter size={16} /> Critères
            </button>
          </div>

          <div className="modal-body">
            {error && <div className="form-error">{error}</div>}

            {/* TAB: Général */}
            {activeTab === 'general' && (
              <div className="form-section">
                <div className="form-group">
                  <label htmlFor="nom">Nom du scénario *</label>
                  <input
                    id="nom"
                    type="text"
                    value={formData.nom}
                    onChange={e => setFormData(prev => ({ ...prev, nom: e.target.value }))}
                    placeholder="Ex: Oraux DNB Juin 2026"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    value={formData.description}
                    onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Décrivez l'objectif de ce scénario..."
                    rows={2}
                  />
                </div>

                <div className="form-group">
                  <label>Type de scénario</label>
                  <div className="scenario-type-cards">
                    {TYPES_SCENARIO.map(t => (
                      <button
                        key={t.value}
                        type="button"
                        className={`scenario-type-card ${formData.type === t.value ? 'selected' : ''} ${t.disabled ? 'disabled' : ''}`}
                        onClick={() => !t.disabled && setFormData(prev => ({ ...prev, type: t.value }))}
                        disabled={t.disabled}
                      >
                        <div className="card-icon">{t.icon}</div>
                        <div className="card-content">
                          <span className="card-label">{t.label}</span>
                          <span className="card-description">{t.description}</span>
                        </div>
                        {t.disabled && <span className="coming-soon">Bientôt</span>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Capacité retirée de l'onglet général (gérée dans l'onglet Oral DNB) */}
              </div>
            )}

            {/* TAB: Configuration Oral DNB */}
            {activeTab === 'oral_dnb' && formData.type === 'oral_dnb' && (
              <div className="form-section">
                <div className="info-box">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Configuration de l'oral du DNB</strong>
                    <p>Définissez les matières autorisées et les paramètres d'affectation. Les jurys seront créés après la création du scénario.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label>Matières autorisées pour l'oral</label>
                  <p className="form-hint">Les élèves pourront choisir parmi ces matières pour leur sujet d'oral.</p>
                  <div className="checkbox-grid matiere-grid">
                    {MATIERES_ORAL_DISPONIBLES.map(matiere => (
                      <label key={matiere} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.oralDnb.matieresAutorisees.includes(matiere)}
                          onChange={e => {
                            const matieresAutorisees = e.target.checked
                              ? [...formData.oralDnb.matieresAutorisees, matiere]
                              : formData.oralDnb.matieresAutorisees.filter(m => m !== matiere);
                            setFormData(prev => ({ 
                              ...prev, 
                              oralDnb: { ...prev.oralDnb, matieresAutorisees } 
                            }));
                          }}
                        />
                        {matiere}
                      </label>
                    ))}
                  </div>
                  <div className="selection-actions">
                    <button 
                      type="button" 
                      className="btn-text"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        oralDnb: { ...prev.oralDnb, matieresAutorisees: [...MATIERES_ORAL_DISPONIBLES] } 
                      }))}
                    >
                      Tout sélectionner
                    </button>
                    <button 
                      type="button" 
                      className="btn-text"
                      onClick={() => setFormData(prev => ({ 
                        ...prev, 
                        oralDnb: { ...prev.oralDnb, matieresAutorisees: [] } 
                      }))}
                    >
                      Tout désélectionner
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="capaciteJury">Capacité par jury (défaut)</label>
                  <input
                    id="capaciteJury"
                    type="number"
                    min="1"
                    max="30"
                    value={formData.oralDnb.capaciteJuryDefaut}
                    onChange={e => setFormData(prev => ({ 
                      ...prev, 
                      oralDnb: { ...prev.oralDnb, capaciteJuryDefaut: parseInt(e.target.value) || 8 } 
                    }))}
                  />
                  <span className="form-hint">Nombre d'élèves max par jury (modifiable individuellement par jury)</span>
                </div>

                <div className="info-box info">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Critères d'affectation</strong>
                    <p>Les critères d'affectation (correspondance matière, équilibrage, parité...) sont configurables dans l'onglet <strong>Critères</strong>.</p>
                  </div>
                </div>
              </div>
            )}

            {/* TAB: Configuration Suivi Stage */}
            {activeTab === 'suivi_stage' && formData.type === 'suivi_stage' && (
              <div className="form-section">
                <div className="info-box">
                  <AlertCircle size={18} />
                  <div>
                    <strong>Configuration du suivi de stage</strong>
                    <p>Définissez les paramètres d'affectation des élèves stagiaires aux enseignants tuteurs, avec optimisation géographique.</p>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="distanceMaxKm">Distance maximale (km)</label>
                  <p className="form-hint">Distance maximale entre l'enseignant et le lieu de stage de l'élève.</p>
                  <input
                    id="distanceMaxKm"
                    type="number"
                    min={1}
                    max={200}
                    value={formData.suiviStage.distanceMaxKm}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      suiviStage: { ...prev.suiviStage, distanceMaxKm: parseInt(e.target.value) || 50 }
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="dureeMaxMin">Durée maximale de trajet (min)</label>
                  <p className="form-hint">Temps de trajet maximal en voiture pour rejoindre le lieu de stage.</p>
                  <input
                    id="dureeMaxMin"
                    type="number"
                    min={5}
                    max={180}
                    value={formData.suiviStage.dureeMaxMin}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      suiviStage: { ...prev.suiviStage, dureeMaxMin: parseInt(e.target.value) || 60 }
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="capaciteTuteurDefaut">Capacité tuteur par défaut</label>
                  <p className="form-hint">Nombre maximum d'élèves qu'un tuteur peut suivre par défaut.</p>
                  <input
                    id="capaciteTuteurDefaut"
                    type="number"
                    min={1}
                    max={20}
                    value={formData.suiviStage.capaciteTuteurDefaut}
                    onChange={e => setFormData(prev => ({
                      ...prev,
                      suiviStage: { ...prev.suiviStage, capaciteTuteurDefaut: parseInt(e.target.value) || 5 }
                    }))}
                  />
                </div>

                <div className="form-group">
                  <label className="checkbox-item standalone">
                    <input
                      type="checkbox"
                      checked={formData.suiviStage.prioriserPP}
                      onChange={e => setFormData(prev => ({
                        ...prev,
                        suiviStage: { ...prev.suiviStage, prioriserPP: e.target.checked }
                      }))}
                    />
                    Prioriser le professeur principal
                  </label>
                  <p className="form-hint">Si activé, les élèves seront préférentiellement affectés à leur professeur principal (si disponible géographiquement).</p>
                </div>
              </div>
            )}

            {/* TAB: Filtres Élèves - Masqué pour suivi_stage */}
            {activeTab === 'eleves' && formData.type !== 'suivi_stage' && (
              <div className="form-section">
                <p className="section-description">
                  Sélectionnez les élèves à inclure dans ce scénario. Si aucun filtre n'est défini, tous les élèves seront inclus.
                </p>

                <div className="form-group">
                  <label>Filtrer par niveau</label>
                  <div className="checkbox-grid">
                    {(['6e', '5e', '4e', '3e'] as Niveau[]).map(niveau => (
                      <label key={niveau} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.filtresEleves.niveaux.includes(niveau)}
                          onChange={e => {
                            const niveaux = e.target.checked
                              ? [...formData.filtresEleves.niveaux, niveau]
                              : formData.filtresEleves.niveaux.filter(n => n !== niveau);
                            setFormData(prev => ({ ...prev, filtresEleves: { ...prev.filtresEleves, niveaux } }));
                          }}
                        />
                        {niveau}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Filtrer par classe</label>
                  <div className="checkbox-grid">
                    {distinctClasses.map(classe => (
                      <label key={classe} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.filtresEleves.classes.includes(classe)}
                          onChange={e => {
                            const classes = e.target.checked
                              ? [...formData.filtresEleves.classes, classe]
                              : formData.filtresEleves.classes.filter(c => c !== classe);
                            setFormData(prev => ({ ...prev, filtresEleves: { ...prev.filtresEleves, classes } }));
                          }}
                        />
                        {classe}
                      </label>
                    ))}
                  </div>
                </div>

                {distinctOptions.length > 0 && (
                  <div className="form-group">
                    <label>Filtrer par option</label>
                    <div className="checkbox-grid">
                      {distinctOptions.map(option => (
                        <label key={option} className="checkbox-item">
                          <input
                            type="checkbox"
                            checked={formData.filtresEleves.options.includes(option)}
                            onChange={e => {
                              const options = e.target.checked
                                ? [...formData.filtresEleves.options, option]
                                : formData.filtresEleves.options.filter(o => o !== option);
                              setFormData(prev => ({ ...prev, filtresEleves: { ...prev.filtresEleves, options } }));
                            }}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <div className="filter-preview">
                  <strong>{filteredElevesCount}</strong> élèves seront inclus dans ce scénario
                </div>
              </div>
            )}

            {/* TAB: Filtres Enseignants */}
            {activeTab === 'enseignants' && (
              <div className="form-section">
                <p className="section-description">
                  Sélectionnez les enseignants qui pourront recevoir des élèves. Si aucun filtre n'est défini, tous les enseignants seront inclus.
                </p>

                <div className="form-group">
                  <label className="checkbox-item highlight">
                    <input
                      type="checkbox"
                      checked={formData.filtresEnseignants.ppOnly}
                      onChange={e => setFormData(prev => ({ 
                        ...prev, 
                        filtresEnseignants: { ...prev.filtresEnseignants, ppOnly: e.target.checked } 
                      }))}
                    />
                    Uniquement les professeurs principaux
                  </label>
                </div>

                <div className="form-group">
                  <label>Filtrer par matière</label>
                  <div className="checkbox-grid">
                    {distinctMatieres.map(matiere => (
                      <label key={matiere} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.filtresEnseignants.matieres.includes(matiere)}
                          onChange={e => {
                            const matieres = e.target.checked
                              ? [...formData.filtresEnseignants.matieres, matiere]
                              : formData.filtresEnseignants.matieres.filter(m => m !== matiere);
                            setFormData(prev => ({ ...prev, filtresEnseignants: { ...prev.filtresEnseignants, matieres } }));
                          }}
                        />
                        {matiere}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="form-group">
                  <label>Enseignants ayant en charge les classes</label>
                  <div className="checkbox-grid">
                    {distinctClasses.map(classe => (
                      <label key={classe} className="checkbox-item">
                        <input
                          type="checkbox"
                          checked={formData.filtresEnseignants.classesEnCharge.includes(classe)}
                          onChange={e => {
                            const classesEnCharge = e.target.checked
                              ? [...formData.filtresEnseignants.classesEnCharge, classe]
                              : formData.filtresEnseignants.classesEnCharge.filter(c => c !== classe);
                            setFormData(prev => ({ ...prev, filtresEnseignants: { ...prev.filtresEnseignants, classesEnCharge } }));
                          }}
                        />
                        {classe}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="filter-preview">
                  <strong>{filteredEnseignantsCount}</strong> enseignants pourront recevoir des élèves
                </div>
              </div>
            )}

            {/* TAB: Critères de scoring - Nouvelle UI */}
            {activeTab === 'criteres' && (
              <CriteresEditor
                scenarioType={formData.type}
                criteres={formData.criteresV2}
                onChange={(newCriteres) => setFormData(prev => ({ ...prev, criteresV2: newCriteres }))}
              />
            )}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
            <button type="submit" className="btn-primary" disabled={saving}>
              <Save size={18} />
              {saving ? 'Enregistrement...' : (isEditing ? 'Mettre à jour' : 'Créer le scénario')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
