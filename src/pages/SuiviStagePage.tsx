// ============================================================
// SUIVI STAGE PAGE - Affectation enseignants aux stages
// ============================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useStageStore, useEnseignantStore, useEleveStore } from '../stores';
import type { Stage, Enseignant, GeoPrecision } from '../domain/models';
import type {
  TeacherStagePair,
  StageMatchingResult,
  StageGeoInfo,
  EnseignantGeoInfo,
} from '../infrastructure/geo/types';
import { geocodeAddressWithFallback } from '../infrastructure/geo/stageGeoWorkflow';
import {
  solveStageMatching,
  toStageGeoInfo,
  toEnseignantGeoInfo,
} from '../algorithms/stageSolver';
// Test data generation
import {
  generateFakeStages,
  isFakeStage,
} from '../data/testDataGenerator';
import './SuiviStagePage.css';

type TabId = 'addresses' | 'matching';

// Geo status pour l'affichage (étendu avec précision)
type DisplayGeoStatus = 'pending' | 'ok' | 'error' | 'manual' | 'ok_full' | 'ok_city' | 'ok_townhall';

// ----- Status Badge Component -----
function GeoStatusBadge({ status, precision, tooltip }: { 
  status: DisplayGeoStatus; 
  precision?: GeoPrecision;
  tooltip?: string;
}) {
  const labels: Record<DisplayGeoStatus, string> = {
    pending: 'En attente',
    ok: 'Géocodé',
    ok_full: 'Géocodé',
    ok_city: 'Approximatif',
    ok_townhall: 'Approximatif',
    error: 'Erreur',
    manual: 'Manuel',
  };
  
  // Déterminer le status d'affichage basé sur la précision
  let displayStatus = status;
  if (precision === 'CITY' || precision === 'TOWNHALL') {
    displayStatus = precision === 'CITY' ? 'ok_city' : 'ok_townhall';
  } else if (precision === 'FULL' && status === 'ok') {
    displayStatus = 'ok_full';
  }
  
  const tooltipText = tooltip || (
    precision === 'CITY' ? 'Géolocalisation approximative basée sur la ville' :
    precision === 'TOWNHALL' ? 'Géolocalisation approximative basée sur la mairie' :
    undefined
  );
  
  return (
    <span 
      className={`geo-status ${displayStatus === 'ok_full' || displayStatus === 'ok' ? 'geocoded' : displayStatus}`}
      title={tooltipText}
    >
      {labels[displayStatus]}
    </span>
  );
}

