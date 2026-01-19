// ============================================================
// STAGE GEOCODING STEP - Étape 2: Géocodage & calcul trajets
// ============================================================

import { useState, useCallback, useMemo } from 'react';
import { useStageStore } from '../../stores/stageStore';
import { geocodeAddressWithFallback } from '../../infrastructure/geo/stageGeoWorkflow';
import type { Scenario, Stage, Enseignant } from '../../domain/models';
import { MapPin, Navigation, Play, AlertCircle, Check, RefreshCw, ChevronRight } from 'lucide-react';

interface StageGeocodingStepProps {
  scenario: Scenario;
  stages: Stage[];
  enseignants: Enseignant[];
  onComplete: () => void;
}

export function StageGeocodingStep({ scenario, stages, enseignants, onComplete }: StageGeocodingStepProps) {
  const { updateStage } = useStageStore();
  
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [geocodeProgress, setGeocodeProgress] = useState({ current: 0, total: 0, errors: 0 });
  const [isComputingRoutes, setIsComputingRoutes] = useState(false);
  const [routeProgress, setRouteProgress] = useState({ current: 0, total: 0 });
  const [routesComputed, setRoutesComputed] = useState(0);

  // Stats
  const stageStats = useMemo(() => {
    const pending = stages.filter(s => s.geoStatus === 'pending').length;
    const geocoded = stages.filter(s => s.geoStatus === 'ok' || s.geoStatus === 'manual').length;
    const errors = stages.filter(s => s.geoStatus === 'error').length;
    return { pending, geocoded, errors, total: stages.length };
  }, [stages]);

  const enseignantStats = useMemo(() => {
    const geocoded = enseignants.filter(e => e.geoStatus === 'ok' || e.geoStatus === 'manual').length;
    const withAddress = enseignants.filter(e => e.adresse && e.adresse.trim()).length;
    const missing = enseignants.length - withAddress;
    return { geocoded, withAddress, missing, total: enseignants.length };
  }, [enseignants]);

  // Géocoder les stages en attente (avec fallback ville/mairie)
  const handleGeocodeStages = useCallback(async () => {
    const stagesToGeocode = stages.filter(s => (s.geoStatus === 'pending' || s.geoStatus === 'error') && s.adresse);
    if (stagesToGeocode.length === 0) return;
    
    setIsGeocoding(true);
    setGeocodeProgress({ current: 0, total: stagesToGeocode.length, errors: 0 });
    
    console.log(`🚀 Début géocodage de ${stagesToGeocode.length} stages avec fallback`);
    
    try {
      for (let i = 0; i < stagesToGeocode.length; i++) {
        const stage = stagesToGeocode[i];
        setGeocodeProgress(p => ({ ...p, current: i + 1 }));
        
        console.log(`[${i+1}/${stagesToGeocode.length}] Géocodage: "${stage.adresse}"`);
        
        try {
          // Utiliser le géocodage avec fallback (adresse complète → ville → mairie)
          const result = await geocodeAddressWithFallback(stage.adresse!);
          
          console.log(`  → Résultat: ${result.point ? 'OK' : 'ERREUR'}, précision: ${result.precision}, query: ${result.queryUsed}`);
          
          if (result.point) {
            await updateStage(stage.id, {
              lat: result.point.lat,
              lon: result.point.lon,
              geoStatus: result.status,
              geoErrorMessage: result.precision !== 'FULL' 
                ? `Géolocalisation approximative (${result.precision === 'CITY' ? 'ville' : 'mairie'})`
                : undefined,
            });
            
            if (result.precision !== 'FULL') {
              console.log(`  ⚠️ Fallback utilisé: ${result.precision}`);
            }
          } else {
            await updateStage(stage.id, {
              geoStatus: 'error',
              geoErrorMessage: result.errorMessage || 'Adresse non trouvée',
            });
            setGeocodeProgress(p => ({ ...p, errors: p.errors + 1 }));
            console.log(`  ❌ Échec: ${result.errorMessage}`);
          }
        } catch (error) {
          await updateStage(stage.id, {
            geoStatus: 'error',
            geoErrorMessage: error instanceof Error ? error.message : 'Erreur inconnue',
          });
          setGeocodeProgress(p => ({ ...p, errors: p.errors + 1 }));
          console.error(`  ❌ Exception:`, error);
        }
        
        // Respecter le rate limit Nominatim (1 req/sec)
        await new Promise(r => setTimeout(r, 1100));
      }
    } finally {
      setIsGeocoding(false);
      console.log('✅ Géocodage terminé');
    }
  }, [stages, updateStage]);

  // Relancer le géocodage des erreurs
  const handleRetryErrors = useCallback(async () => {
    const stagesToRetry = stages.filter(s => s.geoStatus === 'error');
    if (stagesToRetry.length === 0) return;
    
    // Reset status to pending
    for (const stage of stagesToRetry) {
      await updateStage(stage.id, { geoStatus: 'pending', geoErrorMessage: undefined });
    }
    
    // Then geocode
    await handleGeocodeStages();
  }, [stages, updateStage, handleGeocodeStages]);

  // Vérifier si prêt pour le routing
  const isReadyForRouting = stageStats.geocoded > 0 && enseignantStats.geocoded > 0;

  // Simuler le calcul des routes (simplifié pour l'instant)
  const handleComputeRoutes = useCallback(async () => {
    if (!isReadyForRouting) return;
    
    setIsComputingRoutes(true);
    
    // Paramètres du scénario
    const distanceMaxKm = scenario.parametres.suiviStage?.distanceMaxKm ?? 50;
    const maxCandidatesPerStage = 5; // N enseignants les plus proches
    
    const geocodedStages = stages.filter(s => (s.geoStatus === 'ok' || s.geoStatus === 'manual') && s.lat && s.lon);
    const geocodedEnseignants = enseignants.filter(e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon);
    
    // Pré-filtrage par distance Haversine (rapide)
    let totalPairs = 0;
    setRouteProgress({ current: 0, total: geocodedStages.length });
    
    for (let i = 0; i < geocodedStages.length; i++) {
      const stage = geocodedStages[i];
      setRouteProgress({ current: i + 1, total: geocodedStages.length });
      
      // Calculer distance haversine vers chaque enseignant
      const distances = geocodedEnseignants.map(ens => ({
        enseignant: ens,
        distance: haversineDistance(stage.lat!, stage.lon!, ens.lat!, ens.lon!),
      }));
      
      // Garder uniquement les N plus proches dans le rayon
      const candidates = distances
        .filter(d => d.distance <= distanceMaxKm)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, maxCandidatesPerStage);
      
      totalPairs += candidates.length;
      
      // Simuler un délai pour le rate limiting (en vrai: appel OSRM)
      await new Promise(r => setTimeout(r, 10));
    }
    
    setRoutesComputed(totalPairs);
    setIsComputingRoutes(false);
  }, [scenario, stages, enseignants, isReadyForRouting]);

  // Tout est prêt pour le matching?
  const canProceed = stageStats.geocoded > 0 && enseignantStats.geocoded > 0;

  return (
    <div className="stage-geocoding-step">
      {/* Stats résumé */}
      <div className="step-stats-row">
        <div className={`stat-card ${stageStats.geocoded === stageStats.total ? 'success' : stageStats.errors > 0 ? 'warning' : ''}`}>
          <div className="stat-card-value">{stageStats.geocoded}/{stageStats.total}</div>
          <div className="stat-card-label">Stages géocodés</div>
        </div>
        <div className={`stat-card ${enseignantStats.geocoded === enseignantStats.total ? 'success' : 'warning'}`}>
          <div className="stat-card-value">{enseignantStats.geocoded}/{enseignantStats.total}</div>
          <div className="stat-card-label">Enseignants géocodés</div>
        </div>
        <div className="stat-card">
          <div className="stat-card-value">{routesComputed}</div>
          <div className="stat-card-label">Trajets calculés</div>
        </div>
      </div>

      {/* Section Géocodage Stages */}
      <div className="step-section">
        <div className="step-section-header">
          <h4>
            <MapPin size={18} />
            Géocodage des stages
          </h4>
          <div className="section-actions">
            {stageStats.errors > 0 && (
              <button 
                className="btn-step secondary small"
                onClick={handleRetryErrors}
                disabled={isGeocoding}
              >
                <RefreshCw size={14} />
                Relancer {stageStats.errors} erreur(s)
              </button>
            )}
            <button 
              className="btn-step primary small"
              onClick={handleGeocodeStages}
              disabled={isGeocoding || stageStats.pending === 0}
            >
              {isGeocoding ? (
                <>
                  <span className="spinner" />
                  {geocodeProgress.current}/{geocodeProgress.total}
                </>
              ) : (
                <>
                  <Play size={14} />
                  Géocoder ({stageStats.pending})
                </>
              )}
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isGeocoding && (
          <div className="step-progress">
            <div className="step-progress-bar">
              <div 
                className="step-progress-fill" 
                style={{ width: `${(geocodeProgress.current / geocodeProgress.total) * 100}%` }}
              />
            </div>
            <span className="step-progress-text">
              {geocodeProgress.current}/{geocodeProgress.total}
              {geocodeProgress.errors > 0 && ` (${geocodeProgress.errors} erreur(s))`}
            </span>
          </div>
        )}

        {/* Liste des stages avec erreurs */}
        {stageStats.errors > 0 && !isGeocoding && (
          <div className="error-list">
            <div className="error-list-header">
              <AlertCircle size={16} />
              {stageStats.errors} adresse(s) non trouvée(s)
            </div>
            <div className="error-list-items">
              {stages.filter(s => s.geoStatus === 'error').slice(0, 5).map(stage => (
                <div key={stage.id} className="error-item">
                  <span className="error-address">{stage.adresse}</span>
                  <span className="error-message">{stage.geoErrorMessage}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Section Enseignants */}
      <div className="step-section">
        <div className="step-section-header">
          <h4>
            <MapPin size={18} />
            Enseignants géocodés
          </h4>
        </div>

        {enseignantStats.missing > 0 && (
          <div className="info-box warning">
            <AlertCircle size={16} />
            <div>
              <strong>{enseignantStats.missing} enseignant(s) sans adresse</strong>
              <p>Les enseignants sont géocodés automatiquement via leur fiche. Modifiez leur adresse dans la page Enseignants.</p>
            </div>
          </div>
        )}

        {enseignantStats.geocoded === 0 && (
          <div className="info-box error">
            <AlertCircle size={16} />
            <div>
              <strong>Aucun enseignant géocodé</strong>
              <p>Le matching nécessite au moins un enseignant avec une adresse géocodée.</p>
            </div>
          </div>
        )}

        {enseignantStats.geocoded > 0 && (
          <div className="success-info">
            <Check size={16} />
            {enseignantStats.geocoded} enseignant(s) prêt(s) pour le matching
          </div>
        )}
      </div>

      {/* Section Calcul Routes */}
      <div className="step-section">
        <div className="step-section-header">
          <h4>
            <Navigation size={18} />
            Pré-calcul des trajets
          </h4>
          <button 
            className="btn-step primary small"
            onClick={handleComputeRoutes}
            disabled={isComputingRoutes || !isReadyForRouting}
          >
            {isComputingRoutes ? (
              <>
                <span className="spinner" />
                {routeProgress.current}/{routeProgress.total}
              </>
            ) : (
              <>
                <Play size={14} />
                Calculer
              </>
            )}
          </button>
        </div>

        <p className="section-description">
          Calcul optimisé : seuls les trajets enseignant-stage dans un rayon de {scenario.parametres.suiviStage?.distanceMaxKm ?? 50} km seront calculés.
        </p>

        {isComputingRoutes && (
          <div className="step-progress">
            <div className="step-progress-bar">
              <div 
                className="step-progress-fill" 
                style={{ width: `${(routeProgress.current / routeProgress.total) * 100}%` }}
              />
            </div>
            <span className="step-progress-text">
              Pré-filtrage des candidats... {routeProgress.current}/{routeProgress.total} stages
            </span>
          </div>
        )}

        {routesComputed > 0 && !isComputingRoutes && (
          <div className="success-info">
            <Check size={16} />
            {routesComputed} paire(s) enseignant-stage identifiée(s)
          </div>
        )}
      </div>

      {/* Message si pas prêt */}
      {!canProceed && (
        <div className="step-actions">
          <div className="step-info-message">
            <AlertCircle size={16} />
            Géocodez les stages et enseignants pour continuer
          </div>
        </div>
      )}
    </div>
  );
}

// Fonction Haversine pour calcul rapide de distance
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
