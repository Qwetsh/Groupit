import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScenarioStore } from '../stores/scenarioStore';
import { useUIStore } from '../stores/uiStore';
import type { Scenario } from '../domain/models';
import { JuryManager } from '../components/jury';
import { ImportMatiereOralModal } from '../components/import';
import { StageScenarioManager } from '../components/scenario-stage';
import {
  Plus,
  Play,
  Edit2,
  Trash2,
  Copy,
  Check,
  Settings,
  ChevronDown,
  ChevronUp,
  Users,
  BookOpen,
  Upload,
  Briefcase
} from 'lucide-react';
import { HelpTooltip, HELP_TEXTS } from '../components/ui/Tooltip';
import './ScenariosPage.css';

export const ScenariosPage: React.FC = () => {
  const navigate = useNavigate();
  const scenarios = useScenarioStore(state => state.scenarios);
  const currentScenarioId = useScenarioStore(state => state.currentScenarioId);
  const setCurrentScenario = useScenarioStore(state => state.setCurrentScenario);
  const deleteScenario = useScenarioStore(state => state.deleteScenario);
  const openModal = useUIStore(state => state.openModal);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [importMatiereScenarioId, setImportMatiereScenarioId] = useState<string | null>(null);

  const handleCreateNew = () => {
    openModal('editScenario');
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleActivate = async (id: string) => {
    setCurrentScenario(id);
  };

  const handleLaunch = async (id: string) => {
    setCurrentScenario(id);
    navigate('/board');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce scénario ?')) {
      await deleteScenario(id);
    }
  };

  const handleDuplicate = async (scenario: Scenario) => {
    const addScenario = useScenarioStore.getState().addScenario;
    const duplicated: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt'> = {
      nom: `${scenario.nom} (copie)`,
      description: scenario.description,
      mode: scenario.mode,
      type: scenario.type,
      parametres: JSON.parse(JSON.stringify(scenario.parametres)),
    };
    await addScenario(duplicated);
  };

  const handleEdit = (scenarioId: string) => {
    openModal('editScenario', { scenarioId });
  };

  const getCritereLabel = (id: string) => {
    const labels: Record<string, string> = {
      distance: 'Distance',
      equilibrage: 'Équilibrage',
      mixite: 'Mixité',
      niveauScolaire: 'Niveau scolaire',
      preferences: 'Préférences',
      matiere: 'Matière',
      capacite: 'Capacité',
      contraintes_relationnelles: 'Contraintes relationnelles',
      classe: 'Classe',
      secteur: 'Secteur géographique',
    };
    return labels[id] || id;
  };

  const getTypeLabel = (type?: string) => {
    switch (type) {
      case 'oral_dnb': return 'Oral du DNB';
      case 'suivi_stage': return 'Suivi de stage';
      default: return 'Standard';
    }
  };

  return (
    <div className="scenarios-page">
      <div className="page-header">
        <div className="header-left">
          <h1>Scénarios</h1>
          <span className="count">{scenarios.length} scénario(s)</span>
        </div>
        <div className="header-actions">
          <button className="btn-primary" onClick={handleCreateNew}>
            <Plus size={18} />
            Nouveau scénario
          </button>
        </div>
      </div>

      <div className="scenarios-list">
        {scenarios.map(scenario => (
          <div 
            key={scenario.id} 
            className={`scenario-card ${currentScenarioId === scenario.id ? 'active' : ''}`}
          >
            <div className="card-main" onClick={() => toggleExpand(scenario.id!)}>
              <div className="card-info">
                <div className="card-title">
                  <h3>{scenario.nom}</h3>
                  <span className={`type-badge ${scenario.type || 'standard'}`}>
                    {scenario.type === 'oral_dnb' && <BookOpen size={12} />}
                    {scenario.type === 'suivi_stage' && <Briefcase size={12} />}
                    {getTypeLabel(scenario.type)}
                  </span>
                  <HelpTooltip content={HELP_TEXTS.scenarios.type} size={14} />
                  {currentScenarioId === scenario.id && (
                    <span className="active-badge">
                      <Check size={12} />
                      Actif
                    </span>
                  )}
                </div>
                {scenario.description && (
                  <p className="description">{scenario.description}</p>
                )}
                <div className="criteres-preview">
                  {scenario.parametres.criteres
                    .filter(c => c.actif)
                    .sort((a, b) => b.poids - a.poids)
                    .slice(0, 4)
                    .map((c, i) => (
                      <span key={i} className={`critere-tag ${c.poids >= 50 ? 'high' : c.poids >= 20 ? 'medium' : 'low'}`}>
                        {getCritereLabel(c.id)}
                      </span>
                    ))}
                  {scenario.parametres.criteres.filter(c => c.actif).length > 4 && (
                    <span className="critere-more">
                      +{scenario.parametres.criteres.filter(c => c.actif).length - 4}
                    </span>
                  )}
                </div>
              </div>

              <div className="card-actions">
                <button 
                  className="btn-action launch"
                  onClick={(e) => { e.stopPropagation(); handleLaunch(scenario.id!); }}
                  title="Lancer les affectations"
                >
                  <Play size={16} />
                  <span>Lancer</span>
                </button>
                {currentScenarioId !== scenario.id && (
                  <button 
                    className="btn-action activate"
                    onClick={(e) => { e.stopPropagation(); handleActivate(scenario.id!); }}
                    title="Activer ce scénario"
                  >
                    <Check size={16} />
                  </button>
                )}
                <button 
                  className="btn-action"
                  onClick={(e) => { e.stopPropagation(); handleEdit(scenario.id!); }}
                  title="Modifier"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  className="btn-action"
                  onClick={(e) => { e.stopPropagation(); handleDuplicate(scenario); }}
                  title="Dupliquer"
                >
                  <Copy size={16} />
                </button>
                <button 
                  className="btn-action danger"
                  onClick={(e) => { e.stopPropagation(); handleDelete(scenario.id!); }}
                  title="Supprimer"
                >
                  <Trash2 size={16} />
                </button>
                <button className="btn-expand">
                  {expandedId === scenario.id ? (
                    <ChevronUp size={18} />
                  ) : (
                    <ChevronDown size={18} />
                  )}
                </button>
              </div>
            </div>

            {expandedId === scenario.id && (
              <div className="card-details">
                {/* Résumé scoring simplifié */}
                <div className="details-section scoring-summary">
                  <h4>
                    <Settings size={16} />
                    Configuration du scoring
                    <HelpTooltip content={HELP_TEXTS.scenarios.criteria} />
                  </h4>
                  <div className="scoring-grid">
                    <div className="scoring-item">
                      <span className="scoring-label">
                        Capacité par défaut
                        <HelpTooltip content={HELP_TEXTS.scenarios.capacity} size={14} />
                      </span>
                      <span className="scoring-value">{scenario.parametres.capaciteConfig.capaciteBaseDefaut} élèves</span>
                    </div>
                    <div className="scoring-item">
                      <span className="scoring-label">
                        Équilibrage automatique
                        <HelpTooltip content={HELP_TEXTS.scenarios.equilibrage} size={14} />
                      </span>
                      <span className={`scoring-value ${scenario.parametres.equilibrageActif ? 'active' : ''}`}>
                        {scenario.parametres.equilibrageActif ? 'Activé' : 'Désactivé'}
                      </span>
                    </div>
                    {scenario.parametres.criteres.filter(c => c.estContrainteDure).length > 0 && (
                      <div className="scoring-item constraints">
                        <span className="scoring-label">
                          Contraintes
                          <HelpTooltip content={HELP_TEXTS.scenarios.hardConstraint} size={14} />
                        </span>
                        <div className="constraints-inline">
                          {scenario.parametres.criteres.filter(c => c.estContrainteDure).map((c, i) => (
                            <span key={i} className="constraint-tag-mini">{getCritereLabel(c.id)}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Section Import Matières pour Oral DNB */}
                {scenario.type === 'oral_dnb' && (
                  <div className="details-section import-matieres-section">
                    <h4>
                      <BookOpen size={16} />
                      Matières Oral des élèves
                    </h4>
                    <p className="section-description">
                      Importez les matières choisies par chaque élève pour leur oral du DNB.
                    </p>
                    <button 
                      className="btn-import-matieres"
                      onClick={() => setImportMatiereScenarioId(scenario.id!)}
                    >
                      <Upload size={16} />
                      Importer les matières (CSV)
                    </button>
                  </div>
                )}

                {/* Section Jurys pour Oral DNB */}
                {scenario.type === 'oral_dnb' && (
                  <div className="details-section jurys-section">
                    <h4>
                      <Users size={16} />
                      Gestion des Jurys
                    </h4>
                    <JuryManager scenario={scenario} />
                  </div>
                )}

                {/* Section Suivi de Stage */}
                {scenario.type === 'suivi_stage' && (
                  <div className="details-section stage-section">
                    <h4>
                      <Briefcase size={16} />
                      Gestion du Suivi de Stage
                    </h4>
                    <StageScenarioManager scenario={scenario} />
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {scenarios.length === 0 && (
        <div className="empty-state">
          <p>Aucun scénario configuré</p>
          <span>Créez un scénario pour définir les règles d'affectation</span>
          <button className="btn-primary" onClick={handleCreateNew}>
            <Plus size={18} />
            Créer mon premier scénario
          </button>
        </div>
      )}

      {/* Modal Import Matières Oral */}
      {importMatiereScenarioId && (
        <ImportMatiereOralModal
          onClose={() => setImportMatiereScenarioId(null)}
          matieresAutorisees={
            scenarios.find(s => s.id === importMatiereScenarioId)?.parametres.oralDnb?.matieresAutorisees
          }
        />
      )}
    </div>
  );
};
