// ============================================================
// GUIDED STEP - SÉLECTION DES SALLES POUR L'ORAL DNB
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import { DoorOpen, Check, AlertTriangle } from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { useJuryStore } from '../../../stores/juryStore';
import { SALLES_DISPONIBLES, CATEGORIES_SALLES } from '../../../domain/sallesConfig';
import '../GuidedMode.css';

interface StepSallesProps {
  onNext: () => void;
  onBack: () => void;
}

export function StepSalles({ onNext, onBack }: StepSallesProps) {
  const { guidedMode } = useUIStore();
  const { scenarios } = useScenarioStore();
  const { getJurysByScenario, updateJury } = useJuryStore();

  const scenario = scenarios.find(s => s.id === guidedMode.createdScenarioId);
  const scenarioJurys = scenario ? getJurysByScenario(scenario.id!) : [];
  const nbJurys = scenarioJurys.length;

  const [selectedSalles, setSelectedSalles] = useState<Set<string>>(() => {
    // Pre-select salles already assigned to jurys
    const existing = new Set<string>();
    for (const jury of scenarioJurys) {
      if (jury.salle) existing.add(jury.salle);
    }
    return existing;
  });

  const toggleSalle = useCallback((numero: string) => {
    setSelectedSalles(prev => {
      const next = new Set(prev);
      if (next.has(numero)) {
        next.delete(numero);
      } else {
        next.add(numero);
      }
      return next;
    });
  }, []);

  const sallesParCategorie = useMemo(() => {
    const map = new Map<string, typeof SALLES_DISPONIBLES>();
    for (const cat of CATEGORIES_SALLES) {
      map.set(cat, SALLES_DISPONIBLES.filter(s => s.categorie === cat));
    }
    return map;
  }, []);

  const hasEnoughSalles = selectedSalles.size >= nbJurys;

  const handleValidate = useCallback(async () => {
    if (!hasEnoughSalles) return;

    // Assign salles randomly to jurys
    const sallesArray = [...selectedSalles];
    // Shuffle
    for (let i = sallesArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [sallesArray[i], sallesArray[j]] = [sallesArray[j], sallesArray[i]];
    }

    // Assign one salle per jury
    for (let i = 0; i < scenarioJurys.length; i++) {
      const jury = scenarioJurys[i];
      await updateJury(jury.id!, { salle: sallesArray[i] });
    }

    onNext();
  }, [hasEnoughSalles, selectedSalles, scenarioJurys, updateJury, onNext]);

  return (
    <div className="guided-step step-salles">
      <h1 className="step-title">
        <DoorOpen size={28} />
        Choix des salles
      </h1>
      <p className="step-subtitle">
        Sélectionnez les salles disponibles pour le passage des oraux.
        Vous avez <strong>{nbJurys} jurys</strong>, il faut au minimum <strong>{nbJurys} salles</strong>.
      </p>

      <div className="salles-status">
        {hasEnoughSalles ? (
          <div className="salles-status-ok">
            <Check size={16} />
            {selectedSalles.size} salle{selectedSalles.size > 1 ? 's' : ''} sélectionnée{selectedSalles.size > 1 ? 's' : ''} pour {nbJurys} jury{nbJurys > 1 ? 's' : ''}
          </div>
        ) : (
          <div className="salles-status-warning">
            <AlertTriangle size={16} />
            {selectedSalles.size} / {nbJurys} salles sélectionnées — il en manque {nbJurys - selectedSalles.size}
          </div>
        )}
      </div>

      <div className="salles-grid">
        {[...sallesParCategorie.entries()].map(([categorie, salles]) => (
          <div key={categorie} className="salles-categorie">
            <h3 className="salles-categorie-title">{categorie}</h3>
            <div className="salles-list">
              {salles.map(salle => (
                <button
                  key={salle.numero}
                  className={`salle-chip ${selectedSalles.has(salle.numero) ? 'selected' : ''}`}
                  onClick={() => toggleSalle(salle.numero)}
                >
                  {selectedSalles.has(salle.numero) && <Check size={14} />}
                  {salle.numero}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>
          Retour
        </button>
        <button
          className="btn btn-primary"
          onClick={handleValidate}
          disabled={!hasEnoughSalles}
        >
          Valider les salles
        </button>
      </div>
    </div>
  );
}
