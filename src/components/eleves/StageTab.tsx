// ============================================================
// STAGE TAB COMPONENT
// Onglet de gestion des stages dans la page Élèves
// ============================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useEleveStore } from '../../stores/eleveStore';
import { useStageStore } from '../../stores/stageStore';
import { useAffectationStore } from '../../stores/affectationStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import {
  importStagesFromFile,
  convertMatchedRowsToStageData,
  resolveAmbiguousMatch,
  analyzeAddressQuality,
  type StageImportResult,
  type MatchedStageRow,
  type AddressQualityStats,
} from '../../services/stageImportService';
import { geocodeAddressWithFallback } from '../../infrastructure/geo/stageGeoWorkflow';
import {
  Search,
  Upload,
  Building2,
  MapPin,
  Phone,
  CheckCircle,
  AlertTriangle,
  Clock,
  XCircle,
  Edit2,
  Save,
  X,
  FileSpreadsheet,
  Users,
  Loader,
  HelpCircle,
  ChevronRight,
} from 'lucide-react';
import type { Eleve, Stage } from '../../domain/models';
import './StageTab.css';

// ============================================================
// TYPES
// ============================================================

type StageStatus = 'complet' | 'incomplet' | 'sans_stage' | 'geocode_ok' | 'geocode_error' | 'geocode_pending';

interface EleveWithStage {
  eleve: Eleve;
  stage: Stage | undefined;
  status: StageStatus;
}

// ============================================================
// IMPORT MODAL COMPONENT
// ============================================================

interface ImportModalProps {
  onClose: () => void;
  onImportComplete: (result: { updated: number; created: number }) => void;
}

