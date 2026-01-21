// ============================================================
// VALIDATED ASSIGNMENT CARD
// Card component for displaying validated assignments in dashboard
// ============================================================

import React from 'react';
import type { ScenarioArchive } from '../../domain/models';
import { formatArchiveDate, getScenarioTypeLabel } from '../../services';
import {
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  Briefcase,
  FileText,
  FileSpreadsheet,
  Eye,
  CheckCircle
} from 'lucide-react';
import './ValidatedAssignment.css';

interface ValidatedAssignmentCardProps {
  archive: ScenarioArchive;
  onViewDetail: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
}

export const ValidatedAssignmentCard: React.FC<ValidatedAssignmentCardProps> = ({
  archive,
  onViewDetail,
  onExportPdf,
  onExportCsv,
}) => {
  const typeIcon = archive.scenarioType === 'oral_dnb' ? (
    <BookOpen size={16} />
  ) : archive.scenarioType === 'suivi_stage' ? (
    <Briefcase size={16} />
  ) : (
    <Users size={16} />
  );

  // Extract unique classes from affectations
  const classes = [...new Set(
    archive.affectations.flatMap(a => a.eleves.map(e => e.eleveClasse))
  )].filter(Boolean).sort();

  return (
    <div className="validated-assignment-card">
      <div className="card-header">
        <div className="card-type">
          {typeIcon}
          <span>{getScenarioTypeLabel(archive.scenarioType)}</span>
        </div>
        <div className="card-date">
          <Calendar size={14} />
          <span>{formatArchiveDate(new Date(archive.archivedAt))}</span>
        </div>
      </div>

      <h3 className="card-title">{archive.scenarioNom}</h3>

      <div className="card-stats">
        <div className="stat">
          <Users size={16} />
          <span className="stat-value">{archive.stats.nbEleves}</span>
          <span className="stat-label">élèves</span>
        </div>
        <div className="stat">
          <GraduationCap size={16} />
          <span className="stat-value">{archive.stats.nbEnseignants}</span>
          <span className="stat-label">enseignants</span>
        </div>
        {archive.stats.tauxAffectation !== undefined && (
          <div className="stat success">
            <CheckCircle size={16} />
            <span className="stat-value">{archive.stats.tauxAffectation}%</span>
            <span className="stat-label">taux</span>
          </div>
        )}
      </div>

      {classes.length > 0 && (
        <div className="card-classes">
          {classes.slice(0, 4).map((c, i) => (
            <span key={i} className="class-badge">{c}</span>
          ))}
          {classes.length > 4 && (
            <span className="class-more">+{classes.length - 4}</span>
          )}
        </div>
      )}

      {/* Metadata specific to type */}
      {archive.scenarioType === 'oral_dnb' && archive.metadata?.jurys && (
        <div className="card-metadata">
          <span className="metadata-item">
            {archive.metadata.jurys.length} jury(s)
          </span>
        </div>
      )}
      {archive.scenarioType === 'suivi_stage' && archive.metadata?.distanceMoyenneKm && (
        <div className="card-metadata">
          <span className="metadata-item">
            ~{archive.metadata.distanceMoyenneKm} km en moyenne
          </span>
        </div>
      )}

      <div className="card-actions">
        <button className="btn-action-card primary" onClick={onViewDetail}>
          <Eye size={14} />
          Voir détail
        </button>
        <button className="btn-action-card" onClick={onExportPdf} title="Exporter en PDF">
          <FileText size={14} />
        </button>
        <button className="btn-action-card" onClick={onExportCsv} title="Exporter en CSV">
          <FileSpreadsheet size={14} />
        </button>
      </div>
    </div>
  );
};

export default ValidatedAssignmentCard;
