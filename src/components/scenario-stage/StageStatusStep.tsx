// ============================================================
// STAGE STATUS STEP - Affiche l'état des stages (source: Élèves > Stage)
// Remplace l'ancien import - les stages viennent maintenant de la source unique
// ============================================================

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Stage, Eleve, Enseignant } from '../../domain/models';
import {
  CheckCircle,
  AlertTriangle,
  MapPin,
  XCircle,
  ExternalLink,
  Building2,
  Users,
  Navigation,
} from 'lucide-react';

interface StageStatusStepProps {
  stages: Stage[];
  eleves: Eleve[];
  enseignants: Enseignant[];
  onStartRouteCalc: () => void;
  isComputingRoutes: boolean;
  routesComputed: number;
}

type StageDisplayStatus = 'complet' | 'incomplet' | 'sans_adresse' | 'geocode_ok' | 'geocode_error' | 'geocode_pending';

interface EleveStageInfo {
  eleve: Eleve;
  stage: Stage | undefined;
  status: StageDisplayStatus;
}

export function StageStatusStep({
  stages,
  eleves,
  enseignants,
  onStartRouteCalc,
  isComputingRoutes,
  routesComputed,
}: StageStatusStepProps) {
  const navigate = useNavigate();

  // Mapper les élèves avec leurs stages
  const elevesWithStages: EleveStageInfo[] = useMemo(() => {
    const stagesByEleveId = new Map<string, Stage>();
    stages.forEach((s: Stage) => {
      if (s.eleveId) {
        stagesByEleveId.set(s.eleveId, s);
      }
    });

    return eleves.map(eleve => {
      const stage = stagesByEleveId.get(eleve.id!);
      let status: StageDisplayStatus = 'incomplet';

      if (!stage) {
        status = 'incomplet';
      } else if (!stage.adresse) {
        status = 'sans_adresse';
      } else if (stage.geoStatus === 'ok' || stage.geoStatus === 'manual') {
        status = 'geocode_ok';
      } else if (stage.geoStatus === 'error' || stage.geoStatus === 'not_found') {
        status = 'geocode_error';
      } else if (stage.geoStatus === 'pending') {
        status = 'geocode_pending';
      } else if (stage.nomEntreprise && stage.adresse) {
        status = 'complet';
      }

      return { eleve, stage, status };
    });
  }, [eleves, stages]);

  // Stats
  const stats = useMemo(() => {
    const withStage = elevesWithStages.filter(e => e.stage).length;
    const withoutStage = elevesWithStages.filter(e => !e.stage).length;
    const geocodeOk = elevesWithStages.filter(e => e.status === 'geocode_ok').length;
    const geocodeError = elevesWithStages.filter(e => e.status === 'geocode_error').length;
    const geocodePending = elevesWithStages.filter(e => e.status === 'geocode_pending').length;
    const withoutAddress = elevesWithStages.filter(e => e.status === 'sans_adresse').length;

    const enseignantsGeocodes = enseignants.filter(
      e => (e.geoStatus === 'ok' || e.geoStatus === 'manual') && e.lat && e.lon
    ).length;

    return {
      total: eleves.length,
      withStage,
      withoutStage,
      geocodeOk,
      geocodeError,
      geocodePending,
      withoutAddress,
      enseignantsTotal: enseignants.length,
      enseignantsGeocodes,
      // Prêt pour le calcul si au moins 1 stage et 1 enseignant géocodés
      readyForRouting: geocodeOk > 0 && enseignantsGeocodes > 0,
    };
  }, [elevesWithStages, enseignants, eleves.length]);

  const getStatusBadge = (status: StageDisplayStatus) => {
    switch (status) {
      case 'geocode_ok':
        return <span className="status-badge geocoded"><MapPin size={12} /> Géocodé</span>;
      case 'geocode_pending':
        return <span className="status-badge pending"><AlertTriangle size={12} /> En attente</span>;
      case 'geocode_error':
        return <span className="status-badge error"><XCircle size={12} /> Erreur géo</span>;
      case 'complet':
        return <span className="status-badge complete"><CheckCircle size={12} /> Complet</span>;
      case 'sans_adresse':
        return <span className="status-badge warning"><AlertTriangle size={12} /> Sans adresse</span>;
      case 'incomplet':
        return <span className="status-badge empty">Non renseigné</span>;
    }
  };

  const handleGoToStages = () => {
    navigate('/eleves');
  };

  return (
    <div className="stage-status-step">
      {/* Alertes non bloquantes */}
      {stats.withoutStage > 0 && (
        <div className="status-alert warning">
          <AlertTriangle size={18} />
          <div className="alert-content">
            <strong>{stats.withoutStage} élève(s) sans stage renseigné</strong>
            <span>Ces élèves seront ignorés lors du matching</span>
          </div>
          <button className="btn-link" onClick={handleGoToStages}>
            Compléter les stages <ExternalLink size={14} />
          </button>
        </div>
      )}

      {stats.geocodePending > 0 && (
        <div className="status-alert info">
          <AlertTriangle size={18} />
          <div className="alert-content">
            <strong>{stats.geocodePending} adresse(s) en attente de géocodage</strong>
            <span>Le géocodage se fait automatiquement dans "Élèves &gt; Stage"</span>
          </div>
          <button className="btn-link" onClick={handleGoToStages}>
            Gérer les stages <ExternalLink size={14} />
          </button>
        </div>
      )}

      {stats.geocodeError > 0 && (
        <div className="status-alert error">
          <XCircle size={18} />
          <div className="alert-content">
            <strong>{stats.geocodeError} adresse(s) non géocodée(s)</strong>
            <span>Vérifiez les adresses dans "Élèves &gt; Stage"</span>
          </div>
          <button className="btn-link" onClick={handleGoToStages}>
            Corriger les adresses <ExternalLink size={14} />
          </button>
        </div>
      )}

      {/* Stats résumé */}
      <div className="status-stats-row">
        <div className={`stat-card ${stats.withStage > 0 ? 'success' : 'warning'}`}>
          <Building2 size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.withStage}/{stats.total}</span>
            <span className="stat-label">Stages renseignés</span>
          </div>
        </div>
        <div className={`stat-card ${stats.geocodeOk > 0 ? 'success' : 'warning'}`}>
          <MapPin size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.geocodeOk}</span>
            <span className="stat-label">Stages géocodés</span>
          </div>
        </div>
        <div className={`stat-card ${stats.enseignantsGeocodes > 0 ? 'success' : 'warning'}`}>
          <Users size={20} />
          <div className="stat-info">
            <span className="stat-value">{stats.enseignantsGeocodes}/{stats.enseignantsTotal}</span>
            <span className="stat-label">Enseignants géocodés</span>
          </div>
        </div>
        <div className="stat-card">
          <Navigation size={20} />
          <div className="stat-info">
            <span className="stat-value">{routesComputed}</span>
            <span className="stat-label">Trajets calculés</span>
          </div>
        </div>
      </div>

      {/* Tableau des élèves et leur statut */}
      <div className="status-section">
        <div className="section-header">
          <h4>État des stages ({eleves.length} élèves)</h4>
          <button className="btn-link" onClick={handleGoToStages}>
            Gérer dans "Élèves &gt; Stage" <ExternalLink size={14} />
          </button>
        </div>

        <div className="status-table-container">
          <table className="status-table">
            <thead>
              <tr>
                <th>Élève</th>
                <th>Classe</th>
                <th>Entreprise</th>
                <th>Adresse</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {elevesWithStages.slice(0, 50).map(({ eleve, stage, status }) => (
                <tr key={eleve.id} className={status === 'incomplet' ? 'row-warning' : ''}>
                  <td className="name-cell">{eleve.prenom} {eleve.nom}</td>
                  <td>{eleve.classe || '-'}</td>
                  <td>{stage?.nomEntreprise || '-'}</td>
                  <td className="address-cell" title={stage?.adresse}>
                    {stage?.adresse
                      ? stage.adresse.length > 40
                        ? stage.adresse.substring(0, 40) + '...'
                        : stage.adresse
                      : '-'}
                  </td>
                  <td>{getStatusBadge(status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {elevesWithStages.length > 50 && (
            <p className="table-more">... et {elevesWithStages.length - 50} autres élèves</p>
          )}
        </div>
      </div>

      {/* Section pré-calcul des trajets */}
      <div className="status-section routes-section">
        <div className="section-header">
          <h4>
            <Navigation size={18} />
            Pré-calcul des trajets
          </h4>
        </div>

        <p className="section-description">
          Calcule les distances entre les stages géocodés et les enseignants.
          Les stages non géocodés seront ignorés.
        </p>

        {!stats.readyForRouting && (
          <div className="info-box">
            <AlertTriangle size={16} />
            <span>
              Au moins 1 stage et 1 enseignant géocodés sont nécessaires pour calculer les trajets.
            </span>
          </div>
        )}

        <div className="section-actions">
          <button
            className="btn-primary"
            onClick={onStartRouteCalc}
            disabled={isComputingRoutes || !stats.readyForRouting}
          >
            {isComputingRoutes ? (
              <>Calcul en cours...</>
            ) : (
              <>
                <Navigation size={16} />
                Calculer les trajets ({stats.geocodeOk} stages)
              </>
            )}
          </button>
        </div>

        {routesComputed > 0 && !isComputingRoutes && (
          <div className="success-info">
            <CheckCircle size={16} />
            {routesComputed} paire(s) enseignant-stage calculée(s)
          </div>
        )}
      </div>
    </div>
  );
}
