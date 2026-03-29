import { useState } from 'react';
import {
  supabase,
  DEFAULT_CRITERIA_CONFIG,
  validateCriteriaConfig,
  computeMaxTotal,
  computeMaxByCategory,
} from '@groupit/shared';
import type { CriteriaConfig, CriteriaCategory, CriterionConfig } from '@groupit/shared';

interface CriteriaConfigModalProps {
  sessionId: string;
  currentConfig: CriteriaConfig;
  evaluatedCount: number;
  onClose: () => void;
  onSaved: () => void;
}

let idCounter = 0;
function genId(prefix: string) {
  return `${prefix}_${Date.now()}_${++idCounter}`;
}

export function CriteriaConfigModal({ sessionId, currentConfig, evaluatedCount, onClose, onSaved }: CriteriaConfigModalProps) {
  const [config, setConfig] = useState<CriteriaConfig>(JSON.parse(JSON.stringify(currentConfig)));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxTotal = computeMaxTotal(config);
  const maxByCat = computeMaxByCategory(config);

  function updateCategory(idx: number, patch: Partial<CriteriaCategory>) {
    setConfig(prev => {
      const cats = [...prev.categories];
      cats[idx] = { ...cats[idx]!, ...patch };
      return { ...prev, categories: cats };
    });
  }

  function addCategory() {
    const id = genId('cat');
    setConfig(prev => ({
      ...prev,
      categories: [...prev.categories, { id, label: 'Nouvelle cat\u00e9gorie' }],
    }));
  }

  function removeCategory(idx: number) {
    const catId = config.categories[idx]!.id;
    const hasCriteria = config.criteria.some(c => c.categoryId === catId);
    if (hasCriteria) {
      setError('Supprimez d\'abord les crit\u00e8res de cette cat\u00e9gorie.');
      return;
    }
    setConfig(prev => ({
      ...prev,
      categories: prev.categories.filter((_, i) => i !== idx),
    }));
  }

  function updateCriterion(idx: number, patch: Partial<CriterionConfig>) {
    setConfig(prev => {
      const criteria = [...prev.criteria];
      criteria[idx] = { ...criteria[idx]!, ...patch };
      return { ...prev, criteria };
    });
  }

  function addCriterion(categoryId: string) {
    if (config.criteria.length >= 8) {
      setError('Maximum 8 crit\u00e8res.');
      return;
    }
    const id = genId('crit');
    setConfig(prev => ({
      ...prev,
      criteria: [...prev.criteria, {
        id,
        label: 'Nouveau crit\u00e8re',
        desc: '',
        categoryId,
        levels: [
          { label: 'Tr\u00e8s insuffisant', shortLabel: 'TI', value: 1 },
          { label: 'Insuffisant', shortLabel: 'I', value: 2 },
          { label: 'Satisfaisant', shortLabel: 'S', value: 3 },
          { label: 'Tr\u00e8s satisfaisant', shortLabel: 'TS', value: 4 },
        ],
        max: 4,
      }],
    }));
  }

  function removeCriterion(idx: number) {
    if (config.criteria.length <= 3) {
      setError('Minimum 3 crit\u00e8res.');
      return;
    }
    setConfig(prev => ({
      ...prev,
      criteria: prev.criteria.filter((_, i) => i !== idx),
    }));
  }

  function updateLevel(critIdx: number, levelIdx: number, patch: Partial<{ label: string; shortLabel: string; value: number }>) {
    setConfig(prev => {
      const criteria = [...prev.criteria];
      const c = { ...criteria[critIdx]! };
      const levels = [...c.levels];
      levels[levelIdx] = { ...levels[levelIdx]!, ...patch };
      c.levels = levels;
      c.max = Math.max(...levels.map(l => l.value));
      criteria[critIdx] = c;
      return { ...prev, criteria };
    });
  }

  function addLevel(critIdx: number) {
    setConfig(prev => {
      const criteria = [...prev.criteria];
      const c = { ...criteria[critIdx]! };
      const lastVal = c.levels.length > 0 ? c.levels[c.levels.length - 1]!.value + 1 : 1;
      c.levels = [...c.levels, { label: 'Niveau', shortLabel: `N${c.levels.length + 1}`, value: lastVal }];
      c.max = Math.max(...c.levels.map(l => l.value));
      criteria[critIdx] = c;
      return { ...prev, criteria };
    });
  }

  function removeLevel(critIdx: number, levelIdx: number) {
    setConfig(prev => {
      const criteria = [...prev.criteria];
      const c = { ...criteria[critIdx]! };
      if (c.levels.length <= 1) return prev;
      c.levels = c.levels.filter((_, i) => i !== levelIdx);
      c.max = Math.max(...c.levels.map(l => l.value));
      criteria[critIdx] = c;
      return { ...prev, criteria };
    });
  }

  function moveCriterion(idx: number, dir: -1 | 1) {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= config.criteria.length) return;
    setConfig(prev => {
      const criteria = [...prev.criteria];
      [criteria[idx], criteria[newIdx]] = [criteria[newIdx]!, criteria[idx]!];
      return { ...prev, criteria };
    });
  }

  function handleReset() {
    if (!window.confirm('R\u00e9initialiser avec la grille par d\u00e9faut ?')) return;
    setConfig(JSON.parse(JSON.stringify(DEFAULT_CRITERIA_CONFIG)));
  }

  async function handleSave() {
    setError(null);
    const validation = validateCriteriaConfig(config);
    if (!validation.valid) {
      setError(validation.errors.join(' '));
      return;
    }

    setSaving(true);
    const { error: err } = await supabase
      .from('exam_sessions')
      .update({ criteria_config: config as unknown as Record<string, unknown> })
      .eq('id', sessionId);

    setSaving(false);
    if (err) {
      setError(`Erreur Supabase : ${err.message}`);
      return;
    }
    onSaved();
  }

  return (
    <div style={modalStyles.overlay} onClick={onClose}>
      <div style={modalStyles.modal} onClick={e => e.stopPropagation()}>
        <div style={modalStyles.header}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Configuration des crit\u00e8res</h2>
          <button onClick={onClose} style={modalStyles.closeBtn}>\u00d7</button>
        </div>

        {evaluatedCount > 0 && (
          <div style={modalStyles.warning}>
            \u26A0\uFE0F {evaluatedCount} \u00e9l\u00e8ve(s) d\u00e9j\u00e0 \u00e9valu\u00e9(s). Modifier la grille peut rendre les anciennes notes incoh\u00e9rentes.
          </div>
        )}

        <div style={modalStyles.content}>
          {/* Cat\u00e9gories */}
          <div style={modalStyles.section}>
            <div style={modalStyles.sectionHeader}>
              <h3 style={modalStyles.sectionTitle}>Cat\u00e9gories</h3>
              <button onClick={addCategory} style={modalStyles.addBtn}>+ Cat\u00e9gorie</button>
            </div>
            {config.categories.map((cat, catIdx) => (
              <div key={cat.id} style={modalStyles.catRow}>
                <input
                  style={modalStyles.inputSm}
                  value={cat.emoji || ''}
                  onChange={e => updateCategory(catIdx, { emoji: e.target.value })}
                  placeholder="Emoji"
                  maxLength={4}
                />
                <input
                  style={{ ...modalStyles.input, flex: 1 }}
                  value={cat.label}
                  onChange={e => updateCategory(catIdx, { label: e.target.value })}
                  placeholder="Nom de la cat\u00e9gorie"
                />
                <span style={modalStyles.maxBadge}>/{maxByCat[cat.id] ?? 0}</span>
                <button onClick={() => removeCategory(catIdx)} style={modalStyles.deleteBtn}>\u2715</button>
              </div>
            ))}
          </div>

          {/* Crit\u00e8res par cat\u00e9gorie */}
          {config.categories.map(cat => {
            const catCriteria = config.criteria
              .map((c, idx) => ({ ...c, _idx: idx }))
              .filter(c => c.categoryId === cat.id);

            return (
              <div key={cat.id} style={modalStyles.section}>
                <div style={modalStyles.sectionHeader}>
                  <h3 style={modalStyles.sectionTitle}>{cat.emoji || ''} {cat.label}</h3>
                  <button onClick={() => addCriterion(cat.id)} style={modalStyles.addBtn}>+ Crit\u00e8re</button>
                </div>

                {catCriteria.map(c => (
                  <div key={c.id} style={modalStyles.criterionCard}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                      <button onClick={() => moveCriterion(c._idx, -1)} style={modalStyles.moveBtn}>\u25B2</button>
                      <button onClick={() => moveCriterion(c._idx, 1)} style={modalStyles.moveBtn}>\u25BC</button>
                      <input
                        style={{ ...modalStyles.input, flex: 1, fontWeight: 700 }}
                        value={c.label}
                        onChange={e => updateCriterion(c._idx, { label: e.target.value })}
                        placeholder="Label"
                      />
                      <span style={modalStyles.maxBadge}>max: {c.max}</span>
                      <button onClick={() => removeCriterion(c._idx)} style={modalStyles.deleteBtn}>\u2715</button>
                    </div>
                    <input
                      style={{ ...modalStyles.input, width: '100%', marginBottom: 6, fontSize: 12 }}
                      value={c.desc}
                      onChange={e => updateCriterion(c._idx, { desc: e.target.value })}
                      placeholder="Description"
                    />
                    <div style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' as const }}>
                      {c.levels.map((level, lIdx) => (
                        <div key={lIdx} style={modalStyles.levelChip}>
                          <input
                            style={modalStyles.levelInput}
                            value={level.shortLabel}
                            onChange={e => updateLevel(c._idx, lIdx, { shortLabel: e.target.value })}
                            title="Label court"
                            maxLength={4}
                          />
                          <input
                            style={{ ...modalStyles.levelInput, width: 40 }}
                            type="number"
                            step="0.5"
                            value={level.value}
                            onChange={e => updateLevel(c._idx, lIdx, { value: parseFloat(e.target.value) || 0 })}
                            title="Valeur"
                          />
                          <button onClick={() => removeLevel(c._idx, lIdx)} style={modalStyles.levelDel}>\u00d7</button>
                        </div>
                      ))}
                      <button onClick={() => addLevel(c._idx)} style={modalStyles.addLevelBtn}>+</button>
                    </div>
                  </div>
                ))}
              </div>
            );
          })}

          {/* Aper\u00e7u */}
          <div style={modalStyles.preview}>
            Total max : <strong>{maxTotal}</strong> points
            {config.categories.map(cat => (
              <span key={cat.id} style={{ marginLeft: 12 }}>
                {cat.emoji || ''} {cat.label} : <strong>{maxByCat[cat.id] ?? 0}</strong>
              </span>
            ))}
          </div>
        </div>

        {error && (
          <div style={modalStyles.error}>{error}</div>
        )}

        <div style={modalStyles.footer}>
          <button onClick={handleReset} style={modalStyles.resetBtn}>R\u00e9initialiser (grille par d\u00e9faut)</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose} style={modalStyles.cancelBtn}>Annuler</button>
            <button onClick={handleSave} disabled={saving} style={{
              ...modalStyles.saveBtn,
              opacity: saving ? 0.6 : 1,
            }}>
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const modalStyles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: 16,
    width: '90%',
    maxWidth: 720,
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    borderBottom: '1px solid #e2e8f0',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    fontSize: 24,
    cursor: 'pointer',
    color: '#64748b',
    padding: '4px 8px',
  },
  warning: {
    margin: '0 24px',
    marginTop: 12,
    padding: '10px 14px',
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    fontSize: 13,
    color: '#92400e',
    fontWeight: 600,
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 24px',
  },
  section: {
    marginBottom: 20,
  },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: '#1e293b',
    margin: 0,
  },
  addBtn: {
    padding: '4px 12px',
    borderRadius: 6,
    border: '1px solid #2b6cb0',
    background: '#ebf4ff',
    color: '#2b6cb0',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  catRow: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    marginBottom: 6,
  },
  input: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid #d2dce6',
    fontSize: 13,
    outline: 'none',
    boxSizing: 'border-box' as const,
  },
  inputSm: {
    padding: '6px 8px',
    borderRadius: 6,
    border: '1px solid #d2dce6',
    fontSize: 13,
    outline: 'none',
    width: 50,
    textAlign: 'center' as const,
  },
  maxBadge: {
    fontSize: 12,
    fontWeight: 700,
    color: '#64748b',
    whiteSpace: 'nowrap' as const,
  },
  deleteBtn: {
    background: 'none',
    border: 'none',
    color: '#c53030',
    fontSize: 14,
    cursor: 'pointer',
    padding: '2px 6px',
  },
  criterionCard: {
    background: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
  },
  moveBtn: {
    background: '#f1f5f9',
    border: '1px solid #d2dce6',
    borderRadius: 4,
    fontSize: 10,
    cursor: 'pointer',
    padding: '2px 6px',
    color: '#64748b',
  },
  levelChip: {
    display: 'flex',
    gap: 2,
    alignItems: 'center',
    background: '#e2e8f0',
    borderRadius: 6,
    padding: '2px 4px',
  },
  levelInput: {
    width: 30,
    padding: '3px 4px',
    border: '1px solid #cbd5e1',
    borderRadius: 4,
    fontSize: 11,
    textAlign: 'center' as const,
    outline: 'none',
  },
  levelDel: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: 12,
    cursor: 'pointer',
    padding: '0 2px',
  },
  addLevelBtn: {
    background: '#e2e8f0',
    border: 'none',
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    padding: '4px 10px',
    color: '#475569',
  },
  preview: {
    padding: '12px 14px',
    background: '#f0f4f8',
    borderRadius: 8,
    fontSize: 13,
    color: '#1e293b',
    marginTop: 8,
  },
  error: {
    margin: '0 24px 8px',
    padding: '10px 14px',
    background: '#fed7d7',
    color: '#9b2c2c',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
  },
  footer: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 24px',
    borderTop: '1px solid #e2e8f0',
  },
  resetBtn: {
    padding: '8px 14px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    color: '#64748b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  saveBtn: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    background: 'linear-gradient(135deg, #276749 0%, #22543d 100%)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
  },
};
