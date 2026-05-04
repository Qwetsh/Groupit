// ============================================================
// GUIDED STEP - CONFIGURATION GROUPES (Mode personnalise)
// Parametres de taille, criteres de repartition, passages horaires
// ============================================================

import { useState, useMemo, useCallback } from 'react';
import {
  Users,
  Settings2,
  Scale,
  Clock,
  Calendar,
  Check,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { useUIStore } from '../../../stores/uiStore';
import { useScenarioStore } from '../../../stores/scenarioStore';
import { createDefaultCriteres, getEffectiveCriteres } from '../../../domain/models';
import type { Niveau } from '../../../domain/models';
import '../GuidedMode.css';

interface StepConfigGroupesProps {
  onNext: () => void;
  onBack: () => void;
}

const JOURS = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'] as const;
const PERIODES = ['Matin', 'Apres-midi'] as const;

const PARITY_OPTIONS = [
  { value: 'off', label: 'Desactive' },
  { value: 'low', label: 'Faible' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'Fort' },
  { value: 'required', label: 'Obligatoire' },
] as const;

const ENSEIGNANT_ELEVE_OPTIONS = [
  { value: 'off', label: 'Desactive' },
  { value: 'prefer', label: 'Privilegier' },
  { value: 'avoid', label: 'Eviter' },
] as const;

const MEME_CLASSE_OPTIONS = [
  { value: 'off', label: 'Desactive' },
  { value: 'prefer', label: 'Privilegier' },
  { value: 'avoid', label: 'Eviter' },
] as const;

const LV_OPTIONS = [
  { value: 'off', label: 'Desactive' },
  { value: 'same', label: 'Meme LV' },
  { value: 'mixed', label: 'Langues mixtes' },
] as const;

export const StepConfigGroupes: React.FC<StepConfigGroupesProps> = ({ onNext, onBack }) => {
  const { guidedMode, updateCustomConfig, setGuidedCreatedScenarioId } = useUIStore();
  const addScenario = useScenarioStore(state => state.addScenario);
  const [creating, setCreating] = useState(false);
  const customConfig = guidedMode.customConfig;

  const nbEleves = customConfig.selectedEleveIds.length;

  const nbGroupes = useMemo(() => {
    if (customConfig.tailleGroupeFixe) {
      return customConfig.tailleGroupeMax > 0
        ? Math.ceil(nbEleves / customConfig.tailleGroupeMax)
        : 0;
    }
    return customConfig.tailleGroupeMax > 0
      ? Math.ceil(nbEleves / customConfig.tailleGroupeMax)
      : 0;
  }, [nbEleves, customConfig.tailleGroupeMax, customConfig.tailleGroupeFixe]);

  const adultesParGroupe = useMemo(() => {
    if (!customConfig.useAdultes || nbGroupes === 0) return 0;
    return Math.floor(customConfig.selectedEnseignantIds.length / nbGroupes);
  }, [customConfig.useAdultes, customConfig.selectedEnseignantIds.length, nbGroupes]);

  const handleToggleTailleFixe = useCallback(() => {
    const newFixe = !customConfig.tailleGroupeFixe;
    if (newFixe) {
      // En mode fixe, on aligne min et max
      updateCustomConfig({
        tailleGroupeFixe: true,
        tailleGroupeMin: customConfig.tailleGroupeMax,
      });
    } else {
      updateCustomConfig({ tailleGroupeFixe: false });
    }
  }, [customConfig.tailleGroupeFixe, customConfig.tailleGroupeMax, updateCustomConfig]);

  const handleToggleTimeSlots = useCallback(() => {
    updateCustomConfig({ useTimeSlots: !customConfig.useTimeSlots });
  }, [customConfig.useTimeSlots, updateCustomConfig]);

  const handleToggleDemiJournee = useCallback((dj: string) => {
    const current = customConfig.demiJournees;
    const updated = current.includes(dj)
      ? current.filter(d => d !== dj)
      : [...current, dj];
    updateCustomConfig({ demiJournees: updated });
  }, [customConfig.demiJournees, updateCustomConfig]);

  return (
    <div className="step-config-groupes">
      <div className="step-header">
        <div className="step-icon-wrap">
          <Settings2 size={28} />
        </div>
        <h2>Configuration des groupes</h2>
        <p className="step-description">
          Definissez la taille des groupes, les criteres de repartition et les creneaux horaires.
        </p>
      </div>

      <div className="step-config-groupes-content" style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        paddingRight: '0.5rem',
      }}>

        {/* ============================================================
           SECTION 1 : Taille des groupes
           ============================================================ */}
        <section className="step-config-groupes-section" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Users size={18} style={{ color: '#3b82f6' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              Taille des groupes
            </h3>
          </div>

          {/* Toggle taille fixe / flexible */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <button
              onClick={handleToggleTailleFixe}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: customConfig.tailleGroupeFixe ? '#3b82f6' : '#94a3b8',
                fontSize: '0.875rem',
                padding: '0.375rem 0.75rem',
                borderRadius: '8px',
                transition: 'all 0.2s',
              }}
            >
              {customConfig.tailleGroupeFixe
                ? <ToggleRight size={20} style={{ color: '#3b82f6' }} />
                : <ToggleLeft size={20} />
              }
              <span>Taille fixe</span>
            </button>
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>
              {customConfig.tailleGroupeFixe
                ? 'Chaque groupe aura exactement le meme nombre d\'eleves'
                : 'La taille des groupes varie entre un minimum et un maximum'
              }
            </span>
          </div>

          {/* Inputs */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {customConfig.tailleGroupeFixe ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                  Eleves par groupe
                </label>
                <input
                  type="number"
                  min={2}
                  max={50}
                  value={customConfig.tailleGroupeMax}
                  onChange={e => {
                    const val = Math.max(2, Math.min(50, parseInt(e.target.value) || 2));
                    updateCustomConfig({ tailleGroupeMax: val, tailleGroupeMin: val });
                  }}
                  style={{
                    width: '80px',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#e2e8f0',
                    fontSize: '0.9rem',
                    textAlign: 'center',
                  }}
                />
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    Minimum
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={customConfig.tailleGroupeMax}
                    value={customConfig.tailleGroupeMin}
                    onChange={e => {
                      const val = Math.max(2, Math.min(customConfig.tailleGroupeMax, parseInt(e.target.value) || 2));
                      updateCustomConfig({ tailleGroupeMin: val });
                    }}
                    style={{
                      width: '80px',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      fontSize: '0.9rem',
                      textAlign: 'center',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    Maximum
                  </label>
                  <input
                    type="number"
                    min={customConfig.tailleGroupeMin}
                    max={50}
                    value={customConfig.tailleGroupeMax}
                    onChange={e => {
                      const val = Math.max(customConfig.tailleGroupeMin, Math.min(50, parseInt(e.target.value) || customConfig.tailleGroupeMin));
                      updateCustomConfig({ tailleGroupeMax: val });
                    }}
                    style={{
                      width: '80px',
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      fontSize: '0.9rem',
                      textAlign: 'center',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Info computed */}
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            background: 'rgba(59, 130, 246, 0.08)',
            borderRadius: '8px',
            border: '1px solid rgba(59, 130, 246, 0.15)',
            fontSize: '0.85rem',
            color: '#93c5fd',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.25rem',
          }}>
            <span>
              Environ <strong>{nbGroupes}</strong> groupe{nbGroupes > 1 ? 's' : ''} pour <strong>{nbEleves}</strong> eleve{nbEleves > 1 ? 's' : ''}
            </span>
            {customConfig.useAdultes && nbGroupes > 0 && (
              <span>
                Environ <strong>{adultesParGroupe}</strong> adulte{adultesParGroupe > 1 ? 's' : ''} par groupe
                ({customConfig.selectedEnseignantIds.length} {customConfig.adulteRole.toLowerCase()}{customConfig.selectedEnseignantIds.length > 1 ? 's' : ''} au total)
              </span>
            )}
          </div>
        </section>

        {/* ============================================================
           SECTION 2 : Criteres de repartition
           ============================================================ */}
        <section className="step-config-groupes-section" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
            <Scale size={18} style={{ color: '#a78bfa' }} />
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
              Criteres de repartition
            </h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Parite */}
            <CriterionRow
              label="Parite"
              description="Equilibrer la proportion filles/garcons dans chaque groupe"
              value={customConfig.critereParity}
              options={PARITY_OPTIONS}
              onChange={val => updateCustomConfig({ critereParity: val as typeof customConfig.critereParity })}
            />

            {/* Enseignant a l'eleve */}
            {customConfig.useAdultes && (
              <CriterionRow
                label="Enseignant a l'eleve en classe"
                description="L'adulte de reference a l'eleve dans sa classe"
                value={customConfig.critereEnseignantAEleve}
                options={ENSEIGNANT_ELEVE_OPTIONS}
                onChange={val => updateCustomConfig({ critereEnseignantAEleve: val as typeof customConfig.critereEnseignantAEleve })}
              />
            )}

            {/* Meme classe */}
            <CriterionRow
              label="Meme classe"
              description="Regrouper ou separer les eleves de la meme classe"
              value={customConfig.critereMemeClasse}
              options={MEME_CLASSE_OPTIONS}
              onChange={val => updateCustomConfig({ critereMemeClasse: val as typeof customConfig.critereMemeClasse })}
            />

            {/* Langue vivante */}
            <CriterionRow
              label="Langue vivante (LV1/LV2)"
              description="Regrouper par langue vivante ou diversifier"
              value={customConfig.critereLV}
              options={LV_OPTIONS}
              onChange={val => updateCustomConfig({ critereLV: val as typeof customConfig.critereLV })}
            />

            {/* Volume horaire */}
            {customConfig.useAdultes && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0.75rem 1rem',
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '10px',
                gap: '1rem',
              }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0' }}>
                    Volume horaire
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>
                    Ponderer par le volume horaire des enseignants (donner plus d'eleves aux enseignants qui les ont plus en cours)
                  </div>
                </div>
                <button
                  onClick={() => updateCustomConfig({ critereVolumeHoraire: !customConfig.critereVolumeHoraire })}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    background: customConfig.critereVolumeHoraire
                      ? 'rgba(34, 197, 94, 0.15)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: `1px solid ${customConfig.critereVolumeHoraire ? 'rgba(34, 197, 94, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                    borderRadius: '8px',
                    padding: '0.5rem 0.75rem',
                    cursor: 'pointer',
                    color: customConfig.critereVolumeHoraire ? '#4ade80' : '#94a3b8',
                    fontSize: '0.8rem',
                    fontWeight: 500,
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                >
                  {customConfig.critereVolumeHoraire ? <Check size={14} /> : null}
                  {customConfig.critereVolumeHoraire ? 'Active' : 'Desactive'}
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ============================================================
           SECTION 3 : Passages horaires (optionnel)
           ============================================================ */}
        <section className="step-config-groupes-section" style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '12px',
          padding: '1.25rem',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: customConfig.useTimeSlots ? '1rem' : 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={18} style={{ color: '#f59e0b' }} />
              <h3 style={{ fontSize: '1rem', fontWeight: 600, color: '#e2e8f0', margin: 0 }}>
                Passages horaires
              </h3>
              <span style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic' }}>
                (optionnel)
              </span>
            </div>
            <button
              onClick={handleToggleTimeSlots}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: customConfig.useTimeSlots ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                border: `1px solid ${customConfig.useTimeSlots ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.1)'}`,
                borderRadius: '8px',
                padding: '0.5rem 0.75rem',
                cursor: 'pointer',
                color: customConfig.useTimeSlots ? '#60a5fa' : '#94a3b8',
                fontSize: '0.8rem',
                fontWeight: 500,
                transition: 'all 0.2s',
              }}
            >
              {customConfig.useTimeSlots
                ? <ToggleRight size={16} style={{ color: '#3b82f6' }} />
                : <ToggleLeft size={16} />
              }
              {customConfig.useTimeSlots ? 'Active' : 'Desactive'}
            </button>
          </div>

          {customConfig.useTimeSlots && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Grille demi-journees */}
              <div>
                <label style={{ fontSize: '0.8rem', color: '#94a3b8', fontWeight: 500, display: 'block', marginBottom: '0.5rem' }}>
                  Demi-journees disponibles
                </label>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(5, 1fr)',
                  gap: '0.375rem',
                }}>
                  {/* Header jours */}
                  {JOURS.map(jour => (
                    <div key={jour} style={{
                      textAlign: 'center',
                      fontSize: '0.7rem',
                      color: '#94a3b8',
                      fontWeight: 600,
                      paddingBottom: '0.25rem',
                    }}>
                      {jour.slice(0, 3)}
                    </div>
                  ))}
                  {/* Boutons par periode */}
                  {PERIODES.map(periode => (
                    JOURS.map(jour => {
                      const key = `${jour}_${periode}`;
                      const isActive = customConfig.demiJournees.includes(key);
                      return (
                        <button
                          key={key}
                          onClick={() => handleToggleDemiJournee(key)}
                          style={{
                            padding: '0.5rem 0.25rem',
                            borderRadius: '6px',
                            border: `1px solid ${isActive ? 'rgba(59, 130, 246, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`,
                            background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255, 255, 255, 0.02)',
                            color: isActive ? '#93c5fd' : '#64748b',
                            fontSize: '0.7rem',
                            fontWeight: 500,
                            cursor: 'pointer',
                            transition: 'all 0.15s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '0.2rem',
                          }}
                          title={`${jour} ${periode}`}
                        >
                          {isActive && <Check size={10} />}
                          {periode === 'Matin' ? 'AM' : 'PM'}
                        </button>
                      );
                    })
                  ))}
                </div>
              </div>

              {/* Heures de debut */}
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    <Calendar size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                    Debut matin
                  </label>
                  <input
                    type="time"
                    value={customConfig.heureDebutMatin}
                    onChange={e => updateCustomConfig({ heureDebutMatin: e.target.value })}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                  <label style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 500 }}>
                    <Calendar size={12} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                    Debut apres-midi
                  </label>
                  <input
                    type="time"
                    value={customConfig.heureDebutAprem}
                    onChange={e => updateCustomConfig({ heureDebutAprem: e.target.value })}
                    style={{
                      padding: '0.5rem 0.75rem',
                      borderRadius: '8px',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#e2e8f0',
                      fontSize: '0.85rem',
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Footer actions */}
      <div className="step-actions">
        <button className="btn btn-secondary" onClick={onBack}>Retour</button>
        <button className="btn btn-primary" disabled={creating} onClick={async () => {
          setCreating(true);
          try {
            const cc = customConfig;
            const effectiveCriteres = getEffectiveCriteres('custom', createDefaultCriteres('custom'));

            const scenarioData = {
              nom: `Personnalise ${new Date().toLocaleDateString('fr-FR')}`,
              mode: 'matching' as const,
              type: 'custom' as const,
              parametres: {
                criteresV2: effectiveCriteres,
                criteres: [],
                capaciteConfig: {
                  capaciteBaseDefaut: cc.tailleGroupeMax,
                  coefficients: { '6e': 1, '5e': 1, '4e': 1, '3e': 1 },
                },
                equilibrageActif: true,
                filtresEnseignants: cc.useAdultes && cc.selectedEnseignantIds.length > 0 ? {
                  enseignantIds: cc.selectedEnseignantIds,
                  matieres: [],
                  classesEnCharge: [],
                  niveauxEnCharge: [],
                  ppOnly: false,
                } : undefined,
                custom: {
                  utiliserJurys: true,
                  capaciteDefaut: cc.tailleGroupeMax,
                  niveaux: [] as Niveau[],
                  tailleGroupeMin: cc.tailleGroupeMin,
                  tailleGroupeMax: cc.tailleGroupeMax,
                  tailleGroupeFixe: cc.tailleGroupeFixe,
                  adulteRole: cc.adulteRole,
                  sansAdultes: !cc.useAdultes,
                  critereParity: cc.critereParity,
                  critereEnseignantAEleve: cc.critereEnseignantAEleve,
                  critereMemeClasse: cc.critereMemeClasse,
                  critereLV: cc.critereLV,
                  critereVolumeHoraire: cc.critereVolumeHoraire,
                  useTimeSlots: cc.useTimeSlots,
                  demiJournees: cc.demiJournees,
                  heureDebutMatin: cc.heureDebutMatin,
                  heureDebutAprem: cc.heureDebutAprem,
                  selectedEleveIds: cc.selectedEleveIds.length > 0 ? cc.selectedEleveIds : undefined,
                },
              },
            };
            const newScenario = await addScenario(scenarioData);
            if (newScenario?.id) {
              setGuidedCreatedScenarioId(newScenario.id);
            }
            onNext();
          } catch (err) {
            console.error('Erreur creation scenario:', err);
          } finally {
            setCreating(false);
          }
        }}>
          {creating ? 'Creation...' : 'Suivant'}
        </button>
      </div>
    </div>
  );
};

// ============================================================
// SUB-COMPONENT: CriterionRow
// ============================================================

interface CriterionRowProps {
  label: string;
  description: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

function CriterionRow({ label, description, value, options, onChange }: CriterionRowProps) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0.75rem 1rem',
      background: 'rgba(255, 255, 255, 0.02)',
      border: '1px solid rgba(255, 255, 255, 0.06)',
      borderRadius: '10px',
      gap: '1rem',
    }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0' }}>
          {label}
        </div>
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.125rem' }}>
          {description}
        </div>
      </div>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          padding: '0.4rem 0.6rem',
          borderRadius: '8px',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          background: 'rgba(255, 255, 255, 0.05)',
          color: value === 'off' ? '#94a3b8' : '#e2e8f0',
          fontSize: '0.8rem',
          fontWeight: 500,
          cursor: 'pointer',
          appearance: 'auto',
          flexShrink: 0,
          minWidth: '110px',
        }}
      >
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}
