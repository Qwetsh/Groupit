// ============================================================
// VALIDATION SUMMARY - Résumé complet avant validation
// ============================================================

import React, { useMemo } from 'react';
import {
  Users,
  UserCheck,
  UserX,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  MapPin,
  Clock,
  BookOpen,
  Layers,
  BarChart3,
  Award,
} from 'lucide-react';
import type { Scenario, Affectation, Eleve, Enseignant, Jury, Stage } from '../../domain/models';
import './ValidationSummary.css';

// ============================================================
// TYPES
// ============================================================

interface ValidationSummaryProps {
  scenario: Scenario;
  affectations: Affectation[];
  eleves: Eleve[];
  enseignants: Enseignant[];
  jurys?: Jury[];
  stages?: Stage[];
  // For stage scenarios - computed distances
  stageDistances?: Map<string, { distanceKm: number; dureeMin: number }>;
}

interface StatCard {
  id: string;
  label: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

interface ClassBreakdown {
  classe: string;
  total: number;
  affected: number;
  rate: number;
}

// ============================================================
// COMPONENT
// ============================================================

export const ValidationSummary: React.FC<ValidationSummaryProps> = ({
  scenario,
  affectations,
  eleves,
  enseignants,
  jurys = [],
  stages = [],
  stageDistances,
}) => {
  // Determine scenario type
  const isJuryMode = scenario.type === 'oral_dnb' && scenario.parametres?.oralDnb?.utiliserJurys;
  const isStageScenario = scenario.type === 'suivi_stage';

  // Calculate base statistics
  const stats = useMemo(() => {
    const assignedEleveIds = new Set(affectations.map(a => a.eleveId));
    const totalEleves = eleves.length;
    const totalAffectes = assignedEleveIds.size;
    const totalNonAffectes = totalEleves - totalAffectes;
    const tauxAffectation = totalEleves > 0 ? Math.round((totalAffectes / totalEleves) * 100) : 0;

    // Calculate average score
    const scores = affectations.filter(a => a.score !== undefined).map(a => a.score!);
    const avgScore = scores.length > 0
      ? Math.round((scores.reduce((sum, s) => sum + s, 0) / scores.length) * 100) / 100
      : null;

    // Calculate matiere match rate for DNB
    let tauxMatchMatiere = 0;
    if (isJuryMode) {
      const withMatch = affectations.filter(a => a.explication?.matiereRespectee).length;
      tauxMatchMatiere = totalAffectes > 0 ? Math.round((withMatch / totalAffectes) * 100) : 0;
    }

    // Unique enseignants involved
    const uniqueEnseignantIds = new Set(affectations.map(a => a.enseignantId));
    const nbEnseignants = uniqueEnseignantIds.size;

    // For jury mode, count total members
    let nbJuryMembers = 0;
    if (isJuryMode) {
      const scenarioJuryIds = new Set(affectations.filter(a => a.juryId).map(a => a.juryId));
      nbJuryMembers = jurys
        .filter(j => scenarioJuryIds.has(j.id))
        .reduce((sum, j) => sum + j.enseignantIds.length, 0);
    }

    // Stage-specific stats
    let distanceMoyenne = 0;
    let dureeMoyenne = 0;
    let distanceMax = 0;
    if (isStageScenario && stageDistances) {
      const distances: number[] = [];
      const durees: number[] = [];
      affectations.forEach(a => {
        const info = stageDistances.get(a.eleveId);
        if (info) {
          distances.push(info.distanceKm);
          durees.push(info.dureeMin);
        }
      });
      if (distances.length > 0) {
        distanceMoyenne = Math.round((distances.reduce((s, d) => s + d, 0) / distances.length) * 10) / 10;
        dureeMoyenne = Math.round(durees.reduce((s, d) => s + d, 0) / durees.length);
        distanceMax = Math.round(Math.max(...distances) * 10) / 10;
      }
    }

    return {
      totalEleves,
      totalAffectes,
      totalNonAffectes,
      tauxAffectation,
      avgScore,
      tauxMatchMatiere,
      nbEnseignants,
      nbJuryMembers,
      nbAffectations: affectations.length,
      distanceMoyenne,
      dureeMoyenne,
      distanceMax,
    };
  }, [affectations, eleves, isJuryMode, isStageScenario, jurys, stageDistances]);

  // Calculate class breakdown
  const classBreakdown = useMemo((): ClassBreakdown[] => {
    const classMap = new Map<string, { total: number; affected: number }>();

    // Count total per class
    eleves.forEach(e => {
      const entry = classMap.get(e.classe) || { total: 0, affected: 0 };
      entry.total++;
      classMap.set(e.classe, entry);
    });

    // Count affected per class
    const assignedEleveIds = new Set(affectations.map(a => a.eleveId));
    eleves.forEach(e => {
      if (assignedEleveIds.has(e.id!)) {
        const entry = classMap.get(e.classe);
        if (entry) entry.affected++;
      }
    });

    // Convert to array and sort
    return Array.from(classMap.entries())
      .map(([classe, data]) => ({
        classe,
        total: data.total,
        affected: data.affected,
        rate: data.total > 0 ? Math.round((data.affected / data.total) * 100) : 0,
      }))
      .sort((a, b) => a.classe.localeCompare(b.classe));
  }, [eleves, affectations]);

  // Build stat cards based on scenario type
  const statCards = useMemo((): StatCard[] => {
    const cards: StatCard[] = [];

    // Common cards
    cards.push({
      id: 'eleves',
      label: 'Élèves éligibles',
      value: stats.totalEleves,
      icon: <Users size={20} />,
      variant: 'default',
    });

    cards.push({
      id: 'affectes',
      label: 'Élèves affectés',
      value: stats.totalAffectes,
      subtitle: `${stats.tauxAffectation}% du total`,
      icon: <UserCheck size={20} />,
      variant: stats.tauxAffectation >= 90 ? 'success' : stats.tauxAffectation >= 70 ? 'warning' : 'danger',
    });

    if (stats.totalNonAffectes > 0) {
      cards.push({
        id: 'non-affectes',
        label: 'Non affectés',
        value: stats.totalNonAffectes,
        subtitle: 'À traiter manuellement',
        icon: <UserX size={20} />,
        variant: 'danger',
      });
    }

    // Scenario-specific cards
    if (isJuryMode) {
      cards.push({
        id: 'jurys',
        label: 'Jurys utilisés',
        value: new Set(affectations.filter(a => a.juryId).map(a => a.juryId)).size,
        subtitle: `${stats.nbJuryMembers} membres au total`,
        icon: <Users size={20} />,
        variant: 'info',
      });

      cards.push({
        id: 'match-matiere',
        label: 'Correspondance matière',
        value: `${stats.tauxMatchMatiere}%`,
        subtitle: 'Élèves avec leur matière choisie',
        icon: <BookOpen size={20} />,
        variant: stats.tauxMatchMatiere >= 80 ? 'success' : stats.tauxMatchMatiere >= 60 ? 'warning' : 'danger',
      });
    } else if (isStageScenario) {
      cards.push({
        id: 'tuteurs',
        label: 'Tuteurs assignés',
        value: stats.nbEnseignants,
        icon: <UserCheck size={20} />,
        variant: 'info',
      });

      if (stats.distanceMoyenne > 0) {
        cards.push({
          id: 'distance',
          label: 'Distance moyenne',
          value: `${stats.distanceMoyenne} km`,
          subtitle: `Max: ${stats.distanceMax} km`,
          icon: <MapPin size={20} />,
          variant: stats.distanceMoyenne <= 15 ? 'success' : stats.distanceMoyenne <= 30 ? 'warning' : 'danger',
        });

        cards.push({
          id: 'duree',
          label: 'Durée moyenne',
          value: `${stats.dureeMoyenne} min`,
          icon: <Clock size={20} />,
          variant: stats.dureeMoyenne <= 30 ? 'success' : stats.dureeMoyenne <= 45 ? 'warning' : 'danger',
        });
      }
    } else {
      // Standard mode
      cards.push({
        id: 'enseignants',
        label: 'Enseignants assignés',
        value: stats.nbEnseignants,
        icon: <UserCheck size={20} />,
        variant: 'info',
      });
    }

    // Score if available
    if (stats.avgScore !== null) {
      cards.push({
        id: 'score',
        label: 'Score moyen',
        value: stats.avgScore.toFixed(2),
        subtitle: 'Qualité des affectations',
        icon: <Award size={20} />,
        variant: stats.avgScore >= 0.8 ? 'success' : stats.avgScore >= 0.5 ? 'warning' : 'danger',
      });
    }

    return cards;
  }, [stats, isJuryMode, isStageScenario, affectations]);

  // Get type label
  const typeLabel = useMemo(() => {
    switch (scenario.type) {
      case 'oral_dnb': return 'Oral du DNB';
      case 'suivi_stage': return 'Suivi de stage';
      default: return 'Standard';
    }
  }, [scenario.type]);

  return (
    <div className="validation-summary">
      {/* Header */}
      <div className="vs-header">
        <div className="vs-scenario-info">
          <span className="vs-scenario-name">{scenario.nom}</span>
          <span className="vs-scenario-type">{typeLabel}</span>
        </div>
        <div className="vs-affectations-badge">
          <Layers size={16} />
          {stats.nbAffectations} affectation{stats.nbAffectations > 1 ? 's' : ''}
        </div>
      </div>

      {/* Stat Cards Grid */}
      <div className="vs-stats-grid">
        {statCards.map(card => (
          <div key={card.id} className={`vs-stat-card ${card.variant || 'default'}`}>
            <div className="vs-stat-icon">{card.icon}</div>
            <div className="vs-stat-content">
              <span className="vs-stat-value">{card.value}</span>
              <span className="vs-stat-label">{card.label}</span>
              {card.subtitle && <span className="vs-stat-subtitle">{card.subtitle}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Class Breakdown */}
      {classBreakdown.length > 0 && classBreakdown.length <= 12 && (
        <div className="vs-class-breakdown">
          <div className="vs-section-header">
            <BarChart3 size={16} />
            <span>Répartition par classe</span>
          </div>
          <div className="vs-class-bars">
            {classBreakdown.map(item => (
              <div key={item.classe} className="vs-class-item">
                <div className="vs-class-info">
                  <span className="vs-class-name">{item.classe}</span>
                  <span className="vs-class-count">{item.affected}/{item.total}</span>
                </div>
                <div className="vs-class-bar">
                  <div
                    className={`vs-class-fill ${item.rate >= 90 ? 'success' : item.rate >= 70 ? 'warning' : 'danger'}`}
                    style={{ width: `${item.rate}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Warnings */}
      {stats.totalNonAffectes > 0 && (
        <div className="vs-warning">
          <AlertTriangle size={16} />
          <span>
            {stats.totalNonAffectes} élève{stats.totalNonAffectes > 1 ? 's' : ''} non affecté{stats.totalNonAffectes > 1 ? 's' : ''}.
            {' '}Vous pourrez les traiter manuellement après validation.
          </span>
        </div>
      )}

      {/* Success indicator */}
      {stats.tauxAffectation >= 90 && (
        <div className="vs-success">
          <CheckCircle size={16} />
          <span>Excellent taux d'affectation ! Les résultats sont prêts pour validation.</span>
        </div>
      )}
    </div>
  );
};