function StageImportModal({ onClose, onImportComplete }: ImportModalProps) {
  const eleves = useEleveStore(state => state.eleves);
  const bulkUpsertStagesForEleves = useStageStore(state => state.bulkUpsertStagesForEleves);
  const updateStage = useStageStore(state => state.updateStage);
  const loadGlobalStages = useStageStore(state => state.loadGlobalStages);

  const [_file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<StageImportResult | null>(null);
  const [step, setStep] = useState<'select' | 'preview' | 'resolve' | 'geocoding' | 'done'>('select');
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [addressQuality, setAddressQuality] = useState<AddressQualityStats | null>(null);

  // State for ambiguous resolution
  const [resolvedMatches, setResolvedMatches] = useState<MatchedStageRow[]>([]);
  const [ambiguousSelections, setAmbiguousSelections] = useState<Map<number, string>>(new Map());

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setImporting(true);

    try {
      const importResult = await importStagesFromFile(selectedFile, eleves);
      setResult(importResult);
      setResolvedMatches([]);
      setAmbiguousSelections(new Map());

      // Analyser la qualité des adresses
      if (importResult.matched.length > 0) {
        const qualityStats = analyzeAddressQuality(importResult.matched);
        setAddressQuality(qualityStats);
      } else {
        setAddressQuality(null);
      }

      setStep('preview');
    } catch (error) {
      console.error('Erreur import:', error);
      alert('Erreur lors de la lecture du fichier');
    } finally {
      setImporting(false);
    }
  };

  // Handle selection of an ambiguous candidate
  const handleAmbiguousSelect = (ambiguousIndex: number, eleveId: string) => {
    setAmbiguousSelections(prev => {
      const next = new Map(prev);
      next.set(ambiguousIndex, eleveId);
      return next;
    });
  };

  // Resolve all selected ambiguous matches
  const handleResolveAmbiguous = () => {
    if (!result) return;

    const newResolved: MatchedStageRow[] = [];
    ambiguousSelections.forEach((eleveId, index) => {
      const ambiguous = result.ambiguous[index];
      if (ambiguous) {
        const resolved = resolveAmbiguousMatch(ambiguous, eleveId);
        if (resolved) {
          newResolved.push(resolved);
        }
      }
    });

    setResolvedMatches(newResolved);
    setStep('preview');
  };

  // Get all matches (original + resolved ambiguous)
  const allMatched = useMemo(() => {
    if (!result) return [];
    return [...result.matched, ...resolvedMatches];
  }, [result, resolvedMatches]);

  const handleConfirmImport = async () => {
    if (allMatched.length === 0) return;

    setImporting(true);
    try {
      const stageData = convertMatchedRowsToStageData(allMatched);
      const importResult = await bulkUpsertStagesForEleves(stageData);

      // Lancer le géocodage automatique des stages importés
      setStep('geocoding');
      await loadGlobalStages(); // Recharger pour avoir les IDs

      // Récupérer les stages avec adresse à géocoder
      const stagesToGeocode = stageData.filter(s => s.adresse && s.adresse.trim());
      setGeocodeProgress({ current: 0, total: stagesToGeocode.length, errors: 0 });

      // Géocoder chaque stage
      const stages = useStageStore.getState().stages;
      for (let i = 0; i < stagesToGeocode.length; i++) {
        const stageData = stagesToGeocode[i];
        const stage = stages.find(s => s.eleveId === stageData.eleveId && !s.scenarioId);

        if (stage && stageData.adresse) {
          setGeocodeProgress(p => ({ ...p, current: i + 1 }));

          try {
            const geoResult = await geocodeAddressWithFallback(stageData.adresse);

            if (geoResult.point) {
              await updateStage(stage.id, {
                lat: geoResult.point.lat,
                lon: geoResult.point.lon,
                geoStatus: geoResult.status,
                geoStatusExtended: geoResult.statusExtended,
                geoPrecision: geoResult.precision,
                geoQueryUsed: geoResult.queryUsed,
                geoErrorMessage: undefined,
              });
            } else {
              await updateStage(stage.id, {
                geoStatus: 'error',
                geoErrorMessage: geoResult.errorMessage || 'Adresse non trouvée',
              });
              setGeocodeProgress(p => ({ ...p, errors: p.errors + 1 }));
            }
          } catch (err) {
            await updateStage(stage.id, {
              geoStatus: 'error',
              geoErrorMessage: err instanceof Error ? err.message : 'Erreur inconnue',
            });
            setGeocodeProgress(p => ({ ...p, errors: p.errors + 1 }));
          }

          // Petit délai pour UI (rate limit géré par le provider)
          await new Promise(r => setTimeout(r, 100));
        }
      }

      onImportComplete(importResult);
      setStep('done');
    } catch (error) {
      console.error('Erreur sauvegarde:', error);
      alert('Erreur lors de la sauvegarde des stages');
    } finally {
      setImporting(false);
    }
  };

  // Calculate remaining ambiguous (not yet resolved)
  const remainingAmbiguous = useMemo(() => {
    if (!result) return [];
    const resolvedIndices = new Set(
      resolvedMatches.map((r) => {
        // Find the index in ambiguous array that matches this resolved row
        return result.ambiguous.findIndex(
          a => a.nom === r.nom && a.prenom === r.prenom
        );
      })
    );
    return result.ambiguous.filter((_, i) => !resolvedIndices.has(i));
  }, [result, resolvedMatches]);

  return (
    <div className="stage-import-modal-overlay" onClick={onClose}>
      <div className="stage-import-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>
            <FileSpreadsheet size={20} />
            Importer les stages
          </h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="modal-content">
          {step === 'select' && (
            <div className="import-step select-file">
              <div className="file-drop-zone">
                <Upload size={48} />
                <p>Glissez un fichier CSV ou Excel ici</p>
                <span>ou</span>
                <label className="file-input-label">
                  Parcourir
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileChange}
                    disabled={importing}
                  />
                </label>
              </div>

              <div className="import-help">
                <h4>Format attendu :</h4>
                <p>
                  <strong>Formats supportés :</strong> CSV, Excel (.xlsx, .xls)
                </p>
                <p>
                  <strong>Colonnes :</strong> <code>nom</code>, <code>prénom</code> (ou <code>nom complet</code>), <code>adresse</code>, <code>entreprise</code>, <code>téléphone</code>
                </p>
                <p>
                  <strong>Matching intelligent :</strong> Les élèves sont retrouvés même avec des différences d'accents, casse, ou ordre nom/prénom.
                </p>
              </div>

              {importing && (
                <div className="importing-indicator">
                  <Clock className="spin" size={20} />
                  Analyse du fichier...
                </div>
              )}
            </div>
          )}

          {step === 'preview' && result && (
            <div className="import-step preview">
              <div className="import-stats">
                <div className="stat success">
                  <CheckCircle size={20} />
                  <span className="value">{allMatched.length}</span>
                  <span className="label">élèves trouvés</span>
                </div>
                {remainingAmbiguous.length > 0 && (
                  <div className="stat ambiguous">
                    <HelpCircle size={20} />
                    <span className="value">{remainingAmbiguous.length}</span>
                    <span className="label">à confirmer</span>
                  </div>
                )}
                <div className="stat warning">
                  <AlertTriangle size={20} />
                  <span className="value">{result.stats.unmatched}</span>
                  <span className="label">non trouvés</span>
                </div>
                {result.stats.errors > 0 && (
                  <div className="stat error">
                    <XCircle size={20} />
                    <span className="value">{result.stats.errors}</span>
                    <span className="label">erreurs</span>
                  </div>
                )}
              </div>

              {/* Analyse qualité des adresses */}
              {addressQuality && (
                <div className="preview-section address-quality-section">
                  <h4>
                    <MapPin size={16} />
                    Analyse des adresses
                  </h4>
                  <div className="address-quality-stats">
                    <div className="quality-stat complete">
                      <span className="quality-count">{addressQuality.complete}</span>
                      <span className="quality-label">Complètes</span>
                      <span className="quality-desc">Géocodage précis</span>
                    </div>
                    <div className="quality-stat partial">
                      <span className="quality-count">{addressQuality.partial}</span>
                      <span className="quality-label">Partielles</span>
                      <span className="quality-desc">Géocodage approximatif</span>
                    </div>
                    <div className="quality-stat minimal">
                      <span className="quality-count">{addressQuality.minimal}</span>
                      <span className="quality-label">Minimales</span>
                      <span className="quality-desc">Niveau ville</span>
                    </div>
                    <div className="quality-stat invalid">
                      <span className="quality-count">{addressQuality.invalid}</span>
                      <span className="quality-label">Invalides</span>
                      <span className="quality-desc">Non géocodables</span>
                    </div>
                    <div className="quality-stat empty">
                      <span className="quality-count">{addressQuality.empty}</span>
                      <span className="quality-label">Vides</span>
                      <span className="quality-desc">Sans stage trouvé</span>
                    </div>
                  </div>
                  {(addressQuality.byCountry.LU > 0 || addressQuality.byCountry.unknown > 0) && (
                    <div className="address-countries">
                      <span className="country-info">
                        Pays détectés: France ({addressQuality.byCountry.FR})
                        {addressQuality.byCountry.LU > 0 && `, Luxembourg (${addressQuality.byCountry.LU})`}
                        {addressQuality.byCountry.unknown > 0 && `, Inconnu (${addressQuality.byCountry.unknown})`}
                      </span>
                    </div>
                  )}
                  <div className="geocodability-estimate">
                    {(() => {
                      const totalWithAddress = addressQuality.total - addressQuality.empty;
                      const geocodable = addressQuality.complete + addressQuality.partial;
                      const percent = totalWithAddress > 0 ? Math.round((geocodable / totalWithAddress) * 100) : 0;
                      return (
                        <span className={`geocode-rate ${percent >= 80 ? 'good' : percent >= 50 ? 'medium' : 'low'}`}>
                          Taux de géocodabilité estimé: {percent}%
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {allMatched.length > 0 && (
                <div className="preview-section">
                  <h4>Aperçu des données à importer ({allMatched.length})</h4>
                  <div className="preview-table-container">
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Élève</th>
                          <th>Classe</th>
                          <th>Entreprise</th>
                          <th>Adresse</th>
                          <th>Match</th>
                        </tr>
                      </thead>
                      <tbody>
                        {allMatched.slice(0, 10).map((row, i) => (
                          <tr key={i}>
                            <td>{row.elevePrenom} {row.eleveNom}</td>
                            <td>{row.eleveClasse}</td>
                            <td>{row.entreprise || '-'}</td>
                            <td className="address-cell">{row.adresse || '-'}</td>
                            <td>
                              <span className={`match-badge ${row.matchScore >= 0.9 ? 'high' : row.matchScore >= 0.8 ? 'medium' : 'low'}`}>
                                {Math.round(row.matchScore * 100)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {allMatched.length > 10 && (
                      <p className="more-rows">
                        ... et {allMatched.length - 10} autres lignes
                      </p>
                    )}
                  </div>
                </div>
              )}

              {remainingAmbiguous.length > 0 && (
                <div className="preview-section ambiguous-section">
                  <h4>
                    <HelpCircle size={16} />
                    Correspondances à confirmer ({remainingAmbiguous.length})
                  </h4>
                  <p className="ambiguous-hint">
                    Plusieurs élèves correspondent. Cliquez sur "Résoudre" pour choisir le bon élève.
                  </p>
                  <ul className="ambiguous-list">
                    {remainingAmbiguous.slice(0, 5).map((row, i) => (
                      <li key={i}>
                        <span className="name">{row.prenom} {row.nom}</span>
                        <span className="candidates">
                          {row.candidates.length} candidat(s): {row.candidates.map(c => `${c.eleve.prenom} ${c.eleve.nom} (${c.eleve.classe})`).join(', ')}
                        </span>
                      </li>
                    ))}
                    {remainingAmbiguous.length > 5 && (
                      <li className="more">... et {remainingAmbiguous.length - 5} autres</li>
                    )}
                  </ul>
                  <button className="btn-secondary resolve-btn" onClick={() => setStep('resolve')}>
                    <ChevronRight size={16} />
                    Résoudre les ambiguïtés
                  </button>
                </div>
              )}

              {result.unmatched.length > 0 && (
                <div className="preview-section errors">
                  <h4>Élèves non trouvés ({result.unmatched.length})</h4>
                  <ul className="error-list">
                    {result.unmatched.slice(0, 5).map((row, i) => (
                      <li key={i}>
                        <span className="name">{row.prenom} {row.nom}</span>
                        <span className="reason">{row.reason}</span>
                        {row.suggestions && row.suggestions.length > 0 && (
                          <span className="suggestions">
                            Suggestions: {row.suggestions.join(', ')}
                          </span>
                        )}
                      </li>
                    ))}
                    {result.unmatched.length > 5 && (
                      <li className="more">... et {result.unmatched.length - 5} autres</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 'resolve' && result && (
            <div className="import-step resolve-ambiguous">
              <h3>Résoudre les correspondances ambiguës</h3>
              <p className="resolve-hint">
                Pour chaque ligne, sélectionnez l'élève correct parmi les candidats proposés.
              </p>

              <div className="ambiguous-resolve-list">
                {result.ambiguous.map((row, index) => {
                  // Skip already resolved
                  const alreadyResolved = resolvedMatches.find(
                    r => r.nom === row.nom && r.prenom === row.prenom
                  );
                  if (alreadyResolved) return null;

                  return (
                    <div key={index} className="ambiguous-item">
                      <div className="ambiguous-source">
                        <strong>Fichier :</strong> {row.prenom} {row.nom}
                        {row.classe && <span className="source-class">({row.classe})</span>}
                        {row.entreprise && <span className="source-info">{row.entreprise}</span>}
                      </div>
                      <div className="ambiguous-candidates">
                        <span className="candidates-label">Sélectionner l'élève :</span>
                        {row.candidates.map((candidate, ci) => (
                          <label key={ci} className="candidate-option">
                            <input
                              type="radio"
                              name={`ambiguous-${index}`}
                              value={candidate.eleve.id}
                              checked={ambiguousSelections.get(index) === candidate.eleve.id}
                              onChange={() => handleAmbiguousSelect(index, candidate.eleve.id!)}
                            />
                            <span className="candidate-name">
                              {candidate.eleve.prenom} {candidate.eleve.nom}
                            </span>
                            <span className="candidate-class">{candidate.eleve.classe}</span>
                            <span className={`candidate-score ${candidate.score >= 0.9 ? 'high' : 'medium'}`}>
                              {Math.round(candidate.score * 100)}%
                            </span>
                          </label>
                        ))}
                        <label className="candidate-option skip-option">
                          <input
                            type="radio"
                            name={`ambiguous-${index}`}
                            value=""
                            checked={!ambiguousSelections.has(index)}
                            onChange={() => {
                              setAmbiguousSelections(prev => {
                                const next = new Map(prev);
                                next.delete(index);
                                return next;
                              });
                            }}
                          />
                          <span className="candidate-name skip">Ignorer cette ligne</span>
                        </label>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 'geocoding' && (
            <div className="import-step geocoding">
              <div className="geocoding-progress">
                <Loader className="spin" size={48} />
                <h3>Géocodage en cours...</h3>
                <p>Localisation des adresses de stage</p>
                <div className="progress-info">
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{ width: `${(geocodeProgress.current / Math.max(geocodeProgress.total, 1)) * 100}%` }}
                    />
                  </div>
                  <span className="progress-text">
                    {geocodeProgress.current} / {geocodeProgress.total}
                    {geocodeProgress.errors > 0 && ` (${geocodeProgress.errors} erreur(s))`}
                  </span>
                </div>
                <p className="geocoding-hint">
                  Veuillez patienter, le géocodage respecte les limites de l'API...
                </p>
              </div>
            </div>
          )}

          {step === 'done' && (
            <div className="import-step done">
              <CheckCircle size={64} className="success-icon" />
              <h3>Import et géocodage terminés !</h3>
              <p>Les stages ont été mis à jour avec succès.</p>
            </div>
          )}
        </div>

        <div className="modal-footer">
          {step === 'select' && (
            <button className="btn-secondary" onClick={onClose}>
              Annuler
            </button>
          )}
          {step === 'preview' && (
            <>
              <button className="btn-secondary" onClick={() => { setStep('select'); setResult(null); setFile(null); setResolvedMatches([]); }}>
                Retour
              </button>
              <button
                className="btn-primary"
                onClick={handleConfirmImport}
                disabled={importing || allMatched.length === 0}
              >
                {importing ? 'Import en cours...' : `Importer et géocoder ${allMatched.length} stage(s)`}
              </button>
            </>
          )}
          {step === 'resolve' && (
            <>
              <button className="btn-secondary" onClick={() => setStep('preview')}>
                Retour
              </button>
              <button
                className="btn-primary"
                onClick={handleResolveAmbiguous}
              >
                Confirmer les sélections ({ambiguousSelections.size})
              </button>
            </>
          )}
          {step === 'geocoding' && (
            <span className="footer-info">Géocodage en cours, veuillez patienter...</span>
          )}
          {step === 'done' && (
            <button className="btn-primary" onClick={onClose}>
              Fermer
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// INLINE EDIT ROW COMPONENT
// ============================================================

interface EditRowProps {
  eleve: Eleve;
  stage: Stage | undefined;
  onSave: (data: Partial<Stage>) => void;
  onCancel: () => void;
}

function EditStageRow({ eleve, stage, onSave, onCancel }: EditRowProps) {
  const [entreprise, setEntreprise] = useState(stage?.nomEntreprise || '');
  const [adresse, setAdresse] = useState(stage?.adresse || '');
  const [telephone, setTelephone] = useState(stage?.tuteurTel || '');

  const handleSave = () => {
    onSave({
      nomEntreprise: entreprise || undefined,
      adresse: adresse || undefined,
      tuteurTel: telephone || undefined,
      geoStatus: adresse ? 'pending' : undefined,
    });
  };

  return (
    <tr className="editing-row">
      <td className="nom-cell">{eleve.nom}</td>
      <td>{eleve.prenom}</td>
      <td><span className="classe-badge">{eleve.classe || '-'}</span></td>
      <td>
        <input
          type="text"
          className="inline-input"
          value={entreprise}
          onChange={e => setEntreprise(e.target.value)}
          placeholder="Nom de l'entreprise"
        />
      </td>
      <td>
        <input
          type="text"
          className="inline-input address-input"
          value={adresse}
          onChange={e => setAdresse(e.target.value)}
          placeholder="Adresse complète"
        />
      </td>
      <td>
        <input
          type="text"
          className="inline-input phone-input"
          value={telephone}
          onChange={e => setTelephone(e.target.value)}
          placeholder="Téléphone"
        />
      </td>
      <td>-</td>
      <td>-</td>
      <td className="actions-cell">
        <button className="btn-icon save" onClick={handleSave} title="Enregistrer">
          <Save size={16} />
        </button>
        <button className="btn-icon cancel" onClick={onCancel} title="Annuler">
          <X size={16} />
        </button>
      </td>
    </tr>
  );
}

// ============================================================
// MAIN COMPONENT
// ============================================================

export const StageTab: React.FC = () => {
  const eleves = useEleveStore(state => state.eleves);
  const stages = useStageStore(state => state.stages);
  const loadGlobalStages = useStageStore(state => state.loadGlobalStages);
  const upsertStageForEleve = useStageStore(state => state.upsertStageForEleve);
  const affectations = useAffectationStore(state => state.affectations);
  const enseignants = useEnseignantStore(state => state.enseignants);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNiveau, setSelectedNiveau] = useState('3e'); // Par défaut 3ème
  const [selectedClasse, setSelectedClasse] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'with' | 'without' | 'incomplete'>('all');
  const [editingEleveId, setEditingEleveId] = useState<string | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);

  // Charger les stages globaux au mount
  useEffect(() => {
    loadGlobalStages();
  }, [loadGlobalStages]);

  // Niveaux disponibles (3e, 4e, 5e, 6e)
  const niveaux = useMemo(() => {
    const set = new Set<string>();
    eleves.forEach(e => {
      if (e.classe) {
        const niveau = e.classe.replace(/[^0-9]/g, '')[0];
        if (niveau) set.add(niveau + 'e');
      }
    });
    return Array.from(set).sort((a, b) => parseInt(b) - parseInt(a)); // 6e, 5e, 4e, 3e
  }, [eleves]);

  // Classes disponibles (filtrées par niveau sélectionné)
  const classes = useMemo(() => {
    const set = new Set(
      eleves
        .filter(e => {
          if (!selectedNiveau) return true;
          const niveau = e.classe?.replace(/[^0-9]/g, '')[0] + 'e';
          return niveau === selectedNiveau;
        })
        .map(e => e.classe)
        .filter(Boolean)
    );
    return Array.from(set).sort();
  }, [eleves, selectedNiveau]);

  // Élèves filtrés par niveau (pour les stats et l'affichage)
  const elevesFiltresParNiveau = useMemo(() => {
    if (!selectedNiveau) return eleves;
    return eleves.filter(e => {
      const niveau = e.classe?.replace(/[^0-9]/g, '')[0] + 'e';
      return niveau === selectedNiveau;
    });
  }, [eleves, selectedNiveau]);

  // Mapper les élèves avec leurs stages
  const elevesWithStages: EleveWithStage[] = useMemo(() => {
    const stagesByEleveId = new Map<string, Stage>();
    stages.forEach((s: Stage) => {
      if (s.eleveId && !s.scenarioId) {
        stagesByEleveId.set(s.eleveId, s);
      }
    });

    return elevesFiltresParNiveau.map(eleve => {
      const stage = stagesByEleveId.get(eleve.id!);
      let status: StageStatus = 'sans_stage';

      if (stage) {
        if (stage.adresse && stage.nomEntreprise) {
          if (stage.geoStatus === 'ok') {
            status = 'geocode_ok';
          } else if (stage.geoStatus === 'error' || stage.geoStatus === 'not_found') {
            status = 'geocode_error';
          } else if (stage.geoStatus === 'pending') {
            status = 'geocode_pending';
          } else {
            status = 'complet';
          }
        } else if (stage.adresse || stage.nomEntreprise) {
          status = 'incomplet';
        }
      }

      return { eleve, stage, status };
    });
  }, [eleves, stages]);

  // Map eleveId -> référent (enseignant assigné dans un scénario suivi_stage)
  const referentByEleveId = useMemo(() => {
    const map = new Map<string, { nom: string; prenom: string; matiere: string }>();
    const enseignantsById = new Map(enseignants.map(e => [e.id, e]));

    // Trouver les affectations de type suivi_stage
    for (const aff of affectations) {
      if (aff.type === 'suivi_stage' && aff.eleveId && aff.enseignantId) {
        const enseignant = enseignantsById.get(aff.enseignantId);
        if (enseignant) {
          map.set(aff.eleveId, {
            nom: enseignant.nom,
            prenom: enseignant.prenom,
            matiere: enseignant.matierePrincipale,
          });
        }
      }
    }
    return map;
  }, [affectations, enseignants]);

  // Stats
  const stats = useMemo(() => {
    const withStage = elevesWithStages.filter(e => e.status !== 'sans_stage').length;
    const complete = elevesWithStages.filter(e =>
      e.status === 'complet' || e.status === 'geocode_ok' || e.status === 'geocode_pending'
    ).length;
    const incomplete = elevesWithStages.filter(e => e.status === 'incomplet').length;
    const withoutStage = elevesWithStages.filter(e => e.status === 'sans_stage').length;
    const geocodeOk = elevesWithStages.filter(e => e.status === 'geocode_ok').length;
    const geocodeError = elevesWithStages.filter(e => e.status === 'geocode_error').length;

    return { withStage, complete, incomplete, withoutStage, geocodeOk, geocodeError, total: elevesFiltresParNiveau.length };
  }, [elevesWithStages, elevesFiltresParNiveau.length]);

  // Filtrage
  const filteredEleves = useMemo(() => {
    let result = elevesWithStages;

    // Recherche
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(({ eleve, stage }) =>
        eleve.nom.toLowerCase().includes(query) ||
        eleve.prenom.toLowerCase().includes(query) ||
        eleve.classe?.toLowerCase().includes(query) ||
        stage?.nomEntreprise?.toLowerCase().includes(query) ||
        stage?.adresse?.toLowerCase().includes(query)
      );
    }

    // Classe
    if (selectedClasse) {
      result = result.filter(({ eleve }) => eleve.classe === selectedClasse);
    }

    // Statut
    if (filterStatus === 'with') {
      result = result.filter(({ status }) => status !== 'sans_stage');
    } else if (filterStatus === 'without') {
      result = result.filter(({ status }) => status === 'sans_stage');
    } else if (filterStatus === 'incomplete') {
      result = result.filter(({ status }) => status === 'incomplet' || status === 'sans_stage');
    }

    // Tri par nom
    return result.sort((a, b) => a.eleve.nom.localeCompare(b.eleve.nom));
  }, [elevesWithStages, searchQuery, selectedClasse, filterStatus]);

  const updateStage = useStageStore(state => state.updateStage);

  // Handlers
  const handleSaveStage = useCallback(async (eleveId: string, data: Partial<Stage>) => {
    try {
      const savedStage = await upsertStageForEleve(eleveId, data);
      setEditingEleveId(null);

      // Si une adresse est fournie, lancer le géocodage automatique
      if (data.adresse && data.adresse.trim()) {
        try {
          const geoResult = await geocodeAddressWithFallback(data.adresse);

          if (geoResult.point) {
            await updateStage(savedStage.id, {
              lat: geoResult.point.lat,
              lon: geoResult.point.lon,
              geoStatus: geoResult.status,
              geoStatusExtended: geoResult.statusExtended,
              geoPrecision: geoResult.precision,
              geoQueryUsed: geoResult.queryUsed,
              geoErrorMessage: undefined,
            });
          } else {
            await updateStage(savedStage.id, {
              geoStatus: 'error',
              geoErrorMessage: geoResult.errorMessage || 'Adresse non trouvée',
            });
          }
        } catch (err) {
          await updateStage(savedStage.id, {
            geoStatus: 'error',
            geoErrorMessage: err instanceof Error ? err.message : 'Erreur géocodage',
          });
        } finally {
          // Recharger les stages pour mettre à jour l'affichage
          loadGlobalStages();
        }
      }
    } catch (error) {
      console.error('Erreur sauvegarde stage:', error);
      alert('Erreur lors de la sauvegarde');
    }
  }, [upsertStageForEleve, updateStage, loadGlobalStages]);

  const handleImportComplete = useCallback((_result: { updated: number; created: number }) => {
    loadGlobalStages();
  }, [loadGlobalStages]);

  const getStatusBadge = (status: StageStatus) => {
    switch (status) {
      case 'complet':
        return <span className="status-badge complete"><CheckCircle size={12} /> Complet</span>;
      case 'geocode_ok':
        return <span className="status-badge geocoded"><MapPin size={12} /> Géocodé</span>;
      case 'geocode_pending':
        return <span className="status-badge pending"><Clock size={12} /> En attente</span>;
      case 'geocode_error':
        return <span className="status-badge error"><XCircle size={12} /> Erreur géo</span>;
      case 'incomplet':
        return <span className="status-badge incomplete"><AlertTriangle size={12} /> Incomplet</span>;
      case 'sans_stage':
        return <span className="status-badge empty">-</span>;
    }
  };

  return (
    <div className="stage-tab">
      {/* Stats banner */}
      <div className="stage-stats-banner">
        <div className="stat-item">
          <Users size={20} />
          <div className="stat-content">
            <span className="stat-value">{stats.total}</span>
            <span className="stat-label">{selectedNiveau ? `élèves de ${selectedNiveau}` : 'élèves'}</span>
          </div>
        </div>
        <div className="stat-item">
          <Building2 size={20} />
          <div className="stat-content">
            <span className="stat-value">{stats.withStage}</span>
            <span className="stat-label">avec stage</span>
          </div>
        </div>
        <div className="stat-item warning">
          <AlertTriangle size={20} />
          <div className="stat-content">
            <span className="stat-value">{stats.withoutStage}</span>
            <span className="stat-label">sans stage</span>
          </div>
        </div>
        <div className="stat-item">
          <MapPin size={20} />
          <div className="stat-content">
            <span className="stat-value">{stats.geocodeOk}</span>
            <span className="stat-label">géocodés</span>
          </div>
        </div>
        <div className="stat-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${(stats.withStage / Math.max(stats.total, 1)) * 100}%` }}
            />
          </div>
          <span className="progress-label">
            {Math.round((stats.withStage / Math.max(stats.total, 1)) * 100)}% avec stage
          </span>
        </div>
        <button className="btn-primary" onClick={() => setShowImportModal(true)}>
          <Upload size={18} />
          Importer
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <div className="search-input">
          <Search size={18} />
          <input
            type="text"
            placeholder="Rechercher un élève, entreprise, adresse..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="filter-group">
          <label>Niveau:</label>
          <select
            value={selectedNiveau}
            onChange={e => {
              setSelectedNiveau(e.target.value);
              setSelectedClasse(''); // Reset classe quand on change de niveau
            }}
          >
            <option value="">Tous les niveaux</option>
            {niveaux.map(n => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Classe:</label>
          <select value={selectedClasse} onChange={e => setSelectedClasse(e.target.value)}>
            <option value="">Toutes</option>
            {classes.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Statut:</label>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as typeof filterStatus)}>
            <option value="all">Tous</option>
            <option value="with">Avec stage</option>
            <option value="without">Sans stage</option>
            <option value="incomplete">Incomplets / Sans stage</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container stage-table-container">
        <table className="eleves-table stage-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Classe</th>
              <th>Entreprise</th>
              <th>Adresse</th>
              <th>Téléphone</th>
              <th>Référent</th>
              <th>Statut</th>
              <th className="actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEleves.map(({ eleve, stage, status }) => {
              if (editingEleveId === eleve.id) {
                return (
                  <EditStageRow
                    key={eleve.id}
                    eleve={eleve}
                    stage={stage}
                    onSave={(data) => handleSaveStage(eleve.id!, data)}
                    onCancel={() => setEditingEleveId(null)}
                  />
                );
              }

              return (
                <tr key={eleve.id} className={status === 'sans_stage' ? 'no-stage' : ''}>
                  <td className="nom-cell">{eleve.nom}</td>
                  <td>{eleve.prenom}</td>
                  <td><span className="classe-badge">{eleve.classe || '-'}</span></td>
                  <td>
                    {stage?.nomEntreprise ? (
                      <span className="entreprise-cell">
                        <Building2 size={14} />
                        {stage.nomEntreprise}
                      </span>
                    ) : '-'}
                  </td>
                  <td className="address-cell">
                    {stage?.adresse ? (
                      <span className="address-text" title={stage.adresse}>
                        <MapPin size={14} />
                        {stage.adresse.length > 40
                          ? stage.adresse.substring(0, 40) + '...'
                          : stage.adresse}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {stage?.tuteurTel ? (
                      <span className="phone-cell">
                        <Phone size={14} />
                        {stage.tuteurTel}
                      </span>
                    ) : '-'}
                  </td>
                  <td>
                    {(() => {
                      const referent = referentByEleveId.get(eleve.id!);
                      return referent ? (
                        <span className="referent-cell" title={referent.matiere}>
                          {referent.prenom} {referent.nom}
                        </span>
                      ) : '-';
                    })()}
                  </td>
                  <td>{getStatusBadge(status)}</td>
                  <td className="actions-cell">
                    <button
                      className="btn-icon edit"
                      onClick={() => setEditingEleveId(eleve.id!)}
                      title="Modifier"
                    >
                      <Edit2 size={16} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredEleves.length === 0 && (
          <div className="empty-state">
            <Users size={48} />
            <p>Aucun élève trouvé</p>
            <span>Modifiez vos filtres ou importez des stages</span>
          </div>
        )}
      </div>

      {/* Help section */}
      <div className="stage-help">
        <h4>Conseils</h4>
        <ul>
          <li>Utilisez <strong>Importer</strong> pour charger les stages depuis un fichier CSV ou Excel</li>
          <li>Le matching intelligent retrouve les élèves même avec des accents ou ordres différents</li>
          <li>Cliquez sur <Edit2 size={12} /> pour modifier un stage individuellement</li>
          <li>Les stages renseignés ici seront utilisés dans le scénario "Suivi de stage"</li>
        </ul>
      </div>

      {/* Import Modal */}
      {showImportModal && (
        <StageImportModal
          onClose={() => setShowImportModal(false)}
          onImportComplete={handleImportComplete}
        />
      )}
    </div>
  );
};

export default StageTab;
