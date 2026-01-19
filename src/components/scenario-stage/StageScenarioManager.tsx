// ============================================================
// STAGE SCENARIO MANAGER - Conteneur principal (2 étapes)
// Configuration : Import → Géocodage
// Exécution : se fait dans la page Affectations
// ============================================================

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStageStore } from '../../stores/stageStore';
import { useEnseignantStore } from '../../stores/enseignantStore';
import { useEleveStore } from '../../stores/eleveStore';
import { useScenarioStore } from '../../stores/scenarioStore';
import type { Scenario } from '../../domain/models';
import { StageImportStep } from './StageImportStep';
import { StageGeocodingStep } from './StageGeocodingStep';
import { Upload, MapPin, Check, AlertCircle, ChevronRight, ArrowRight } from 'lucide-react';
import './StageScenarioManager.css';

// Types
export type StageStep = 'import' | 'geocoding';

interface StageScenarioManagerProps {
  scenario: Scenario;
}

interface StepInfo {
  id: StageStep;
  label: string;
  icon: React.ReactNode;
  description: string;
}

const STEPS: StepInfo[] = [
  { 
    id: 'import', 
    label: 'Import & Édition', 
    icon: <Upload size={18} />,
    description: 'Importer les stages des élèves'
  },
  { 
    id: 'geocoding', 
    label: 'Géocodage & Trajets', 
    icon: <MapPin size={18} />,
    description: 'Localiser et calculer les itinéraires'
  },
];

