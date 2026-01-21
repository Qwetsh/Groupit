// ============================================================
// VALIDATED ASSIGNMENT DRAWER
// Drawer component for viewing validated assignment details
// ============================================================

import React, { useMemo } from 'react';
import type { ScenarioArchive } from '../../domain/models';
import { formatArchiveDate, getScenarioTypeLabel } from '../../services';
import {
  X,
  Calendar,
  Users,
  GraduationCap,
  BookOpen,
  Briefcase,
  FileText,
  FileSpreadsheet,
  BarChart3,
  MapPin
} from 'lucide-react';
import './ValidatedAssignment.css';

interface ValidatedAssignmentDrawerProps {
  archive: ScenarioArchive;
  isOpen: boolean;
  onClose: () => void;
  onExportPdf: () => void;
  onExportCsv: () => void;
}

export const ValidatedAssignmentDrawer: React.FC<ValidatedAssignmentDrawerProps> = ({
  archive,
  isOpen,
  onClose,
  onExportPdf,
  onExportCsv,
}) => {
  if (!isOpen) return null;

  // Group affectations by enseignant (deduplicate for jury mode)
  const enseignantAffectations = useMemo(() => {
    const map = new Map<string, typeof archive.affectations[0]>();

    archive.affectations.forEach(aff => {
      if (!map.has(aff.enseignantId)) {
        map.set(aff.enseignantId, aff);
      }
    });

    return Array.from(map.values());
  }, [archive.affectations]);

  // Get participants info map
  const participantsMap = useMemo(() => {
    const map = new Map<string, typeof archive.participants[0]>();
    archive.participants.forEach(p => map.set(p.enseignantId, p));
    return map;
  }, [archive.participants]);

  const typeIcon = archive.scenarioType === 'oral_dnb' ? (
    <BookOpen size={16} />
  ) : archive.scenarioType === 'suivi_stage' ? (
    <Briefcase size={16} />
  ) : (
    <Users size={16} />
  );

  return (
    <>
      <div className="validated-assignment-drawer-overlay" onClick={onClose} />
      <div className="validated-assignment-drawer">
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-info">
            <span className={`type-badge ${archive.scenarioType}`}>
              {typeIcon}
              {getScenarioTypeLabel(archive.scenarioType)}
            </span>
            <h2>{archive.scenarioNom}</h2>
            <span className="date">
              <Calendar size={14} style={{ display: 'inline', marginRight: 4 }} />
              Validé le {formatArchiveDate(new Date(archive.archivedAt))}
            </span>
          </div>
          <button className="drawer-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="drawer-content">
          {/* Stats */}
          <div className="drawer-section">
            <h3>
              <BarChart3 size={16} />
              Statistiques
            </h3>
            <div className="drawer-stats-grid">
              <div className="drawer-stat">
                <div className="value">{archive.stats.nbEleves}</div>
                <div className="label">Élèves</div>
              </div>
              <div className="drawer-stat">
                <div className="value">{archive.stats.nbEnseignants}</div>
                <div className="label">Enseignants</div>
              </div>
              <div className="drawer-stat">
                <div className="value">{archive.stats.nbAffectations}</div>
                <div className="label">Affectations</div>
              </div>
              {archive.stats.tauxAffectation !== undefined && (
                <div className="drawer-stat success">
                  <div className="value">{archive.stats.tauxAffectation}%</div>
                  <div className="label">Taux d'affectation</div>
                </div>
              )}
              {archive.stats.scoreGlobal !== undefined && archive.stats.scoreGlobal > 0 && (
                <div className="drawer-stat">
                  <div className="value">{archive.stats.scoreGlobal}</div>
                  <div className="label">Score moyen</div>
                </div>
              )}
            </div>

            {/* Type-specific metadata */}
            {archive.scenarioType === 'oral_dnb' && archive.metadata?.jurys && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#64748b' }}>
                {archive.metadata.jurys.length} jury(s) configuré(s)
              </div>
            )}
            {archive.scenarioType === 'suivi_stage' && archive.metadata?.distanceMoyenneKm && (
              <div style={{ marginTop: 12, fontSize: 13, color: '#64748b', display: 'flex', alignItems: 'center', gap: 6 }}>
                <MapPin size={14} />
                Distance moyenne : {archive.metadata.distanceMoyenneKm} km
                {archive.metadata.dureeMoyenneMin && ` (~${archive.metadata.dureeMoyenneMin} min)`}
              </div>
            )}
          </div>

          {/* Enseignants & Eleves */}
          <div className="drawer-section">
            <h3>
              <GraduationCap size={16} />
              Affectations par enseignant
            </h3>
            <div className="enseignant-list">
              {enseignantAffectations.map((aff) => {
                const participant = participantsMap.get(aff.enseignantId);
                if (!participant) return null;

                return (
                  <div key={aff.enseignantId} className="enseignant-item">
                    <div className="enseignant-item-header">
                      <div className="enseignant-item-name">
                        <div className="avatar">
                          {participant.enseignantPrenom?.[0]}{participant.enseignantNom[0]}
                        </div>
                        <span className="name">
                          {participant.enseignantPrenom} {participant.enseignantNom}
                        </span>
                      </div>
                      {(participant.roleLabel || aff.juryNom) && (
                        <span className="enseignant-item-role">
                          {aff.juryNom || participant.roleLabel}
                        </span>
                      )}
                    </div>
                    <div className="eleves-list">
                      {aff.eleves.map((eleve, i) => (
                        <div key={`${eleve.eleveId}-${i}`} className="eleve-chip">
                          <span className="eleve-name">
                            {eleve.elevePrenom} {eleve.eleveNom}
                          </span>
                          <span className="eleve-classe">{eleve.eleveClasse}</span>
                          {archive.scenarioType === 'oral_dnb' && eleve.matiereOral && (
                            <span className="eleve-meta">{eleve.matiereOral}</span>
                          )}
                          {archive.scenarioType === 'suivi_stage' && eleve.entreprise && (
                            <span className="eleve-meta">{eleve.entreprise}</span>
                          )}
                          {archive.scenarioType === 'suivi_stage' && eleve.distanceKm && (
                            <span className="eleve-meta">{eleve.distanceKm} km</span>
                          )}
                        </div>
                      ))}
                      {aff.eleves.length === 0 && (
                        <span style={{ color: '#94a3b8', fontSize: 13 }}>
                          Aucun élève affecté
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer with export buttons */}
        <div className="drawer-footer">
          <button className="btn-export" onClick={onExportPdf}>
            <FileText size={16} />
            Exporter PDF
          </button>
          <button className="btn-export" onClick={onExportCsv}>
            <FileSpreadsheet size={16} />
            Exporter CSV
          </button>
        </div>
      </div>
    </>
  );
};

export default ValidatedAssignmentDrawer;