// ----- Progress Bar Component -----
function ProgressBar({ 
  current, 
  total, 
  label,
  hasError = false 
}: { 
  current: number; 
  total: number; 
  label: string;
  hasError?: boolean;
}) {
  const percent = total > 0 ? Math.round((current / total) * 100) : 0;
  const isComplete = current === total && total > 0;
  
  return (
    <div className="progress-container">
      <div className="progress-label">{label} ({current}/{total})</div>
      <div className="progress-bar-wrapper">
        <div 
          className={`progress-bar-fill ${isComplete ? 'complete' : ''} ${hasError ? 'error' : ''}`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// State de progression simplifié pour l'UI
interface UIProgressState {
  total: number;
  completed: number;
  errors: number;
  phase: string | null;
  currentAddress: string | null;
}

// ----- Tab: Addresses & Geocoding -----
function AddressesTab({
  stages,
  enseignants,
  onGeocodeAll,
  isGeocoding,
  progress,
  // Test data functions
  onGenerateFakeStages,
  onDeleteFakeStages,
  isGenerating,
}: {
  stages: Stage[];
  enseignants: Enseignant[];
  onGeocodeAll: () => void;
  isGeocoding: boolean;
  progress: UIProgressState;
  // Test data functions
  onGenerateFakeStages: () => void;
  onDeleteFakeStages: () => void;
  isGenerating: boolean;
}) {
  const updateStage = useStageStore(state => state.updateStage);
  const updateEnseignant = useEnseignantStore(state => state.updateEnseignant);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleEditStart = (id: string, currentAddress: string) => {
    setEditingId(id);
    setEditValue(currentAddress);
  };

  const handleEditSave = async (id: string, type: 'stage' | 'enseignant') => {
    if (type === 'stage') {
      await updateStage(id, { adresse: editValue, geoStatus: 'pending' });
    } else {
      await updateEnseignant(id, { adresse: editValue, geoStatus: 'pending' });
    }
    setEditingId(null);
  };

  // Stats
  const stageStats = useMemo(() => {
    const geocoded = stages.filter(s => s.geoStatus === 'ok' || s.geoStatus === 'manual').length;
    const errors = stages.filter(s => s.geoStatus === 'error' || s.geoStatus === 'not_found').length;
    const pending = stages.filter(s => s.geoStatus === 'pending').length;
    const toProcess = pending + errors; // À traiter (pending + erreurs à retenter)
    return { total: stages.length, geocoded, errors, pending, toProcess };
  }, [stages]);

  const teacherStats = useMemo(() => {
    const geocoded = enseignants.filter(e => e.geoStatus === 'ok' || e.geoStatus === 'manual').length;
    const errors = enseignants.filter(e => e.geoStatus === 'error' || e.geoStatus === 'not_found').length;
    const pending = enseignants.filter(e => e.geoStatus === 'pending').length;
    const toProcess = pending + errors;
    return { total: enseignants.length, geocoded, errors, pending, toProcess };
  }, [enseignants]);

  // Test data stats
  const fakeStagesCount = stages.filter(s => isFakeStage(s)).length;
  const enseignantsWithAddress = enseignants.filter(e => e.adresse && e.adresse.trim() !== '').length;

  return (
    <div className="stage-tab-content">
      {/* Test Data Section */}
      <div className="test-data-section">
        <div className="test-data-header">
          <span className="test-badge">🧪 MODE TEST</span>
          <span className="test-description">Génération de données fictives autour de Woippy (57140)</span>
        </div>
        <div className="test-data-actions">
          <button
            className="test-action"
            onClick={onGenerateFakeStages}
            disabled={isGenerating || isGeocoding}
            title="Génère des stages fictifs pour tous les élèves de 3ème"
          >
            📋 Générer stages fictifs
          </button>
          <button
            className="test-action danger"
            onClick={onDeleteFakeStages}
            disabled={isGenerating || isGeocoding || fakeStagesCount === 0}
            title="Supprime uniquement les stages marqués [TEST]"
          >
            🗑️ Supprimer stages fictifs ({fakeStagesCount})
          </button>
          {isGenerating && <span className="generating-indicator">⏳ Génération en cours...</span>}
        </div>
        <div className="test-data-stats">
          <span>Enseignants avec adresse: <strong>{enseignantsWithAddress}/{enseignants.length}</strong></span>
          <span>Stages test: <strong>{fakeStagesCount}</strong></span>
          <span>Stages réels: <strong>{stages.length - fakeStagesCount}</strong></span>
        </div>
      </div>

      {/* Action Bar */}
      <div className="action-bar">
        <button 
          className="primary-action" 
          onClick={onGeocodeAll}
          disabled={isGeocoding}
          title={`Géocoder ${stageStats.toProcess} stages et ${teacherStats.toProcess} enseignants (y compris retry des erreurs avec fallback)`}
        >
          {isGeocoding ? '⏳' : '🌍'} Géocoder les adresses
          {(stageStats.errors > 0 || teacherStats.errors > 0) && 
            <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', opacity: 0.8 }}>
              (+{stageStats.errors + teacherStats.errors} retry)
            </span>
          }
        </button>
        
        {isGeocoding && progress.total > 0 && (
          <ProgressBar 
            current={progress.completed} 
            total={progress.total} 
            label={progress.phase || 'Géocodage'} 
            hasError={progress.errors > 0}
          />
        )}
        
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '1rem', fontSize: '0.875rem' }}>
          <span>Stages: <strong>{stageStats.geocoded}/{stageStats.total}</strong>
            {stageStats.errors > 0 && <span style={{ color: '#ef4444' }}> ({stageStats.errors} err)</span>}
          </span>
          <span>Enseignants: <strong>{teacherStats.geocoded}/{teacherStats.total}</strong>
            {teacherStats.errors > 0 && <span style={{ color: '#ef4444' }}> ({teacherStats.errors} err)</span>}
          </span>
        </div>
      </div>

      {/* Stages Table */}
      <h3 style={{ marginBottom: '0.5rem' }}>📍 Stages ({stages.length})</h3>
      {stages.length === 0 ? (
        <div className="empty-state">
          <div className="icon">📋</div>
          <h3>Aucun stage</h3>
          <p>Importez des stages depuis la page d'import pour commencer.</p>
        </div>
      ) : (
        <table className="stage-table">
          <thead>
            <tr>
              <th>Élève ID</th>
              <th>Entreprise</th>
              <th>Adresse</th>
              <th>Statut</th>
              <th>Coordonnées</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {stages.map(stage => (
              <tr key={stage.id}>
                <td>{stage.eleveId}</td>
                <td>{stage.nomEntreprise || '-'}</td>
                <td>
                  {editingId === stage.id ? (
                    <div className="editable-cell">
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(stage.id, 'stage')}
                        autoFocus
                      />
                      <button className="edit-btn" onClick={() => handleEditSave(stage.id, 'stage')}>✓</button>
                      <button className="edit-btn" onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  ) : (
                    stage.adresse || '-'
                  )}
                </td>
                <td>
                  <GeoStatusBadge 
                    status={(stage.geoStatus || 'pending') as DisplayGeoStatus} 
                    precision={stage.geoPrecision}
                    tooltip={stage.geoQueryUsed ? `Requête: ${stage.geoQueryUsed}` : undefined}
                  />
                  {stage.geoErrorMessage && (
                    <span title={stage.geoErrorMessage} style={{ marginLeft: '0.25rem', cursor: 'help' }}>❗</span>
                  )}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {stage.lat && stage.lon ? `${stage.lat.toFixed(4)}, ${stage.lon.toFixed(4)}` : '-'}
                </td>
                <td>
                  {editingId !== stage.id && (
                    <button 
                      className="edit-btn" 
                      onClick={() => handleEditStart(stage.id, stage.adresse || '')}
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Teachers Table */}
      <h3 style={{ margin: '1.5rem 0 0.5rem' }}>👤 Enseignants ({enseignants.length})</h3>
      {enseignants.length === 0 ? (
        <div className="empty-state">
          <div className="icon">👥</div>
          <h3>Aucun enseignant</h3>
          <p>Ajoutez des enseignants depuis la page dédiée.</p>
        </div>
      ) : (
        <table className="stage-table">
          <thead>
            <tr>
              <th>Nom</th>
              <th>Prénom</th>
              <th>Adresse</th>
              <th>Capacité</th>
              <th>Statut</th>
              <th>Coordonnées</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {enseignants.map(ens => (
              <tr key={ens.id}>
                <td>{ens.nom}</td>
                <td>{ens.prenom}</td>
                <td>
                  {editingId === ens.id ? (
                    <div className="editable-cell">
                      <input
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleEditSave(ens.id, 'enseignant')}
                        autoFocus
                      />
                      <button className="edit-btn" onClick={() => handleEditSave(ens.id, 'enseignant')}>✓</button>
                      <button className="edit-btn" onClick={() => setEditingId(null)}>✕</button>
                    </div>
                  ) : (
                    ens.adresse || '-'
                  )}
                </td>
                <td>{ens.capaciteStage ?? 'Non défini'}</td>
                <td>
                  <GeoStatusBadge status={(ens.geoStatus || 'pending') as DisplayGeoStatus} />
                  {ens.geoErrorMessage && (
                    <span title={ens.geoErrorMessage} style={{ marginLeft: '0.25rem', cursor: 'help' }}>❗</span>
                  )}
                </td>
                <td style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                  {ens.lat && ens.lon ? `${ens.lat.toFixed(4)}, ${ens.lon.toFixed(4)}` : '-'}
                </td>
                <td>
                  {editingId !== ens.id && (
                    <button 
                      className="edit-btn" 
                      onClick={() => handleEditStart(ens.id, ens.adresse || '')}
                    >
                      ✏️ Modifier
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Helper pour vérifier la disponibilité géo

// ----- Tab: Matching Results -----
function MatchingTab({
  stages,
  enseignants,
  pairs,
  result,
  onRunMatching,
  isRunning,
}: {
  stages: Stage[];
  enseignants: Enseignant[];
  pairs: TeacherStagePair[];
  result: StageMatchingResult | null;
  onRunMatching: () => void;
  isRunning: boolean;
}) {
  const canRun = pairs.length > 0;

  const getTeacherName = (id: string) => {
    const ens = enseignants.find(e => e.id === id);
    return ens ? `${ens.prenom} ${ens.nom}` : id;
  };

  const getStageInfo = (id: string) => {
    return stages.find(s => s.id === id);
  };

  // Type pour les affectations
  type AffectationItem = StageMatchingResult['affectations'][number];

  // Group assignments by teacher
  const assignmentsByTeacher = useMemo(() => {
    if (!result) return new Map<string, AffectationItem[]>();
    const map = new Map<string, AffectationItem[]>();
    result.affectations.forEach(assignment => {
      const list = map.get(assignment.enseignantId) || [];
      list.push(assignment);
      map.set(assignment.enseignantId, list);
    });
    return map;
  }, [result]);

  return (
    <div className="stage-tab-content">
      {/* Action Bar */}
      <div className="action-bar">
        <button 
          className="primary-action" 
          onClick={onRunMatching}
          disabled={isRunning || !canRun}
        >
          {isRunning ? '⏳' : '🎯'} Lancer le matching
        </button>
        
        {!canRun && (
          <span style={{ color: 'var(--warning)', fontSize: '0.875rem' }}>
            ⚠️ Calculez d'abord les trajets dans l'onglet Routes
          </span>
        )}
      </div>

      {/* Results */}
      {!result ? (
        <div className="empty-state">
          <div className="icon">🎯</div>
          <h3>Aucune affectation</h3>
          <p>Cliquez sur 'Lancer le matching' pour optimiser les affectations.</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="matching-stats">
            <div className="stat-item">
              <div className="stat-value success">{result.stats.totalAffectes}</div>
              <div className="stat-label">Affectés</div>
            </div>
            <div className="stat-item">
              <div className={`stat-value ${result.stats.totalNonAffectes > 0 ? 'error' : 'success'}`}>
                {result.stats.totalNonAffectes}
              </div>
              <div className="stat-label">Non affectés</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{Math.round(result.stats.dureeTotaleMin)}</div>
              <div className="stat-label">Minutes totales</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{result.stats.distanceTotaleKm.toFixed(1)}</div>
              <div className="stat-label">Km totaux</div>
            </div>
            <div className="stat-item">
              <div className="stat-value">{result.tempsCalculMs}</div>
              <div className="stat-label">Temps (ms)</div>
            </div>
          </div>

          {/* Assignments by Teacher */}
          <div className="matching-results">
            {Array.from(assignmentsByTeacher.entries()).map(([teacherId, assignments]) => (
              <div key={teacherId} className="teacher-assignment-card">
                <div className="card-header">
                  <span className="teacher-name">{getTeacherName(teacherId)}</span>
                  <span className="stage-count">{assignments.length} stage(s)</span>
                </div>
                <div className="card-body">
                  {assignments.map(assignment => {
                    const stage = getStageInfo(assignment.stageId);
                    return (
                      <div key={assignment.stageId} className="stage-item">
                        <div>
                          <div className="eleve-name">{stage?.eleveId}</div>
                          <div className="company-name">{stage?.nomEntreprise || stage?.adresse}</div>
                        </div>
                        <div className="travel-info">
                          <div className="travel-duration">{Math.round(assignment.durationMin)} min</div>
                          <div className="travel-distance">{assignment.distanceKm.toFixed(1)} km</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Unassigned */}
          {result.nonAffectes.length > 0 && (
            <div className="unassigned-section">
              <h3>⚠️ Stages non affectés ({result.nonAffectes.length})</h3>
              <p className="unassigned-hint">Survolez un élève pour voir la raison</p>
              <div className="unassigned-list">
                {result.nonAffectes.map(item => {
                  const stage = getStageInfo(item.stageId);
                  const studentName = stage?.elevePrenom && stage?.eleveNom
                    ? `${stage.elevePrenom} ${stage.eleveNom}`
                    : stage?.eleveId || 'Élève inconnu';

                  // Déterminer l'icône et la catégorie du problème
                  const reasons = item.raisons || [];
                  const hasNoGeo = reasons.some(r =>
                    r.includes('non géolocalisé') || r.includes('Aucun trajet calculé')
                  );
                  const hasTooFar = reasons.some(r =>
                    r.includes('trop long') || r.includes('trop grande') || r.includes('Distance')
                  );
                  const hasCapacity = reasons.some(r =>
                    r.includes('capacité') || r.includes('Capacité')
                  );
                  const hasNoStage = !stage?.adresse;

                  // Choisir l'icône principale
                  let icon = '❓';
                  let problemType = 'unknown';
                  if (hasNoStage) {
                    icon = '📭';
                    problemType = 'no-stage';
                  } else if (hasNoGeo) {
                    icon = '📍';
                    problemType = 'no-geo';
                  } else if (hasTooFar) {
                    icon = '🚗';
                    problemType = 'too-far';
                  } else if (hasCapacity) {
                    icon = '👥';
                    problemType = 'capacity';
                  }

                  return (
                    <div
                      key={item.stageId}
                      className={`unassigned-item problem-${problemType}`}
                      title={reasons.join('\n')}
                    >
                      <div className="unassigned-student">
                        <span className="problem-icon">{icon}</span>
                        <span className="student-name">{studentName}</span>
                        {stage?.eleveClasse && (
                          <span className="student-class">{stage.eleveClasse}</span>
                        )}
                      </div>
                      <div className="unassigned-details">
                        {stage?.nomEntreprise ? (
                          <span className="company">{stage.nomEntreprise}</span>
                        ) : (
                          <span className="no-company">Pas de stage renseigné</span>
                        )}
                      </div>
                      <div className="unassigned-tooltip">
                        <div className="tooltip-title">Raison(s) :</div>
                        <ul className="tooltip-reasons">
                          {reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ----- Main Page Component -----
export function SuiviStagePage() {
  const [activeTab, setActiveTab] = useState<TabId>('addresses');
  
  // Stores - sélecteurs granulaires pour éviter re-renders
  const stages = useStageStore(state => state.stages);
  const loadStages = useStageStore(state => state.loadStages);
  const updateStageGeoExtended = useStageStore(state => state.updateStageGeoExtended);
  const setStageGeoError = useStageStore(state => state.setStageGeoError);
  const addStage = useStageStore(state => state.addStage);
  const deleteStage = useStageStore(state => state.deleteStage);
  const enseignants = useEnseignantStore(state => state.enseignants);
  const loadEnseignants = useEnseignantStore(state => state.loadEnseignants);
  const updateEnseignant = useEnseignantStore(state => state.updateEnseignant);
  const eleves = useEleveStore(state => state.eleves);
  const loadEleves = useEleveStore(state => state.loadEleves);
  
  // State
  const [pairs] = useState<TeacherStagePair[]>([]);
  const [matchingResult, setMatchingResult] = useState<StageMatchingResult | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isMatching, setIsMatching] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<UIProgressState>({
    total: 0,
    completed: 0,
    errors: 0,
    phase: null,
    currentAddress: null,
  });

  // Load data on mount
  useEffect(() => {
    loadStages();
    loadEnseignants();
    loadEleves();
  }, [loadStages, loadEnseignants, loadEleves]);

  // ----- Geocoding Handler (avec stratégie de fallback) -----
  const handleGeocodeAll = useCallback(async () => {
    console.log('=== DÉBUT GÉOCODAGE ===');
    setIsGeocoding(true);
    setProgress({ total: 0, completed: 0, errors: 0, phase: 'Préparation...', currentAddress: null });
    
    try {
      // Collect addresses to geocode (pending ET error pour retenter avec fallback)
      const stagesToGeocode = stages.filter(s => 
        (s.geoStatus === 'pending' || s.geoStatus === 'error' || s.geoStatus === 'not_found') && s.adresse
      );
      const teachersToGeocode = enseignants.filter(e => 
        (e.geoStatus === 'pending' || e.geoStatus === 'error' || e.geoStatus === 'not_found') && e.adresse
      );
      
      console.log(`Stages à géocoder: ${stagesToGeocode.length}, Enseignants: ${teachersToGeocode.length}`);
      
      const total = stagesToGeocode.length + teachersToGeocode.length;
      setProgress(p => ({ ...p, total, phase: 'Géocodage stages (avec fallback)' }));
      
      // Geocode stages avec stratégie de fallback
      // Essaye: adresse complète → ville+CP → "Mairie de Ville"
      for (let i = 0; i < stagesToGeocode.length; i++) {
        const stage = stagesToGeocode[i];
        console.log(`[${i+1}/${stagesToGeocode.length}] Géocodage stage: "${stage.adresse}"`);
        setProgress(p => ({ ...p, currentAddress: stage.adresse ?? null, completed: i }));
        
        try {
          // Utiliser le géocodage avec fallback
          const result = await geocodeAddressWithFallback(stage.adresse!);
          console.log(`Résultat: success=${!!result.point}, precision=${result.precision}, queryUsed=${result.queryUsed}`);
          
          if (result.point) {
            // Succès (exact ou avec fallback)
            await updateStageGeoExtended(
              stage.id, 
              result.point.lat, 
              result.point.lon, 
              result.status,
              result.statusExtended,
              result.precision,
              result.queryUsed
            );
            
            // Indiquer si c'était un fallback dans le progress
            if (result.precision !== 'FULL') {
              console.log(`Stage ${stage.id}: Fallback vers ${result.precision} (${result.queryUsed})`);
            }
          } else {
            await setStageGeoError(stage.id, result.errorMessage || 'Adresse non trouvée');
            setProgress(p => ({ ...p, errors: p.errors + 1 }));
          }
        } catch (err) {
          await setStageGeoError(stage.id, String(err));
          setProgress(p => ({ ...p, errors: p.errors + 1 }));
        }
        
        // Petit délai pour UI (rate limit géré par le provider hybride)
        await new Promise(r => setTimeout(r, 100));
      }
      
      // Geocode teachers (aussi avec fallback)
      setProgress(p => ({ ...p, phase: 'Géocodage enseignants (avec fallback)', completed: stagesToGeocode.length }));
      
      for (let i = 0; i < teachersToGeocode.length; i++) {
        const teacher = teachersToGeocode[i];
        setProgress(p => ({ 
          ...p, 
          currentAddress: teacher.adresse ?? null, 
          completed: stagesToGeocode.length + i 
        }));
        
        try {
          // Utiliser le géocodage avec fallback pour les enseignants aussi
          const result = await geocodeAddressWithFallback(teacher.adresse!);
          
          if (result.point) {
            await updateEnseignant(teacher.id, { 
              lat: result.point.lat, 
              lon: result.point.lon, 
              geoStatus: result.status,
              geoErrorMessage: undefined,
            });
            
            if (result.precision !== 'FULL') {
              console.log(`Enseignant ${teacher.id}: Fallback vers ${result.precision} (${result.queryUsed})`);
            }
          } else {
            await updateEnseignant(teacher.id, { 
              geoStatus: 'error', 
              geoErrorMessage: result.errorMessage || 'Adresse non trouvée' 
            });
            setProgress(p => ({ ...p, errors: p.errors + 1 }));
          }
        } catch (err) {
          await updateEnseignant(teacher.id, { geoStatus: 'error', geoErrorMessage: String(err) });
          setProgress(p => ({ ...p, errors: p.errors + 1 }));
        }
        
        // Petit délai pour UI (rate limit géré par le provider hybride)
        await new Promise(r => setTimeout(r, 100));
      }
      
      setProgress(p => ({ ...p, completed: total, phase: 'Terminé' }));
    } finally {
      setIsGeocoding(false);
      // Reload to get updated data
      await loadStages();
      await loadEnseignants();
    }
  }, [stages, enseignants, updateStageGeoExtended, setStageGeoError, updateEnseignant, loadStages, loadEnseignants]);

  // ----- Routes Computation Handler -----
  // ----- Matching Handler -----
  const handleRunMatching = useCallback(() => {
    setIsMatching(true);
    
    try {
      const stageInfos: StageGeoInfo[] = stages
        .filter(s => s.adresse && (s.geoStatus === 'ok' || s.geoStatus === 'manual'))
        .map(s => toStageGeoInfo(s as Stage & { adresse: string; geoStatus: string }));

      const teacherInfos: EnseignantGeoInfo[] = enseignants
        .filter(e => e.geoStatus === 'ok' || e.geoStatus === 'manual')
        .map(e => toEnseignantGeoInfo(e));

      const result = solveStageMatching(stageInfos, teacherInfos, pairs, {
        dureeMaxMin: 60,
        distanceMaxKm: 50,
        useLocalSearch: true,
        maxIterations: 500,
        clusterDistanceKm: 1,
        verbose: true,
      });
      
      setMatchingResult(result);
    } catch (err) {
      console.error('Matching error:', err);
    } finally {
      setIsMatching(false);
    }
  }, [stages, enseignants, pairs]);

  // ----- Test Data Handlers -----

  // Générer des stages fictifs pour les élèves de 3ème
  const handleGenerateFakeStages = useCallback(async () => {
    setIsGenerating(true);
    try {
      // Filtrer les élèves de 3ème uniquement
      const eleves3eme = eleves.filter(e => e.classe.startsWith('3'));
      
      if (eleves3eme.length === 0) {
        console.warn('Aucun élève de 3ème trouvé');
        return;
      }
      
      // Générer les stages fictifs
      const fakeStages = generateFakeStages(eleves3eme);
      
      // Utiliser un scenarioId fictif pour les tests
      const testScenarioId = 'test-scenario-stage';
      
      // Créer chaque stage en base
      for (const stageData of fakeStages) {
        await addStage({
          eleveId: stageData.eleveId,
          scenarioId: testScenarioId,
          nomEntreprise: stageData.nomEntreprise,
          adresse: stageData.adresseStage,
          tuteur: stageData.tuteurEntreprise,
          tuteurTel: stageData.telephoneEntreprise,
          dateDebut: stageData.dateDebut,
          dateFin: stageData.dateFin,
          geoStatus: 'pending',
          isTest: true,
        });
      }
      
      console.log(`Created ${fakeStages.length} fake stages for 3ème students`);
      await loadStages();
    } catch (err) {
      console.error('Error generating fake stages:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [eleves, addStage, loadStages]);

  // Supprimer les stages fictifs
  const handleDeleteFakeStages = useCallback(async () => {
    setIsGenerating(true);
    try {
      const fakeStages = stages.filter(s => isFakeStage(s));
      
      for (const stage of fakeStages) {
        await deleteStage(stage.id);
      }
      
      console.log(`Deleted ${fakeStages.length} fake stages`);
      await loadStages();
    } catch (err) {
      console.error('Error deleting fake stages:', err);
    } finally {
      setIsGenerating(false);
    }
  }, [stages, deleteStage, loadStages]);

  // Tab counts
  const geocodedCount = stages.filter(s => s.geoStatus === 'ok' || s.geoStatus === 'manual').length;
  const assignedCount = matchingResult?.stats.totalAffectes ?? 0;

  return (
    <div className="suivi-stage-page">
      <h1>🎒 Suivi de Stage</h1>
      
      {/* Tabs */}
      <div className="stage-tabs">
        <button 
          className={`stage-tab ${activeTab === 'addresses' ? 'active' : ''}`}
          onClick={() => setActiveTab('addresses')}
        >
          📍 Adresses & Géocodage
          <span className="count-badge">{geocodedCount}/{stages.length}</span>
        </button>
        <button
          className={`stage-tab ${activeTab === 'matching' ? 'active' : ''}`}
          onClick={() => setActiveTab('matching')}
        >
          🎯 Affectation
          <span className="count-badge">{assignedCount}/{stages.length}</span>
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'addresses' && (
        <AddressesTab
          stages={stages}
          enseignants={enseignants}
          onGeocodeAll={handleGeocodeAll}
          isGeocoding={isGeocoding}
          progress={progress}
          onGenerateFakeStages={handleGenerateFakeStages}
          onDeleteFakeStages={handleDeleteFakeStages}
          isGenerating={isGenerating}
        />
      )}
      
      {activeTab === 'matching' && (
        <MatchingTab
          stages={stages}
          enseignants={enseignants}
          pairs={pairs}
          result={matchingResult}
          onRunMatching={handleRunMatching}
          isRunning={isMatching}
        />
      )}
    </div>
  );
}

export default SuiviStagePage;