export function StageScenarioManager({ scenario }: StageScenarioManagerProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<StageStep>('import');
  const setCurrentScenario = useScenarioStore(state => state.setCurrentScenario);
  
  // Stores
  const { stages, loadStagesByScenario } = useStageStore();
  const { enseignants } = useEnseignantStore();
  const { eleves } = useEleveStore();
  
  // Charger les stages du scénario
  useEffect(() => {
    if (scenario.id) {
      loadStagesByScenario(scenario.id);
    }
  }, [scenario.id, loadStagesByScenario]);

  // Filtrer les élèves de 3ème selon les filtres du scénario
  const eleves3eme = useMemo(() => {
    const niveauxFiltres = scenario.parametres.filtresEleves?.niveaux || ['3e'];
    const classesFiltres = scenario.parametres.filtresEleves?.classes || [];
    
    return eleves.filter(e => {
      // Filtrer par niveau (commence par 3)
      const matchNiveau = niveauxFiltres.some(n => e.classe.startsWith(n.replace('e', '')));
      // Filtrer par classe si spécifié
      const matchClasse = classesFiltres.length === 0 || classesFiltres.includes(e.classe);
      return matchNiveau && matchClasse;
    });
  }, [eleves, scenario.parametres.filtresEleves]);

  // Filtrer les enseignants selon les filtres définis dans le scénario
  const enseignantsEligibles = useMemo(() => {
    const filtres = scenario.parametres.filtresEnseignants;
    
    // Si aucun filtre défini, prendre tous les enseignants
    if (!filtres) {
      return enseignants;
    }
    
    return enseignants.filter(e => {
      // Filtre: seulement les professeurs principaux
      if (filtres.ppOnly && !e.estProfPrincipal) {
        return false;
      }
      
      // Filtre par matière
      if (filtres.matieres && filtres.matieres.length > 0) {
        if (!filtres.matieres.includes(e.matierePrincipale)) {
          return false;
        }
      }
      
      // Filtre par classes en charge
      if (filtres.classesEnCharge && filtres.classesEnCharge.length > 0) {
        const hasMatchingClass = e.classesEnCharge?.some(c => 
          filtres.classesEnCharge!.includes(c)
        );
        if (!hasMatchingClass) {
          return false;
        }
      }
      
      return true;
    });
  }, [enseignants, scenario.parametres.filtresEnseignants]);

  // Stats pour le stepper
  const stats = useMemo(() => {
    const stagesGeocodés = stages.filter(s => s.geoStatus === 'ok' || s.geoStatus === 'manual').length;
    const enseignantsGeocodes = enseignantsEligibles.filter(e => e.geoStatus === 'ok' || e.geoStatus === 'manual').length;
    
    return {
      stagesTotal: stages.length,
      stagesGeocodes: stagesGeocodés,
      elevesAvecStage: stages.length,
      eleves3emeTotal: eleves3eme.length,
      enseignantsGeocodes,
      enseignantsTotal: enseignantsEligibles.length,
      pret: stagesGeocodés > 0 && enseignantsGeocodes > 0,
    };
  }, [stages, enseignantsEligibles, eleves3eme]);

  // Vérifier si une étape est complétée
  const isStepCompleted = useCallback((step: StageStep): boolean => {
    switch (step) {
      case 'import':
        return stages.length > 0;
      case 'geocoding':
        return stats.stagesGeocodes > 0 && stats.enseignantsGeocodes > 0;
      default:
        return false;
    }
  }, [stages.length, stats]);

  // Vérifier si une étape est accessible
  const isStepAccessible = useCallback((step: StageStep): boolean => {
    switch (step) {
      case 'import':
        return true;
      case 'geocoding':
        return stages.length > 0;
      default:
        return false;
    }
  }, [stages.length]);

  // Configuration terminée = prêt pour le matching
  const isConfigurationComplete = stats.pret;

  // Naviguer vers la page Affectations
  const handleGoToAffectations = () => {
    setCurrentScenario(scenario.id!);
    navigate('/board');
  };

  const handleStepClick = (step: StageStep) => {
    if (isStepAccessible(step)) {
      setCurrentStep(step);
    }
  };

  const handleNextStep = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      const nextStep = STEPS[currentIndex + 1];
      if (isStepAccessible(nextStep.id)) {
        setCurrentStep(nextStep.id);
      }
    }
  };

  return (
    <div className="stage-scenario-manager">
      {/* Header avec stats */}
      <div className="stage-header">
        <div className="stage-title">
          <h3>🎒 Configuration du Suivi de Stage</h3>
          <span className="stage-subtitle">
            {eleves3eme.length} élèves de 3ème · {enseignantsEligibles.length} tuteurs potentiels
          </span>
        </div>
        {enseignantsEligibles.length === 0 && (
          <div className="stage-alert stage-alert-error">
            <AlertCircle size={16} />
            <span>
              Aucun enseignant ne correspond aux filtres du scénario. 
              Modifiez les filtres dans les paramètres du scénario (onglet Enseignants).
            </span>
          </div>
        )}
        {enseignantsEligibles.length > 0 && !stats.pret && stages.length > 0 && (
          <div className="stage-alert">
            <AlertCircle size={16} />
            <span>
              {stats.stagesGeocodes === 0 
                ? 'Géocodez les stages pour continuer'
                : stats.enseignantsGeocodes === 0
                  ? 'Les enseignants doivent avoir une adresse géocodée'
                  : ''
              }
            </span>
          </div>
        )}
      </div>

      {/* Stepper */}
      <div className="stage-stepper">
        {STEPS.map((step, index) => {
          const isActive = currentStep === step.id;
          const isCompleted = isStepCompleted(step.id);
          const isAccessible = isStepAccessible(step.id);
          
          return (
            <React.Fragment key={step.id}>
              <button
                className={`step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''} ${!isAccessible ? 'disabled' : ''}`}
                onClick={() => handleStepClick(step.id)}
                disabled={!isAccessible}
              >
                <div className="step-icon">
                  {isCompleted ? <Check size={18} /> : step.icon}
                </div>
                <div className="step-content">
                  <span className="step-label">{step.label}</span>
                  <span className="step-description">{step.description}</span>
                </div>
                {step.id === 'import' && (
                  <span className="step-badge">{stats.stagesTotal}</span>
                )}
                {step.id === 'geocoding' && stats.stagesTotal > 0 && (
                  <span className="step-badge">{stats.stagesGeocodes}/{stats.stagesTotal}</span>
                )}
              </button>
              {index < STEPS.length - 1 && (
                <div className={`step-connector ${isCompleted ? 'completed' : ''}`}>
                  <ChevronRight size={16} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Contenu de l'étape */}
      <div className="stage-step-content">
        {currentStep === 'import' && (
          <StageImportStep
            scenario={scenario}
            stages={stages}
            eleves={eleves3eme}
            onComplete={handleNextStep}
          />
        )}
        {currentStep === 'geocoding' && (
          <StageGeocodingStep
            scenario={scenario}
            stages={stages}
            enseignants={enseignantsEligibles}
            onComplete={() => {}} // Plus de next step, on affiche le bouton
          />
        )}
      </div>

      {/* Bouton vers les affectations (visible quand configuration terminée) */}
      {isConfigurationComplete && (
        <div className="stage-ready-banner">
          <div className="ready-content">
            <Check size={20} />
            <div className="ready-text">
              <strong>Configuration terminée !</strong>
              <span>{stats.stagesGeocodes} stages et {stats.enseignantsGeocodes} enseignants prêts pour le matching.</span>
            </div>
          </div>
          <button className="btn-go-affectations" onClick={handleGoToAffectations}>
            Lancer les affectations
            <ArrowRight size={18} />
          </button>
        </div>
      )}
    </div>
  );
}
